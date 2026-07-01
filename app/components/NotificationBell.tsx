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

// ─── SVG Type Icons ───────────────────────────────────────────────────────────
function TypeIcon({ type, size = 20 }: { type: string; size?: number }) {
  const inner = Math.round(size * 0.58)
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

// ─── Bell Icon ────────────────────────────────────────────────────────────────
function BellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
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

// ─── Toast Item (manages its own countdown + hover-pause) ────────────────────
function ToastItem({ t, onDismiss, onNavigate }: {
  t:          Toast
  onDismiss:  (id: string) => void
  onNavigate: (href: string) => void
}) {
  const [paused, setPaused]   = useState(false)
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remainingRef = useRef(6000)
  const startRef     = useRef(Date.now())
  const dismissRef   = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    startRef.current   = Date.now()
    timeoutRef.current = setTimeout(() => dismissRef.current(t.id), 6000)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [t.id])

  function handleEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startRef.current))
    setPaused(true)
  }

  function handleLeave() {
    startRef.current   = Date.now()
    timeoutRef.current = setTimeout(() => dismissRef.current(t.id), remainingRef.current)
    setPaused(false)
  }

  const isRed       = t.notif.type === 'mercado' || t.notif.body?.toLowerCase().includes('sl') || t.notif.body?.toLowerCase().includes('vix')
  const accentColor = isRed ? '#f87171' : '#d4af37'

  return (
    <div
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        width: 320, background: '#0f0f0f', position: 'relative', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: `3px solid ${accentColor}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        animation: 'sigma-toast-in 0.2s ease-out',
      }}
    >
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <TypeIcon type={t.notif.type} size={18} />
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#e8e9f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 185 }}>
              {t.notif.title}
            </span>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            style={{ background: 'none', border: 'none', color: '#3a3f55', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 8, flexShrink: 0 }}
          >×</button>
        </div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#7a7f9a', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
          {t.notif.body}
        </div>
        {t.notif.accion_href && t.notif.accion_label && (
          <button
            onClick={() => { onDismiss(t.id); onNavigate(t.notif.accion_href!) }}
            style={{ marginTop: 8, fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: accentColor, background: 'none', border: `1px solid ${accentColor}44`, padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.1em' }}
          >
            {t.notif.accion_label} →
          </button>
        )}
      </div>
      {/* Progress bar countdown */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, height: 2,
        background: accentColor,
        animation: 'sigma-progress 6s linear forwards',
        animationPlayState: paused ? 'paused' : 'running',
      }} />
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <pre style={{
        fontFamily: 'var(--font-dm-mono,monospace)', fontSize: 9,
        color: '#1e2235', lineHeight: 1.65, margin: 0, letterSpacing: '0.04em',
      }}>{`┌─── SIGMA NOTIFY ───┐
│  status : standby  │
│  queue  : empty    │
│  > awaiting_       │
└────────────────────┘`}</pre>
      <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#2a2f45', letterSpacing: '0.12em' }}>
        SIN NOTIFICACIONES
      </span>
    </div>
  )
}

interface Props { collapsed: boolean }

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NotificationBell({ collapsed }: Props) {
  const router = useRouter()
  const [notifs,  setNotifs]  = useState<Notification[]>([])
  const [open,    setOpen]    = useState(false)
  const [visible, setVisible] = useState(false)
  const [userId,  setUserId]  = useState<string | null>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const [toasts,  setToasts]  = useState<Toast[]>([])
  const bellRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const unread  = notifs.filter(n => !n.read).length
  const pinned  = notifs.filter(n => n.urgente)
  const regular = notifs.filter(n => !n.urgente)

  // Inject keyframes once into document head
  useEffect(() => {
    if (document.getElementById('sigma-notif-styles')) return
    const style = document.createElement('style')
    style.id = 'sigma-notif-styles'
    style.textContent = `
      @keyframes sigma-toast-in {
        from { opacity: 0; transform: translateX(16px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes sigma-progress {
        from { width: 100%; }
        to   { width: 0%; }
      }
    `
    document.head.appendChild(style)
  }, [])

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
      fetch('/api/notifications/sync-macro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      }).catch(() => {})
    })
  }, [loadNotifs])

  // Realtime subscription
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
        if (n.urgente) {
          const tid = n.id + Date.now()
          setToasts(prev => [...prev, { id: tid, notif: n }])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      const target = e.target as Node
      if (bellRef.current?.contains(target)) return
      if (dropRef.current?.contains(target)) return
      closeDropdown()
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function closeDropdown() {
    setVisible(false)
    setTimeout(() => setOpen(false), 150)
  }

  function handleBellClick() {
    if (open) { closeDropdown(); return }
    if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 8, left: rect.right + 8 })
    }
    setOpen(true)
    setTimeout(() => setVisible(true), 10)
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

  async function archivePinned(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
  }

  async function handleNotifClick(n: Notification) {
    if (!n.read) await markRead(n.id)
    if (n.accion_href) {
      closeDropdown()
      router.push(n.accion_href.startsWith('/') ? n.accion_href : '/home')
    }
  }

  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  function handleNavigate(href: string) {
    router.push(href.startsWith('/') ? href : '/home')
  }

  return (
    <>
      {/* ── Toast stack ── */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'all' }}>
            <ToastItem t={t} onDismiss={dismissToast} onNavigate={handleNavigate} />
          </div>
        ))}
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
                position: 'absolute', top: -6, right: -6,
                background: '#ef4444', color: '#fff',
                fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1,
                boxShadow: '0 0 0 2px #0b0d14',
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          {!collapsed && <span>Notificaciones</span>}
        </button>

        {/* ── Dropdown (portal) ── */}
        {open && createPortal(
          <div ref={dropRef} style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left,
            width: 344, maxHeight: 520, background: '#0f0f0f',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.97)',
            transition: 'opacity 0.15s ease, transform 0.15s ease',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, letterSpacing: '0.15em', color: '#d4af37' }}>
                NOTIFICACIONES{unread > 0 ? ` · ${unread} sin leer` : ''}
              </span>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#7a7f9a', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.08em' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#d4af37')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#7a7f9a')}
                >LEER TODO</button>
              )}
            </div>

            {/* Scrollable list */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifs.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  {/* ── Pinned urgentes ── */}
                  {pinned.length > 0 && (
                    <>
                      <div style={{ padding: '7px 14px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, letterSpacing: '0.18em', color: '#d4af37' }}>{'// URGENTES'}</span>
                        <span style={{ flex: 1, height: 1, background: 'rgba(212,175,55,0.18)' }} />
                        {pinned.filter(n => !n.read).length > 0 && (
                          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: 'rgba(212,175,55,0.55)' }}>
                            {pinned.filter(n => !n.read).length} sin leer
                          </span>
                        )}
                      </div>
                      {pinned.map(n => (
                        <div key={n.id} style={{
                          padding: '10px 14px',
                          background: n.read ? 'transparent' : 'rgba(212,175,55,0.04)',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          borderLeft: `2px solid ${n.read ? 'rgba(212,175,55,0.25)' : '#d4af37'}`,
                          transition: 'background 0.12s',
                        }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0b0d14')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : 'rgba(212,175,55,0.04)')}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 3, background: n.read ? 'transparent' : '#22c55e', flexShrink: 0, marginTop: 7 }} />
                            <TypeIcon type={n.type} size={20} />
                            <div
                              style={{ flex: 1, minWidth: 0, cursor: n.accion_href ? 'pointer' : 'default' }}
                              onClick={() => handleNotifClick(n)}
                            >
                              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: n.read ? '#7a7f9a' : '#e8e9f0', fontWeight: n.read ? 400 : 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {n.title}
                              </div>
                              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#3a3f55', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                                {n.body}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#3a3f55' }}>{fmtTime(n.created_at)}</span>
                                {n.accion_label && <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#d4af37', letterSpacing: '0.08em' }}>{n.accion_label} →</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => archivePinned(n.id)}
                              title="Archivar"
                              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#3a3f55', cursor: 'pointer', fontSize: 8, fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.08em', padding: '2px 6px', flexShrink: 0 }}
                              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#f87171'; el.style.borderColor = 'rgba(248,113,113,0.4)' }}
                              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#3a3f55'; el.style.borderColor = 'rgba(255,255,255,0.08)' }}
                            >ARCH</button>
                          </div>
                        </div>
                      ))}
                      {regular.length > 0 && (
                        <div style={{ padding: '7px 14px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, letterSpacing: '0.18em', color: '#3a3f55' }}>{'// RECIENTES'}</span>
                          <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Regular notifications ── */}
                  {regular.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '11px 14px',
                        background: n.read ? 'transparent' : 'rgba(255,255,255,0.02)',
                        border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
                        borderLeft: '2px solid transparent',
                        cursor: n.accion_href ? 'pointer' : 'default', transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0b0d14')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : 'rgba(255,255,255,0.02)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: n.read ? 'transparent' : '#22c55e', flexShrink: 0, marginTop: 7 }} />
                        <TypeIcon type={n.type} size={20} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: n.read ? '#7a7f9a' : '#e8e9f0', fontWeight: n.read ? 400 : 600, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {n.title}
                          </div>
                          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#3a3f55', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
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
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '9px 14px', flexShrink: 0 }}>
              <button
                onClick={() => { closeDropdown(); setTimeout(() => router.push('/notificaciones'), 150) }}
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
