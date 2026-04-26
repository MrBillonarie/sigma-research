'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'

const MONO   = "var(--font-dm-mono,'DM Mono',monospace)"
const GOLD   = '#F5C842'
const BG     = '#04050a'
const CARD   = '#0f0f0f'
const BORDER = 'rgba(255,255,255,0.08)'
const TEXT   = '#e8e9f0'
const MUTED  = 'rgba(255,255,255,0.38)'
const DIM    = 'rgba(255,255,255,0.55)'
const GREEN  = '#34d399'
const RED    = '#f87171'

interface Notification {
  id:            string
  title:         string
  body:          string
  type:          string
  read:          boolean
  urgente?:      boolean
  accion_label?: string | null
  accion_href?:  string | null
  created_at:    string
}

function TypeIcon({ type }: { type: string }) {
  const base: React.CSSProperties = { width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }
  if (type === 'señal' || type === 'lp_signal') return <span style={{ ...base, background: 'rgba(212,175,55,0.15)', color: '#d4af37' }}>▲</span>
  if (type === 'mercado')   return <span style={{ ...base, background: 'rgba(99,179,237,0.12)', color: '#63b3ed' }}>~</span>
  if (type === 'portfolio') return <span style={{ ...base, background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>$</span>
  if (type === 'reporte')   return <span style={{ ...base, background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>▣</span>
  return <span style={{ ...base, background: 'rgba(122,127,154,0.15)', color: '#7a7f9a' }}>!</span>
}

function fmtTime(s: string) {
  const diff = Date.now() - new Date(s).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 2)  return 'recién'
  if (min < 60) return `hace ${min}m`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs}h`
  if (hrs < 48) return 'ayer'
  return `hace ${Math.floor(hrs / 24)}d`
}

const TYPE_LABELS: Record<string, string> = {
  all:       'Todas',
  señal:     'Señales',
  mercado:   'Mercado',
  portfolio: 'Portafolio',
  reporte:   'Reportes',
  sistema:   'Sistema',
}

export default function NotificacionesPage() {
  const router = useRouter()
  const [notifs,   setNotifs]   = useState<Notification[]>([])
  const [loading,  setLoading]  = useState(true)
  const [userId,   setUserId]   = useState<string | null>(null)
  const [filter,   setFilter]   = useState('all')

  const loadNotifs = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) setNotifs(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      setUserId(user.id)
      loadNotifs(user.id)
    })
  }, [loadNotifs, router])

  async function markRead(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  async function markAllRead() {
    if (!userId) return
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  }

  async function deleteNotif(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
  }

  async function handleClick(n: Notification) {
    if (!n.read) await markRead(n.id)
    if (n.accion_href) router.push(n.accion_href)
  }

  const filtered = filter === 'all' ? notifs : notifs.filter(n => n.type === filter)
  const unread   = notifs.filter(n => !n.read).length

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: MONO }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '72px 24px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>
              {'// HISTORIAL · COMPLETO'}
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 'clamp(36px,5vw,60px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
              <span style={{ color: TEXT }}>NOTIFI</span>
              <span style={{ background: `linear-gradient(135deg,${GOLD},#f0cc5a)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CACIONES</span>
            </h1>
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              style={{ fontFamily: MONO, fontSize: 10, color: GOLD, background: 'none', border: `1px solid ${GOLD}44`, borderRadius: 6, padding: '8px 16px', cursor: 'pointer', letterSpacing: '0.1em' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(245,200,66,0.08)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}
            >
              MARCAR TODAS COMO LEÍDAS ({unread})
            </button>
          )}
        </div>
        <div style={{ height: 1, background: BORDER, marginBottom: 24 }} />

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em',
                padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: filter === key ? GOLD : 'rgba(255,255,255,0.05)',
                color: filter === key ? '#000' : DIM,
                fontWeight: filter === key ? 700 : 400,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {label}
              {key !== 'all' && (
                <span style={{ marginLeft: 6, opacity: 0.6 }}>
                  {notifs.filter(n => n.type === key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: MONO, fontSize: 12, color: MUTED }}>
            Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>🔔</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>Sin notificaciones</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(n => (
              <div
                key={n.id}
                style={{
                  background: CARD, border: `1px solid ${BORDER}`,
                  borderLeft: n.urgente ? `3px solid ${GOLD}` : `3px solid transparent`,
                  borderRadius: 10, padding: '14px 18px',
                  opacity: n.read ? 0.65 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Unread dot */}
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: n.read ? 'transparent' : GREEN, flexShrink: 0, marginTop: 6, border: n.read ? `1px solid rgba(255,255,255,0.1)` : 'none' }} />
                  <TypeIcon type={n.type} />
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
                      <div style={{ fontFamily: MONO, fontSize: 12, color: n.read ? DIM : TEXT, fontWeight: n.read ? 400 : 600 }}>
                        {n.title}
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
                        {fmtTime(n.created_at)}
                      </span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: '#3a3f55', lineHeight: 1.6, marginBottom: n.accion_label ? 10 : 0 }}>
                      {n.body}
                    </div>
                    {n.accion_label && n.accion_href && (
                      <button
                        onClick={() => handleClick(n)}
                        style={{ fontFamily: MONO, fontSize: 10, color: GOLD, background: 'none', border: `1px solid ${GOLD}44`, borderRadius: 5, padding: '4px 12px', cursor: 'pointer', letterSpacing: '0.08em' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(245,200,66,0.08)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}
                      >
                        {n.accion_label} →
                      </button>
                    )}
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {!n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        title="Marcar como leída"
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = GREEN)}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)')}
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotif(n.id)}
                      title="Eliminar"
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = RED)}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.15)')}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
