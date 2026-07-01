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

// ─── SVG Type Icons ───────────────────────────────────────────────────────────
function TypeIcon({ type }: { type: string }) {
  const size  = 22
  const inner = 13
  function wrap(bg: string, color: string, paths: React.ReactNode) {
    return (
      <span style={{
        width: size, height: size, borderRadius: 4, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: bg,
      }}>
        <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none"
          stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {paths}
        </svg>
      </span>
    )
  }

  if (type === 'señal' || type === 'lp_signal')
    return wrap('rgba(212,175,55,0.15)', '#d4af37', <>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </>)

  if (type === 'mercado')
    return wrap('rgba(99,179,237,0.12)', '#63b3ed', <>
      <polyline points="3 18 9 12 13 16 21 8" />
    </>)

  if (type === 'portfolio')
    return wrap('rgba(52,211,153,0.12)', '#34d399', <>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>)

  if (type === 'reporte')
    return wrap('rgba(167,139,250,0.12)', '#a78bfa', <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>)

  if (type === 'soporte')
    return wrap('rgba(250,204,21,0.12)', '#facc15', <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>)

  return wrap('rgba(122,127,154,0.15)', '#7a7f9a', <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </>)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

interface DateGroup { label: string; items: Notification[] }

function groupByDate(notifs: Notification[]): DateGroup[] {
  const now         = new Date()
  const todayMs     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayMs = todayMs - 86_400_000
  const weekMs      = todayMs - 7 * 86_400_000

  const groups: DateGroup[] = [
    { label: 'HOY',         items: [] },
    { label: 'AYER',        items: [] },
    { label: 'ESTA SEMANA', items: [] },
    { label: 'ANTERIOR',    items: [] },
  ]

  for (const n of notifs) {
    const d     = new Date(n.created_at)
    const dayMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    if      (dayMs >= todayMs)     groups[0].items.push(n)
    else if (dayMs >= yesterdayMs) groups[1].items.push(n)
    else if (dayMs >= weekMs)      groups[2].items.push(n)
    else                           groups[3].items.push(n)
  }

  return groups.filter(g => g.items.length > 0)
}

const TYPE_LABELS: Record<string, string> = {
  all:       'Todas',
  señal:     'Señales',
  mercado:   'Mercado',
  portfolio: 'Portafolio',
  reporte:   'Reportes',
  sistema:   'Sistema',
  soporte:   'Soporte',
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NotificacionesPage() {
  const router = useRouter()
  const [notifs,  setNotifs]  = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [userId,  setUserId]  = useState<string | null>(null)
  const [filter,  setFilter]  = useState('all')

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
    }).catch(() => router.replace('/login'))
  }, [loadNotifs, router])

  // Realtime — INSERT nuevas + UPDATE (sincroniza lectura desde el bell en otra pestaña)
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications-page:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifs(prev => [payload.new as Notification, ...prev])
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifs(prev => prev.map(n =>
          n.id === (payload.new as Notification).id ? { ...n, ...(payload.new as Notification) } : n
        ))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function markRead(id: string) {
    if (!userId) return
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', userId)
  }

  async function markAllRead() {
    if (!userId) return
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  }

  async function deleteNotif(id: string) {
    if (!userId) return
    setNotifs(prev => prev.filter(n => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id).eq('user_id', userId)
  }

  async function handleClick(n: Notification) {
    if (!n.read) await markRead(n.id)
    if (n.accion_href) {
      router.push(n.accion_href.startsWith('/') ? n.accion_href : '/home')
    }
  }

  const filtered = filter === 'all' ? notifs : notifs.filter(n => n.type === filter)
  const unread   = notifs.filter(n => !n.read).length
  const groups   = groupByDate(filtered)

  if (loading && !userId) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.2em', color: MUTED }}>CARGANDO…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: MONO }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '72px 24px 80px' }}>

        {/* ── Header ── */}
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
        <div style={{ height: 1, background: BORDER, marginBottom: 28 }} />

        {/* ── Filter tabs ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_LABELS).map(([key, label]) => {
            const unreadCount = key === 'all'
              ? notifs.filter(n => !n.read).length
              : notifs.filter(n => n.type === key && !n.read).length
            const active = filter === key
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em',
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: active ? GOLD : 'rgba(255,255,255,0.05)',
                  color: active ? '#000' : DIM,
                  fontWeight: active ? 700 : 400,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {label}
                {unreadCount > 0 && (
                  <span style={{
                    marginLeft: 6,
                    background: active ? 'rgba(0,0,0,0.2)' : '#ef4444',
                    color: active ? '#000' : '#fff',
                    fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 8,
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── List ── */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: MONO, fontSize: 12, color: MUTED }}>
            Cargando…
          </div>
        ) : filtered.length === 0 ? (
          /* ── Empty state ── */
          <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <pre style={{
              fontFamily: MONO, fontSize: 11, color: '#1a1e30',
              lineHeight: 1.65, margin: 0, letterSpacing: '0.04em',
            }}>{`┌──────────────────────────────┐
│  > SIGMA NOTIFICATION ENGINE │
│  > version  : 2.0            │
│  > status   : standby        │
│  > queue    : empty          │
│  > signals  : 0              │
│  > awaiting signals...       │
└──────────────────────────────┘`}</pre>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: '#2a2f45', letterSpacing: '0.15em' }}>
                SIN NOTIFICACIONES
              </span>
              {filter !== 'all' && (
                <span style={{ fontFamily: MONO, fontSize: 10, color: '#1e2235', letterSpacing: '0.1em' }}>
                  FILTRO: {TYPE_LABELS[filter]?.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        ) : (
          /* ── Grouped list ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {groups.map(group => {
              const groupUnread = group.items.filter(n => !n.read).length
              return (
                <div key={group.label}>
                  {/* Date group header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: '#3a3f55', flexShrink: 0 }}>
                      {`// ${group.label}`}
                    </span>
                    <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                    {groupUnread > 0 && (
                      <span style={{
                        fontFamily: MONO, fontSize: 8, letterSpacing: '0.1em', fontWeight: 700,
                        background: '#ef4444', color: '#fff',
                        padding: '2px 7px', borderRadius: 8,
                      }}>
                        {groupUnread} sin leer
                      </span>
                    )}
                  </div>

                  {/* Notifications */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {group.items.map(n => (
                      <div
                        key={n.id}
                        style={{
                          background: CARD,
                          border: `1px solid ${BORDER}`,
                          borderLeft: n.urgente
                            ? `3px solid ${n.read ? 'rgba(212,175,55,0.35)' : GOLD}`
                            : '3px solid transparent',
                          borderRadius: 8,
                          padding: '14px 18px',
                          opacity: n.read ? 0.6 : 1,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          {/* Unread dot */}
                          <span style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                            background: n.read ? 'transparent' : GREEN,
                            border: n.read ? '1px solid rgba(255,255,255,0.1)' : 'none',
                          }} />
                          <TypeIcon type={n.type} />
                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: MONO, fontSize: 12, color: n.read ? DIM : TEXT, fontWeight: n.read ? 400 : 600 }}>
                                  {n.title}
                                </span>
                                {n.urgente && (
                                  <span style={{
                                    fontFamily: MONO, fontSize: 8, letterSpacing: '0.12em',
                                    color: n.read ? 'rgba(212,175,55,0.4)' : GOLD,
                                    border: `1px solid ${n.read ? 'rgba(212,175,55,0.2)' : GOLD + '44'}`,
                                    padding: '1px 5px',
                                  }}>URGENTE</span>
                                )}
                              </div>
                              <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
                                {fmtTime(n.created_at)}
                              </span>
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: 11, color: n.read ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: n.accion_label ? 10 : 0 }}>
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
                              >✓</button>
                            )}
                            <button
                              onClick={() => deleteNotif(n.id)}
                              title="Eliminar"
                              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = RED)}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.15)')}
                            >×</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
