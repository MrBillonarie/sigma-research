'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/app/lib/supabase'

interface Notification {
  id:         string
  title:      string
  body:       string
  type:       string
  read:       boolean
  created_at: string
}

function BellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

interface Props {
  collapsed: boolean
}

export default function NotificationBell({ collapsed }: Props) {
  const [notifs,  setNotifs]  = useState<Notification[]>([])
  const [open,    setOpen]    = useState(false)
  const [userId,  setUserId]  = useState<string | null>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const bellRef = useRef<HTMLButtonElement>(null)

  const unread = notifs.filter((n) => !n.read).length

  // Cargar usuario + notificaciones iniciales
  const loadNotifs = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setNotifs(data)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      loadNotifs(user.id)
    })
  }, [loadNotifs])

  // Suscripción realtime
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifs((prev) => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function handleBellClick() {
    if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 8, left: rect.right + 8 })
    }
    setOpen((o) => !o)
  }

  async function markRead(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  async function markAllRead() {
    if (!userId) return
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  }

  function fmtTime(s: string) {
    const diff = Date.now() - new Date(s).getTime()
    const min  = Math.floor(diff / 60_000)
    if (min < 60)  return `${min}m`
    const hrs = Math.floor(min / 60)
    if (hrs < 24)  return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  const TYPE_COLOR: Record<string, string> = {
    lp_signal: '#d4af37',
    system:    '#7a7f9a',
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={handleBellClick}
        title="Notificaciones"
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            collapsed ? 0 : 10,
          width:          '100%',
          padding:        '10px 12px',
          background:     'transparent',
          border:         'none',
          cursor:         'pointer',
          color:          open ? '#d4af37' : '#8b8fa8',
          position:       'relative',
          borderRadius:   8,
          transition:     'color 0.15s',
          fontFamily:     'var(--font-dm-mono)',
          fontSize:       14,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
        onMouseEnter={(e) => { if (!open) (e.currentTarget as HTMLElement).style.color = '#e8e9f0' }}
        onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLElement).style.color = '#8b8fa8' }}
      >
        {/* Icon + badge */}
        <span style={{ position: 'relative', flexShrink: 0 }}>
          <BellIcon size={18} />
          {unread > 0 && (
            <span style={{
              position:   'absolute',
              top:        -5,
              right:      -5,
              background: '#ef4444',
              color:      '#fff',
              fontSize:   9,
              fontWeight: 700,
              minWidth:   14,
              height:     14,
              borderRadius: 7,
              display:    'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding:    '0 3px',
              lineHeight: 1,
            }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </span>
        {!collapsed && <span>Notificaciones</span>}
      </button>

      {/* Dropdown — posicionado con fixed para evitar clipping del sidebar */}
      {open && (
        <div
          style={{
            position:   'fixed',
            top:        dropPos.top,
            left:       dropPos.left,
            width:      320,
            maxHeight:  440,
            background: '#04050a',
            border:     '1px solid #1a1d2e',
            boxShadow:  '0 8px 32px rgba(0,0,0,0.6)',
            zIndex:     9999,
            display:    'flex',
            flexDirection: 'column',
            overflow:   'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            padding:      '12px 16px',
            borderBottom: '1px solid #1a1d2e',
          }}>
            <span style={{
              fontFamily:    'var(--font-dm-mono)',
              fontSize:      10,
              letterSpacing: '0.15em',
              color:         '#d4af37',
            }}>
              NOTIFICACIONES {unread > 0 && `(${unread})`}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  fontFamily:    'var(--font-dm-mono)',
                  fontSize:      9,
                  color:         '#7a7f9a',
                  background:    'none',
                  border:        'none',
                  cursor:        'pointer',
                  letterSpacing: '0.1em',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#d4af37')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#7a7f9a')}
              >
                MARCAR TODO LEÍDO
              </button>
            )}
          </div>

          {/* Lista */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifs.length === 0 ? (
              <div style={{
                padding:    '32px 16px',
                textAlign:  'center',
                fontFamily: 'var(--font-dm-mono)',
                fontSize:   12,
                color:      '#3a3f55',
              }}>
                Sin notificaciones
              </div>
            ) : (
              notifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    display:    'block',
                    width:      '100%',
                    textAlign:  'left',
                    padding:    '12px 16px',
                    background: n.read ? 'transparent' : 'rgba(212,175,55,0.04)',
                    border:     'none',
                    borderBottom: '1px solid #1a1d2e',
                    cursor:     'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#0b0d14')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : 'rgba(212,175,55,0.04)')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Dot unread */}
                    <span style={{
                      width:        6,
                      height:       6,
                      borderRadius: 3,
                      background:   n.read ? 'transparent' : (TYPE_COLOR[n.type] ?? '#d4af37'),
                      flexShrink:   0,
                      marginTop:    5,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily:  'var(--font-dm-mono)',
                        fontSize:    11,
                        color:       n.read ? '#7a7f9a' : '#e8e9f0',
                        fontWeight:  n.read ? 400 : 600,
                        marginBottom: 3,
                        whiteSpace:  'nowrap',
                        overflow:    'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {n.title}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-dm-mono)',
                        fontSize:   10,
                        color:      '#3a3f55',
                        lineHeight: 1.5,
                        overflow:   'hidden',
                        display:    '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {n.body}
                      </div>
                      <div style={{
                        fontFamily:    'var(--font-dm-mono)',
                        fontSize:      9,
                        color:         '#3a3f55',
                        marginTop:     4,
                        letterSpacing: '0.05em',
                      }}>
                        {fmtTime(n.created_at)}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
