'use client'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner,    setShowBanner]    = useState(false)
  const [dismissed,     setDismissed]     = useState(false)

  useEffect(() => {
    // Registrar service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // No mostrar si ya está instalada como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // No mostrar si el usuario ya la descartó antes
    if (sessionStorage.getItem('pwa_dismissed')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      // Mostrar banner después de 30s de navegación
      setTimeout(() => setShowBanner(true), 10_000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setShowBanner(false)
    setInstallPrompt(null)
  }

  function handleDismiss() {
    sessionStorage.setItem('pwa_dismissed', '1')
    setDismissed(true)
    setShowBanner(false)
  }

  if (!showBanner || dismissed || !installPrompt) return null

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 9999,
      background: '#0b0d14', border: '1px solid #d4af3760',
      padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      boxShadow: '0 4px 32px rgba(0,0,0,0.6)',
    }}>
      <div style={{
        width: 36, height: 36, border: '2px solid #d4af37', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: '#d4af37', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>Σ</span>
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#e8e9f0', letterSpacing: '0.1em', marginBottom: 2 }}>
          INSTALAR SIGMA RESEARCH
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#7a7f9a' }}>
          Acceso rápido desde tu pantalla de inicio
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleDismiss}
          style={{ fontFamily: 'monospace', fontSize: 10, color: '#5a5f7a', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px' }}
        >
          Ahora no
        </button>
        <button
          onClick={handleInstall}
          style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', color: '#04050a', background: '#d4af37', border: 'none', cursor: 'pointer', padding: '8px 16px' }}
        >
          INSTALAR
        </button>
      </div>
    </div>
  )
}
