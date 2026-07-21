'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { C, F } from '@/app/lib/constants'
import NotifDial, { DialPoint, DialChannel } from './NotifDial'

// La página usaba su propia paleta hardcodeada (#04050a / #0f0f0f) y quedó fuera
// del rebrand Cyan Deck. Ahora se apoya en los tokens compartidos.
const MONO = F.mono
const DISP = F.display

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

// Señal en vivo del motor — mismo feed que alimenta el HUD (/api/public del engine)
interface MotorSignal {
  sym?: string; tf?: string; strategy?: string; type?: string; grade?: string
  price?: number; sl?: number; tp?: number; wr?: number; cagr?: number
  recommendation?: string; reason?: string; signal?: boolean
  val_confidence?: string; has_open_trade?: boolean
}

// ─── Clasificación ────────────────────────────────────────────────────────────
// fire_daily_digest (cron proactivo) cae en el mismo balde visual que 'fire'
// (notificaciones reactivas al completar retos). lp_signal comparte canal con
// 'señal' — antes el filtro hacía match exacto y caía sólo en "Todas".
const matchesType = (n: Notification, key: string) =>
  key === 'fire'  ? (n.type === 'fire' || n.type === 'fire_daily_digest')
: key === 'señal' ? (n.type === 'señal' || n.type === 'lp_signal')
: n.type === key

function channelOf(type: string): DialChannel {
  if (type === 'señal' || type === 'lp_signal')            return 'señal'
  if (type === 'fire'  || type === 'fire_daily_digest')    return 'fire'
  if (type === 'mercado')                                  return 'mercado'
  return 'otro'
}

// El motor marca las operaciones con dinero real en el cuerpo del aviso
// (ver app/api/cron/motor-senales). Es el dato que más importa de un vistazo.
const isRealMoney = (n: Notification) =>
  /DINERO REAL/i.test(n.body) || /·\s*REAL\b/i.test(n.title)

