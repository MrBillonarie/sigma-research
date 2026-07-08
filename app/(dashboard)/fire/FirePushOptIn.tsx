'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'

type Status = 'checking' | 'unsupported' | 'default' | 'denied' | 'subscribed'

const GOLD = '#39e2e6'
const MONO = "var(--font-dm-mono,'DM Mono',monospace)"
const MUTED = 'rgba(255,255,255,0.38)'

// Web Push necesita la VAPID public key codificada como Uint8Array, no como
// base64 plano — conversión estándar de la spec (no hay helper nativo).
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// Recordatorio FIRE diario (cron 20:00 Chile) llega por la campanita in-app
// siempre, pero solo llega como notificación real de navegador/móvil si el
// usuario activa esto — pide permiso, se suscribe al service worker ya
// registrado en toda la app (SWRegister.tsx) y guarda la suscripción en
// Supabase (push_subscriptions) para que el cron le pueda mandar el push.
export default function FirePushOptIn() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') { setStatus('denied'); return }
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setStatus(sub ? 'subscribed' : 'default'))
      .catch(() => setStatus('default'))
  }, [])

  async function activar() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) { setStatus('unsupported'); return }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') { setStatus(permission === 'denied' ? 'denied' : 'default'); return }

    const { data } = await supabase.auth.getUser()
    if (!data.user) return

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
    }

    const json = sub.toJSON()
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    })
    setStatus('subscribed')
  }

  if (status === 'checking' || status === 'unsupported') return null

  if (status === 'subscribed') {
    return (
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', color: GOLD, display: 'flex', alignItems: 'center', gap: 6 }}>
        🔔 Notificaciones activas
      </span>
    )
  }

  if (status === 'denied') {
    return (
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', color: MUTED }}>
        🔕 Notificaciones bloqueadas — actívalas desde los permisos del navegador
      </span>
    )
  }

  return (
    <button
      onClick={activar}
      style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', color: MUTED,
        background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
        padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GOLD; (e.currentTarget as HTMLElement).style.color = GOLD }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.color = MUTED }}
    >
      🔔 Activar recordatorio diario
    </button>
  )
}
