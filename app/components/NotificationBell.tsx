'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'

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

interface Toast {
  id:    string
  notif: Notification
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function BellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function TypeIcon({ type }: { type: string }) {
  const base: React.CSSProperties = { width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }

  if (type === 'señal' || type === 'lp_signal') {
    return <span style={{ ...base, background: 'rgba(212,175,55,0.15)', color: '#d4af37' }}>▲</span>
  }
  if (type === 'mercado') {
    return <span style={{ ...base, background: 'rgba(99,179,237,0.12)', color: '#63b3ed' }}>~</span>
  }
  if (type === 'portfolio') {
    return <span style={{ ...base, background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>$</span>
  }
  if (type === 'reporte') {
    return <span style={{ ...base, background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>▣</span>
  }
  // sistema / system / default
  return <span style={{ ...base, background: 'rgba(122,127,154,0.15)', color: '#7a7f9a' }}>!</span>
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

interface Props { collapsed: boolean }

// ─── Component ────────────────────────────────────────────────────────────────
export default function NotificationBell({ collapsed }: Props) {
  const router = useRouter()
  const [notifs,  setNotifs]  = useState<Notification[]>([])
  const [open,    setOpen]    = useState(false)
  const [userId,  setUserId]  = useState<string | null>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const [toasts,  setToasts]  = useState<Toast[]>([])
  const bellRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => !n.read).length

  const loadNotifs = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setNotifs(data)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      loadNotifs(user.id)
    })
  }, [loadNotifs])

  // Real-time subscription
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const n = payload.new as Notification
        setNotifs(prev => [n, ...prev])
        // Show toast for urgent notifications
        if (n.urgente) {
          const tid = n.id + Date.now()
          setToasts(prev => [...prev, { id: tid, notif: n }])
          setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 6000)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Close on outside click (exclude both the bell button and the portal dropdown)
  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      const target = e.target as Node
      if (bellRef.current?.contains(target)) return
      if (dropRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function handleBellClick() {
    if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 8, left: rect.right + 8 })
    }
    setOpen(o => !o)
  }

  async function markRead(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  async function markAllRead() {
    if (!userId) return
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  }

  async function handleNotifClick(n: Notification) {
    if (!n.read) await markRead(n.id)
    if (n.accion_href) {
      setOpen(false)
      router.push(n.accion_href)
    }
  }

  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <>
      {/* ── Toasts (urgent real-time) ── */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
        {toasts.map(t => {
          const isRed = t.notif.type === 'mercado' || t.notif.body?.toLowerCase().includes('sl') || t.notif.body?.toLowerCase().includes('vix')
          const borderColor = isRed ? '#f87171' : '#d4af37'
          return (
            <div
              key={t.id}
              style={{ width: 320, background: '#0f0f0f', border: `1px solid rgba(255,255,255,0.08)`, borderLeft: `3px solid ${borderColor}`, padding: '12px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', pointerEvents: 'all' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#e8e9f0', fontWeight: 600 }}>{t.notif.title}</span>
                <button onClick={() => dismissToast(t.id)} style={{ background: 'none', border: 'none', color: '#3a3f55', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 8 }}>×</button>
              </div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#7a7f9a', lineHeight: 1.5 }}>{t.notif.body}</div>
              {t.notif.accion_href && t.notif.accion_label && (
                <button
                  onClick={() => { dismissToast(t.id); router.push(t.notif.accion_href!) }}
                  style={{ marginTop: 8, fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: borderColor, background: 'none', border: `1px solid ${borderColor}44`, padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.1em' }}
                >
                  {t.notif.accion_label} →
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Bell button ── */}
      <div style={{ position: 'relative' }}>
        <button
          ref={bellRef}
          onClick={handleBellClick}
          title="Notificaciones"
          style={{
            display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
            width: '100%', padding: '10px 12px', background: 'transparent',
            border: 'none', cursor: 'pointer', color: open ? '#d4af37' : '#8b8fa8',
            position: 'relative', borderRadius: 8, transition: 'color 0.15s',
            fontFamily: 'var(--font-dm-mono)', fontSize: 14,
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
          onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.color = '#e8e9f0' }}
          onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.color = '#8b8fa8' }}
        >
          <span style={{ position: 'relative', flexShrink: 0 }}>
            <BellIcon size={18} />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff',
                fontSize: 9, fontWeight: 700, minWidth: 14, height: 14, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1,
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          {!collapsed && <span>Notificaciones</span>}
        </button>

        {/* ── Dropdown (portal → body para evitar stacking context del sidebar) ── */}
        {open && createPortal(
          <div ref={dropRef} style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left,
            width: 340, maxHeight: 480, background: '#0f0f0f',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, letterSpacing: '0.15em', color: '#d4af37' }}>
                NOTIFICACIONES {unread > 0 && `· ${unread} sin leer`}
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                {unread > 0 && (
                  <button onClick={markAllRead} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#7a7f9a', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.08em' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#d4af37')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#7a7f9a')}
                  >
                    LEER TODO
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifs.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 24, color: '#1a1d2e', marginBottom: 8 }}>🔔</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 12, color: '#3a3f55' }}>Sin notificaciones</div>
                </div>
              ) : (
                notifs.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '11px 14px', background: n.urgente && !n.read ? 'rgba(245,200,66,0.05)' : n.read ? 'transparent' : 'rgba(255,255,255,0.02)',
                      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
                      borderLeft: n.urgente ? '2px solid #F5C842' : '2px solid transparent',
                      cursor: n.accion_href ? 'pointer' : 'default', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0b0d14')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = n.urgente && !n.read ? 'rgba(245,200,66,0.05)' : n.read ? 'transparent' : 'rgba(255,255,255,0.02)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      {/* Unread dot */}
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: n.read ? 'transparent' : '#22c55e', flexShrink: 0, marginTop: 7 }} />
                      {/* Type icon */}
                      <TypeIcon type={n.type} />
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: n.read ? '#7a7f9a' : '#e8e9f0', fontWeight: n.read ? 400 : 600, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {n.title}
                        </div>
                        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#3a3f55', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {n.body}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
                          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#3a3f55', letterSpacing: '0.05em' }}>
                            {fmtTime(n.created_at)}
                          </span>
                          {n.accion_label && (
                            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#d4af37', letterSpacing: '0.08em' }}>
                              {n.accion_label} →
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '9px 14px' }}>
              <button
                onClick={() => { setOpen(false); router.push('/notificaciones') }}
                style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#7a7f9a', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.12em', width: '100%', textAlign: 'center' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#d4af37')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#7a7f9a')}
              >
                VER HISTORIAL COMPLETO →
              </button>
            </div>
          </div>
        , document.body)}
      </div>
    </>
  )
}