// ─── SVG Type Icons ───────────────────────────────────────────────────────────
function TypeIcon({ type, size = 26 }: { type: string; size?: number }) {
  const inner = Math.round(size * 0.5)
  function wrap(bg: string, color: string, paths: React.ReactNode) {
    return (
      <span style={{
        width: size, height: size, borderRadius: 6, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: bg,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 3px rgba(0,0,0,0.4)',
      }}>
        <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none"
          stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {paths}
        </svg>
      </span>
    )
  }

  if (type === 'señal' || type === 'lp_signal')
    return wrap('linear-gradient(160deg,#6ff0f5,#16797d)', '#04121a', <>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </>)

  if (type === 'mercado')
    return wrap('linear-gradient(160deg,#69a4ff,#1a3a86)', '#f2f6ff', <>
      <polyline points="3 18 9 12 13 16 21 8" />
    </>)

  if (type === 'portfolio')
    return wrap('linear-gradient(160deg,#5ce6b0,#137a58)', '#04140e', <>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>)

  if (type === 'reporte')
    return wrap('linear-gradient(160deg,#bda6ff,#5b3fb0)', '#0d0820', <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>)

  if (type === 'soporte')
    return wrap('linear-gradient(160deg,#ffd75e,#a67a06)', '#1a1300', <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>)

  if (type === 'fire' || type === 'fire_daily_digest')
    return (
      <span style={{
        width: size, height: size, borderRadius: 6, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg,#ff9a4d,#b2380a)', fontSize: inner,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -2px 3px rgba(0,0,0,0.4)',
      }}>🔥</span>
    )

  return wrap('linear-gradient(160deg,#39404f,#191d27)', '#9aa2b8', <>
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

const hhmm = (s: string) => {
  const d = new Date(s)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
  fire:      'FIRE',
}

const EDGE = 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -2px 0 rgba(0,0,0,0.35)'

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NotificacionesPage() {
  const router = useRouter()
  const [notifs,  setNotifs]  = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [userId,  setUserId]  = useState<string | null>(null)
  const [filter,  setFilter]  = useState('all')
  const [signals, setSignals] = useState<MotorSignal[]>([])
  const [gated,   setGated]   = useState(false)  // plan free: el server ya quitó E/SL/TP

  // Señales en vivo del motor (mismo origen que el HUD) — refresh cada 60s
  useEffect(() => {
    let dead = false
    async function loadSignals() {
      try {
        const r = await fetch('/api/vps/signals', { cache: 'no-store' })
        if (!r.ok) return
        const d = await r.json()
        if (!dead && Array.isArray(d?.signals)) {
          setSignals(d.signals.filter((s: MotorSignal) => s.signal))
          setGated(d?.gated === true)
        }
      } catch {}
    }
    loadSignals()
    const id = setInterval(loadSignals, 60_000)
    return () => { dead = true; clearInterval(id) }
  }, [])

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

  const filtered = filter === 'all' ? notifs : notifs.filter(n => matchesType(n, filter))
  const unread   = notifs.filter(n => !n.read).length
  const groups   = groupByDate(filtered)

  // ── Lecturas del instrumento — todas derivadas de datos reales ──────────────
  const dial = useMemo<DialPoint[]>(() => {
    const cutoff = Date.now() - 24 * 3600 * 1000
    return notifs
      .filter(n => new Date(n.created_at).getTime() >= cutoff)
      .map(n => {
        const d = new Date(n.created_at)
        return {
          hour:    d.getHours() + d.getMinutes() / 60,
          channel: channelOf(n.type),
          unread:  !n.read,
          real:    isRealMoney(n),
        }
      })
  }, [notifs])

  const stats = useMemo(() => {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const today = notifs.filter(n => new Date(n.created_at).getTime() >= startOfDay.getTime())
    const perCh = (ch: DialChannel) => notifs.filter(n => channelOf(n.type) === ch && !n.read).length
    return {
      unread,
      señalesHoy: today.filter(n => channelOf(n.type) === 'señal').length,
      realHoy:    today.filter(isRealMoney).length,
      ultima:     notifs.length > 0 ? fmtTime(notifs[0].created_at).replace('hace ', '') : '—',
      señal:   perCh('señal'),
      fire:    perCh('fire'),
      mercado: perCh('mercado'),
    }
  }, [notifs, unread])

  if (loading && !userId) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.2em', color: C.muted }}>CARGANDO…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: MONO }}>
      <style>{`
        @keyframes nd-blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .nd-row { transition: background 0.15s }
        .nd-row:hover { background: rgba(255,255,255,0.022) }
        .nd-scroll { overflow-x: auto }
        .nd-btn:hover { background: rgba(57,226,230,0.14) !important }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important } }
      `}</style>

      <div style={{ maxWidth: 940, margin: '0 auto', padding: '72px 24px 80px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.muted, marginBottom: 7 }}>
              {'// HISTORIAL · COMPLETO'}
            </div>
            <h1 style={{ fontFamily: DISP, fontSize: 'clamp(34px,5vw,54px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
              <span style={{ color: C.text }}>NOTIFI</span>
              <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CACIONES</span>
            </h1>
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="nd-btn"
              style={{
                fontFamily: MONO, fontSize: 10, color: C.gold, letterSpacing: '0.1em',
                background: 'linear-gradient(180deg,rgba(57,226,230,0.13),rgba(57,226,230,0.03))',
                border: `1px solid ${C.gold}44`, borderRadius: 7, padding: '8px 16px', cursor: 'pointer',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 6px rgba(0,0,0,0.4)',
              }}
            >
              MARCAR TODAS COMO LEÍDAS ({unread})
            </button>
          )}
        </div>

        {/* ── Instrumento: esfera de 24 h + canales ── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', borderRadius: 13, overflow: 'hidden', marginBottom: 18,
          border: `1px solid ${C.border2}`,
          background: `linear-gradient(140deg,${C.surface},#07090e)`,
          boxShadow: `0 18px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}>
          <div style={{ padding: 14, background: 'radial-gradient(circle at 50% 50%, rgba(57,226,230,0.055), transparent 70%)' }}>
            <NotifDial points={dial} size={132} />
          </div>
          <div style={{
            flex: 1, minWidth: 236, padding: '18px 20px', borderLeft: `1px solid ${C.border}`,
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: DISP, fontSize: 32, lineHeight: 0.85, color: C.gold,
                fontVariantNumeric: 'tabular-nums', textShadow: '0 0 22px rgba(57,226,230,0.3)',
              }}>{unread}</span>
              <span style={{ fontSize: 9, letterSpacing: '0.2em', color: C.muted }}>SIN LEER</span>
              <span style={{ flex: 1 }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 9, letterSpacing: '0.12em', color: C.green }}>
                <i style={{
                  width: 6, height: 6, borderRadius: '50%', background: C.green,
                  boxShadow: `0 0 8px ${C.green}`, animation: 'nd-blink 1.8s infinite',
                }} />
                EN LÍNEA
              </span>
            </div>
            {([
              ['SEÑALES', C.gold,  stats.señal],
              ['FIRE',    C.amber, stats.fire],
              ['MERCADO', C.blue,  stats.mercado],
            ] as const).map(([nm, col, ct]) => (
              <div key={nm} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 9.5, letterSpacing: '0.08em' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: ct > 0 ? col : '#252b38', boxShadow: ct > 0 ? `0 0 8px ${col}` : 'none' }} />
                <span style={{ flex: 1, color: ct > 0 ? C.textDim : '#3a4152' }}>{nm}</span>
                <span style={{ width: 56, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <i style={{ display: 'block', height: '100%', width: `${Math.min(100, ct * 26)}%`, background: col }} />
                </span>
                <span style={{ width: 16, textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: ct > 0 ? C.text : '#3a4152' }}>{ct}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Medidores ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(112px,1fr))', gap: 1,
          background: C.border, border: `1px solid ${C.border}`, borderRadius: 10,
          overflow: 'hidden', marginBottom: 18,
        }}>
          {([
            ['SIN LEER',    String(stats.unread),     C.gold,  Math.min(100, stats.unread * 12)],
            ['SEÑALES HOY', String(stats.señalesHoy), C.green, Math.min(100, stats.señalesHoy * 8)],
            ['DINERO REAL', String(stats.realHoy),    C.amber, Math.min(100, stats.realHoy * 25)],
            ['ÚLTIMA',      stats.ultima,             C.text,  12],
          ] as const).map(([lbl, val, col, pct]) => (
            <div key={lbl} style={{
              background: `linear-gradient(180deg,${C.surface2},#0b0e15)`, padding: '12px 14px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.045), inset 0 -2px 4px rgba(0,0,0,0.45)',
            }}>
              <div style={{ fontSize: 8, letterSpacing: '0.2em', color: C.muted, marginBottom: 6 }}>{lbl}</div>
              <div style={{
                fontFamily: DISP, fontSize: val.length > 3 ? 22 : 29, lineHeight: 1, color: col,
                fontVariantNumeric: 'tabular-nums',
                textShadow: '0 2px 6px rgba(0,0,0,0.7), 0 -1px 0 rgba(255,255,255,0.12)',
              }}>{val}</div>
              <div style={{ height: 2, marginTop: 8, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <i style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 2, background: col }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Canales ── */}
        {/* Los canales sin actividad se muestran con su cero en lugar de esconderse:
            un 0 explícito informa, una pestaña que decepciona al abrirla no. */}
        <div className="nd-scroll">
          <div style={{
            display: 'flex', marginBottom: 2, borderRadius: '8px 8px 0 0', overflow: 'hidden',
            minWidth: 'min-content', border: `1px solid ${C.border}`, borderBottom: 'none', background: '#080a10',
          }}>
            {Object.entries(TYPE_LABELS).map(([key, label]) => {
              const total  = key === 'all' ? notifs.length : notifs.filter(n => matchesType(n, key)).length
              const unrd   = key === 'all' ? unread        : notifs.filter(n => matchesType(n, key) && !n.read).length
              const active = filter === key
              const zero   = total === 0
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    flex: 1, fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', padding: '9px 10px',
                    textAlign: 'center', whiteSpace: 'nowrap', position: 'relative', cursor: 'pointer',
                    borderRight: `1px solid ${C.border}`, borderTop: 'none', borderBottom: 'none', borderLeft: 'none',
                    color: active ? C.gold : zero ? '#39404f' : C.textDim,
                    background: active ? 'linear-gradient(180deg,rgba(57,226,230,0.14),transparent)' : 'transparent',
                  }}
                >
                  <span style={{
                    display: 'block', fontFamily: DISP, fontSize: 17, lineHeight: 1, marginBottom: 3,
                    fontVariantNumeric: 'tabular-nums',
                    color: active ? C.gold : zero ? '#262c39' : C.text,
                  }}>{total}</span>
                  {label.toUpperCase()}
                  {unrd > 0 && (
                    <span style={{
                      position: 'absolute', top: 5, right: 7, width: 5, height: 5, borderRadius: '50%',
                      background: C.red, boxShadow: '0 0 7px rgba(255,93,108,0.8)',
                    }} />
                  )}
                  {active && (
                    <span style={{
                      position: 'absolute', left: 0, right: 0, bottom: 0, height: 2,
                      background: C.gold, boxShadow: `0 0 10px ${C.gold}`,
                    }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Señales del motor (live, mismo feed del HUD) ── */}
        {(filter === 'all' || filter === 'señal') && signals.length > 0 && (
          <div style={{
            border: `1px solid ${C.border}`, borderBottom: 'none', padding: '16px 14px 18px',
            background: 'linear-gradient(180deg,rgba(47,211,154,0.04),transparent)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}`, animation: 'nd-blink 1.6s infinite', flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.22em', color: C.textDim }}>
                {'// SEÑALES DEL MOTOR · LIVE'}
              </span>
              <span style={{ flex: 1, height: 1, background: 'rgba(47,211,154,0.18)' }} />
              <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>{signals.length} activas</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
              {signals.map((s, i) => {
                const isLong = (s.type ?? '') !== 'short'
                const dirC   = isLong ? C.green : C.red
                const gc     = s.grade === 'A+' ? '#ffd700' : s.grade === 'A' ? C.green : s.grade === 'B' ? C.blue : C.muted
                return (
                  <div key={`${s.sym}-${s.tf}-${i}`} style={{
                    background: `linear-gradient(170deg,${C.surface2},#0a0d13 70%)`,
                    border: `1px solid ${C.border}`, borderLeft: `3px solid ${dirC}`,
                    borderRadius: 9, padding: '12px 14px', boxShadow: `0 6px 20px rgba(0,0,0,0.45), ${EDGE}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: dirC, background: `${dirC}1a`, padding: '1px 6px', borderRadius: 2, letterSpacing: '0.08em' }}>
                          {isLong ? 'LONG' : 'SHORT'}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, fontWeight: 600 }}>{s.sym}</span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>{s.tf?.toUpperCase()}</span>
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: gc, background: `${gc}20`, border: `1px solid ${gc}40`, padding: '1px 6px', borderRadius: 2 }}>
                        {s.grade ?? '?'}
                      </span>
                    </div>
                    {s.strategy && (
                      <div style={{ fontFamily: MONO, fontSize: 9, color: C.gold, letterSpacing: '0.05em', marginBottom: 6 }}>
                        {s.strategy}
                      </div>
                    )}
                    {gated ? (
                      /* Plan free — el server quitó E/SL/TP; el blur va sobre
                         placeholders decorativos, nunca sobre datos reales */
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span aria-hidden style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none' }}>
                          E 00000 · SL 00000 · TP 00000
                        </span>
                        <a href="/planes" style={{
                          fontFamily: MONO, fontSize: 8, letterSpacing: '0.1em', whiteSpace: 'nowrap',
                          color: C.amber, border: `1px solid ${C.amber}59`, borderRadius: 3,
                          padding: '2px 7px', textDecoration: 'none',
                        }}>
                          🔒 SEÑAL COMPLETA · PRO
                        </a>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
                        {s.price != null && <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDim }}>E <span style={{ color: C.text }}>{s.price}</span></span>}
                        {s.sl    != null && <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDim }}>SL <span style={{ color: C.red }}>{s.sl}</span></span>}
                        {s.tp    != null && <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDim }}>TP <span style={{ color: C.green }}>{s.tp}</span></span>}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                      {s.wr   != null && <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>WR <span style={{ color: C.textDim }}>{s.wr.toFixed(0)}%</span></span>}
                      {s.cagr != null && <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>CAGR <span style={{ color: s.cagr >= 0 ? C.green : C.red }}>{s.cagr >= 0 ? '+' : ''}{s.cagr.toFixed(1)}%</span></span>}
                      {s.val_confidence && <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>CONF <span style={{ color: s.val_confidence === 'ALTA' ? C.green : C.gold }}>{s.val_confidence}</span></span>}
                      {s.has_open_trade && (
                        <span style={{ fontFamily: MONO, fontSize: 8, color: C.gold, border: `1px solid ${C.gold}44`, padding: '1px 5px', borderRadius: 2, letterSpacing: '0.1em' }}>ABIERTA</span>
                      )}
                    </div>
                    <button
                      onClick={() => router.push('/hud')}
                      className="nd-btn"
                      style={{ marginTop: 10, fontFamily: MONO, fontSize: 9, color: C.gold, background: 'rgba(57,226,230,0.06)', border: `1px solid ${C.gold}33`, borderRadius: 4, padding: '3px 10px', cursor: 'pointer', letterSpacing: '0.08em' }}
                    >
                      VER EN HUD →
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Manifiesto ── */}
        <div style={{
          border: `1px solid ${C.border}`, borderRadius: '0 0 10px 10px', overflow: 'hidden',
          boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
        }}>
          {/* Cabecera de columnas — los anchos coinciden con los de cada fila */}
          <div style={{
            display: 'flex', gap: 12, fontSize: 8, letterSpacing: '0.2em', color: C.muted,
            padding: '8px 14px 8px 17px', background: '#0a0d13', borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{ width: 42, flexShrink: 0 }}>HORA</span>
            <span style={{ width: 26, flexShrink: 0 }}>CNL</span>
            <span style={{ flex: 1 }}>EVENTO</span>
            <span style={{ width: 52, textAlign: 'right', flexShrink: 0 }}>EDAD</span>
          </div>

          {loading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: '0.12em' }}>
              CARGANDO…
            </div>
          ) : filtered.length === 0 ? (
            (filter === 'all' || filter === 'señal') && signals.length > 0 ? (
              <div style={{ padding: '22px 0', fontFamily: MONO, fontSize: 10, color: '#2a3040', letterSpacing: '0.12em', textAlign: 'center' }}>
                SIN NOTIFICACIONES HISTÓRICAS
              </div>
            ) : (
              <div style={{ padding: '54px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <pre style={{
                  fontFamily: MONO, fontSize: 10.5, color: '#1e2433', lineHeight: 1.65,
                  margin: 0, letterSpacing: '0.04em', textAlign: 'left',
                }}>{`> SIGMA NOTIFICATION ENGINE
> estado   : en espera
> canal    : ${filter === 'all' ? 'todos' : TYPE_LABELS[filter]?.toLowerCase()}
> en cola  : 0`}</pre>
                <span style={{ fontFamily: MONO, fontSize: 11, color: '#2a3040', letterSpacing: '0.15em' }}>
                  {filter === 'all' ? 'SIN NOTIFICACIONES' : `NADA EN ${TYPE_LABELS[filter]?.toUpperCase()}`}
                </span>
              </div>
            )
          ) : (
            groups.map(group => {
              const groupUnread = group.items.filter(n => !n.read).length
              const isToday = group.label === 'HOY'
              return (
                <div key={group.label}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', padding: '7px 14px 7px 17px',
                    fontSize: 8.5, letterSpacing: '0.24em',
                    color: isToday ? C.gold : C.muted,
                    background: isToday
                      ? 'linear-gradient(90deg,rgba(57,226,230,0.1),transparent)'
                      : 'linear-gradient(90deg,rgba(255,255,255,0.045),transparent)',
                    borderBottom: `1px solid ${isToday ? 'rgba(57,226,230,0.16)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                    <span>{group.label}</span>
                    <span style={{ letterSpacing: '0.1em', color: groupUnread > 0 ? C.red : C.muted }}>
                      {groupUnread > 0 ? `${groupUnread} SIN LEER` : 'TODO LEÍDO'}
                    </span>
                  </div>

                  {group.items.map(n => {
                    const real = isRealMoney(n)
                    // Riel de severidad: el estado se codifica en forma y posición,
                    // no sólo en el color del texto.
                    const rail = n.read ? null
                      : real       ? C.green
                      : n.urgente  ? C.amber
                      : C.glow
                    const tint = n.read ? 'transparent'
                      : real       ? 'linear-gradient(90deg,rgba(47,211,154,0.055),transparent 45%)'
                      : n.urgente  ? 'linear-gradient(90deg,rgba(255,180,84,0.05),transparent 45%)'
                      : 'linear-gradient(90deg,rgba(57,226,230,0.05),transparent 45%)'
                    return (
                      <div
                        key={n.id}
                        className="nd-row"
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative',
                          padding: '13px 14px 13px 17px',
                          borderBottom: '1px solid rgba(255,255,255,0.045)',
                          background: tint,
                          opacity: n.read ? 0.52 : 1,
                        }}
                      >
                        {rail && (
                          <span style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                            background: `linear-gradient(180deg,${rail},${rail}40)`,
                            boxShadow: `0 0 12px ${rail}80`,
                          }} />
                        )}
                        <span style={{
                          width: 42, flexShrink: 0, fontSize: 9.5, color: C.muted,
                          paddingTop: 4, fontVariantNumeric: 'tabular-nums',
                        }}>{hhmm(n.created_at)}</span>

                        <span style={{ filter: n.read ? 'grayscale(0.75)' : 'none', display: 'flex' }}>
                          <TypeIcon type={n.type} />
                        </span>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: n.read ? 400 : 500, color: n.read ? C.textDim : C.text }}>
                              {n.title}
                            </span>
                            {real ? (
                              <span style={{ fontSize: 7.5, letterSpacing: '0.14em', padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap', color: C.green, border: `1px solid ${C.green}6b`, background: 'rgba(47,211,154,0.1)' }}>
                                DINERO REAL
                              </span>
                            ) : n.urgente ? (
                              <span style={{ fontSize: 7.5, letterSpacing: '0.14em', padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap', color: C.amber, border: `1px solid ${C.amber}6b`, background: 'rgba(255,180,84,0.1)' }}>
                                URGENTE
                              </span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: 10.5, color: n.read ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.56)', lineHeight: 1.65, marginTop: 4 }}>
                            {n.body}
                          </div>
                          {n.accion_label && n.accion_href && (
                            <button
                              onClick={() => handleClick(n)}
                              className="nd-btn"
                              style={{
                                marginTop: 9, fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', color: C.gold,
                                padding: '4px 11px', borderRadius: 4, cursor: 'pointer',
                                border: `1px solid ${C.gold}47`, background: 'rgba(57,226,230,0.06)',
                              }}
                            >
                              {n.accion_label} →
                            </button>
                          )}
                        </div>

                        <span style={{ width: 52, flexShrink: 0, textAlign: 'right', fontSize: 9, color: 'rgba(255,255,255,0.26)', paddingTop: 4 }}>
                          {fmtTime(n.created_at)}
                        </span>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, paddingTop: 2 }}>
                          {!n.read && (
                            <button
                              onClick={() => markRead(n.id)}
                              title="Marcar como leída"
                              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 2 }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = C.green)}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)')}
                            >✓</button>
                          )}
                          <button
                            onClick={() => deleteNotif(n.id)}
                            title="Eliminar"
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 2 }}
                            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = C.red)}
                            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.15)')}
                          >×</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
