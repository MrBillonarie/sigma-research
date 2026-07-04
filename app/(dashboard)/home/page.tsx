'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { C, cardStyle, heroCardStyle, numberEmboss } from '@/app/lib/constants'
import { supabase } from '@/app/lib/supabase'
import { useCalendarEvents } from '@/app/hooks/useCalendarEvents'

// ─── Platform config ──────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'ibkr',            name: 'IBKR',           color: '#3b82f6', isCLP: false },
  { id: 'binance_spot',    name: 'Binance Spot',    color: '#f59e0b', isCLP: false },
  { id: 'binance_futures', name: 'Binance Futures', color: '#ef4444', isCLP: false },
  { id: 'fintual',         name: 'Fintual',         color: '#8b5cf6', isCLP: true  },
  { id: 'santander',       name: 'Santander',       color: '#ec4899', isCLP: true  },
  { id: 'cash',            name: 'Cash',            color: '#6b7280', isCLP: false },
]


const TOOL_LIST = [
  { id: 'hud',        href: '/hud',        label: 'HUD',         sub: 'Vista operativa live',      key: 'H', isLive: true  },
  { id: 'terminal',   href: '/portafolio', label: 'PORTAFOLIO',  sub: 'Posiciones y plataformas',   key: 'T', isLive: true  },
  { id: 'journal',    href: '/journal',    label: 'JOURNAL',     sub: 'Registro de operaciones',    key: 'J', isLive: false },
  { id: 'montecarlo', href: '/montecarlo', label: 'MONTE CARLO', sub: 'Simulación de riesgo',       key: 'M', isLive: false },
  { id: 'fire',       href: '/fire',       label: 'FIRE',        sub: 'Libertad financiera',        key: 'F', isLive: false },
  { id: 'modelos',    href: '/modelos',    label: 'MODELOS ML',  sub: 'Análisis cuantitativo',      key: null, isLive: false },
  { id: 'reportes',   href: '/reportes',   label: 'REPORTES',    sub: 'Performance analytics',      key: null, isLive: false },
  { id: 'lp-defi',    href: '/lp-defi',    label: 'LP DEFI',     sub: 'Posiciones de liquidez',     key: 'L', isLive: true  },
  { id: 'calendario', href: '/calendario', label: 'CALENDARIO',  sub: 'Eventos macroeconómicos',    key: 'C', isLive: false },
]

const DAYS_ES   = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO']
const MONTHS_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
const TRM_DEFAULT = 950

// Curva plasma del header — mismo lenguaje visual del hero de la landing,
// pero estática: se dibuja una sola vez al entrar (sin loop) como firma de marca.
const HEADER_CURVE_PTS: number[][] = [[0,86],[70,70],[140,78],[210,50],[280,58],[350,30],[420,38],[490,12],[560,20]]
function headerCurvePath(pts: number[][]): string {
  const [sx, sy] = pts[0]
  let d = `M ${sx} ${sy}`
  for (let i = 1; i < pts.length; i++) {
    const [cx, cy] = pts[i - 1]
    const [nx, ny] = pts[i]
    const mx = (cx + nx) / 2
    d += ` C ${mx} ${cy} ${mx} ${ny} ${nx} ${ny}`
  }
  return d
}
const HEADER_CURVE_D = headerCurvePath(HEADER_CURVE_PTS)

function fmtUSD(n: number)  { return '$' + Math.round(n).toLocaleString('es-CL') }
function pct(n: number)     { return n.toFixed(1) + '%' }
function fmtDiff(n: number) { return (n >= 0 ? '+' : '') + fmtUSD(n) }
function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1)  return 'recién'
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

interface Trade {
  fecha: string; pnl_usd: number; resultado: 'WIN' | 'LOSS' | 'BREAKEVEN'; par: string; lado: 'LONG' | 'SHORT'
}
interface PassivePos { ingresoMensual: number }
type PortfolioRow = Record<string, number>

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
function Sparkline({ data, w = 64, h = 22 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const rng = max - min || 1
  const pts = data.map((v, i) => {
    const x = ((i / (data.length - 1)) * w).toFixed(1)
    const y = (h - ((v - min) / rng) * (h - 4) - 2).toFixed(1)
    return `${x},${y}`
  }).join(' ')
  const last = pts.split(' ').at(-1)!.split(',')
  const trend = data.at(-1)! >= data[0] ? C.green : C.red
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={trend} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={trend} />
    </svg>
  )
}

// ─── Mini bar chart (últimos N resultados) ────────────────────────────────────
function MiniBarChart({ data, w = 48, h = 20 }: { data: number[]; w?: number; h?: number }) {
  if (!data.length) return null
  const bw = Math.max(2, (w / data.length) - 1)
  return (
    <svg width={w} height={h} style={{ display: 'block', flexShrink: 0 }}>
      {data.map((v, i) => {
        const barH  = Math.max(2, v * (h - 2))
        const color = v === 1 ? C.green : v === 0.5 ? C.yellow : C.red
        return <rect key={i} x={i * (bw + 1)} y={h - barH} width={bw} height={barH} fill={color} rx="1" />
      })}
    </svg>
  )
}

// ─── Pulsing live dot ─────────────────────────────────────────────────────────
function LiveDot({ size = 8 }: { size?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      <span className="sp-ping" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: C.green, opacity: 0.45 }} />
      <span style={{ width: size, height: size, borderRadius: '50%', background: C.green, display: 'block' }} />
    </span>
  )
}

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────
function Sk({ w, h }: { w: number | string; h: number }) {
  return <span className="sp-shimmer" style={{ display: 'block', width: w, height: h, borderRadius: 2 }} />
}

// ─── Hero 3D — tilt + parallax por capas via CSS vars (sin re-render) ─────────
function Hero3D({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: React.MouseEvent) {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    const r  = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--px', px.toFixed(3))
    el.style.setProperty('--py', py.toFixed(3))
    el.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`)
    el.classList.add('h3d-on')
  }
  function onLeave() {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--px', '0')
    el.style.setProperty('--py', '0')
    el.classList.remove('h3d-on')
  }

  return (
    <div style={{ perspective: 800 }}>
      <div
        ref={ref}
        className="sp-fadein h3d"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ ...heroCardStyle, padding: '20px 22px', animationDelay: '0ms', position: 'relative', overflow: 'hidden' }}
      >
        <span className="h3d-shine" aria-hidden />
        {children}
      </div>
    </div>
  )
}

// ─── Mini-visual monocromo por herramienta — lenguaje del mega-menú ───────────
function ToolViz({ id }: { id: string }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const viz = (() => {
    switch (id) {
      case 'hud':        return <polyline {...s} points="1,10 5.5,10 8,4 12,16 14.5,10 19,10" />
      case 'terminal':   return <g {...s}><line x1="4" y1="17" x2="4" y2="9" /><line x1="8.5" y1="17" x2="8.5" y2="5" /><line x1="13" y1="17" x2="13" y2="11" /><line x1="17.5" y1="17" x2="17.5" y2="7" /></g>
      case 'journal':    return <g {...s}><line x1="3" y1="5" x2="13" y2="5" /><line x1="3" y1="10" x2="17" y2="10" /><line x1="3" y1="15" x2="10" y2="15" /><circle cx="16.5" cy="5" r="1.4" /></g>
      case 'montecarlo': return <g {...s}><line x1="3" y1="16" x2="17" y2="4" opacity="0.9" /><line x1="3" y1="16" x2="18" y2="8" opacity="0.65" /><line x1="3" y1="16" x2="18" y2="12" opacity="0.45" /><line x1="3" y1="16" x2="17" y2="16" opacity="0.3" /></g>
      case 'fire':       return <g {...s}><path d="M 4 16 A 7 7 0 0 1 16 9" /><line x1="10" y1="14" x2="14.5" y2="8" /><circle cx="10" cy="14" r="1.2" /></g>
      case 'modelos':    return <g {...s}><circle cx="5" cy="6" r="1.5" /><circle cx="15" cy="5" r="1.5" /><circle cx="10" cy="12" r="1.5" /><circle cx="16" cy="15" r="1.5" /><line x1="6.2" y1="7" x2="8.8" y2="11" /><line x1="13.8" y1="6" x2="11.2" y2="11" /><line x1="11.3" y1="13" x2="14.7" y2="14.5" /></g>
      case 'reportes':   return <g {...s}><rect x="4" y="3" width="12" height="14" /><line x1="7" y1="7" x2="13" y2="7" /><line x1="7" y1="10" x2="13" y2="10" /><line x1="7" y1="13" x2="11" y2="13" /></g>
      case 'lp-defi':    return <g {...s}><path d="M 10 3 C 10 3 5 9 5 12.5 A 5 5 0 0 0 15 12.5 C 15 9 10 3 10 3 Z" /></g>
      case 'calendario': return <g {...s}><rect x="3" y="4" width="14" height="13" /><line x1="3" y1="8" x2="17" y2="8" /><line x1="6.5" y1="2.5" x2="6.5" y2="5.5" /><line x1="13.5" y1="2.5" x2="13.5" y2="5.5" /><circle cx="13" cy="12.5" r="1.3" fill="currentColor" stroke="none" /></g>
      default:           return <text x="10" y="15" textAnchor="middle" fontSize="13" fill="currentColor" fontFamily="'Bebas Neue',Impact,sans-serif">Σ</text>
    }
  })()
  return (
    <span className="tviz" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 20 20">{viz}</svg>
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DashboardHome() {
  const router = useRouter()
  const { events: calendarEvents } = useCalendarEvents()

  const [portfolio,       setPortfolio]       = useState<PortfolioRow>({})
  const [positions,       setPositions]       = useState<PassivePos[]>([])
  const [trades,          setTrades]          = useState<Trade[]>([])
  const [fireTarget,      setFireTarget]      = useState<number | null>(null)
  const [fireProbability, setFireProbability] = useState<number | null>(null)
  const [activity,        setActivity]        = useState<Record<string, number>>({})
  const [storedTotal,     setStoredTotal]     = useState(0)
  const [username,        setUsername]        = useState('TRADER')
  const [perfil,          setPerfil]          = useState<'retail' | 'trader' | 'institucional'>('trader')
  const [loading,         setLoading]         = useState(true)
  const [now,             setNow]             = useState(new Date())
  const [spotlight,       setSpotlight]       = useState(false)
  const [spotQuery,       setSpotQuery]       = useState('')
  const [spotIdx,         setSpotIdx]         = useState(0)
  const [showShortcuts,   setShowShortcuts]   = useState(false)
  const [trm,             setTrm]             = useState(TRM_DEFAULT)
  const [trmLive,         setTrmLive]         = useState(false)
  const [headerDrawn,     setHeaderDrawn]     = useState(false)
  const [motorReturn,     setMotorReturn]     = useState<{ monthlyReturnPct: number; cumulativeReturnPct: number; daysActive: number } | null>(null)

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Trazo del header — se dibuja una sola vez al entrar, no en loop
  useEffect(() => {
    const t = setTimeout(() => setHeaderDrawn(true), 150)
    return () => clearTimeout(t)
  }, [])

  // TRM en vivo
  useEffect(() => {
    fetch('/api/trm')
      .then(r => r.json())
      .then(j => { if (j.clpPerUsd > 0) { setTrm(j.clpPerUsd); setTrmLive(true) } })
      .catch(() => {})
  }, [])

  // Retorno % del motor — solo el agregado, sin datos operacionales
  useEffect(() => {
    fetch('/api/motor/portfolio-return')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && typeof j.monthlyReturnPct === 'number') setMotorReturn(j) })
      .catch(() => {})
  }, [])

  // localStorage hydration
  useEffect(() => {
    try { const r = localStorage.getItem('sigma_portfolio');    if (r) setPortfolio(JSON.parse(r))    } catch {}
    try { const r = localStorage.getItem('sigma_positions');    if (r) setPositions(JSON.parse(r))    } catch {}
    try { const r = localStorage.getItem('sigma_trades');       if (r) setTrades(JSON.parse(r))       } catch {}
    try { const r = localStorage.getItem('sigma_fire_target');  if (r) setFireTarget(Number(r))       } catch {}
    try { const r = localStorage.getItem('sigma_montecarlo');   if (r) { const d = JSON.parse(r); if (d?.fireProbability) setFireProbability(d.fireProbability) } } catch {}
    try { const r = localStorage.getItem('sigma_activity');     if (r) setActivity(JSON.parse(r))     } catch {}
    try { const r = localStorage.getItem('sigma_portfolio_total'); if (r && Number(r) > 0) setStoredTotal(Number(r)) } catch {}
    setLoading(false)
  }, [])

  // Auth + Supabase fallback sync
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const uid = data.user.id

      // Nombre
      const { data: prof } = await supabase.from('profiles').select('username').eq('id', uid).maybeSingle()
      const name = prof?.username || data.user.user_metadata?.nombre || 'TRADER'
      setUsername(name.toUpperCase())
      const p = data.user.user_metadata?.perfil_trader
      if (p === 'retail' || p === 'institucional') setPerfil(p)

      // Trades — Supabase es la fuente autoritativa, siempre se consulta y
      // siempre gana sobre el caché cuando responde (igual que el fix ya
      // aplicado en usePortfolio.ts). Antes, si localStorage tenía *cualquier*
      // dato (aunque fuera viejo de otro dispositivo), Supabase nunca se
      // consultaba — Patrimonio/PnL/Win Rate/FIRE% podían quedar obsoletos
      // para siempre.
      try {
        const { data: rows } = await supabase
          .from('trades').select('fecha,pnl_usd,resultado,par,lado').eq('user_id', uid).order('fecha', { ascending: false }).limit(100)
        if (rows) {
          setTrades(rows as Trade[])
          try { localStorage.setItem('sigma_trades', JSON.stringify(rows)) } catch {}
        }
      } catch {}

      // Portfolio
      try {
        const { data: port } = await supabase.from('portfolio').select('*').eq('user_id', uid).maybeSingle()
        if (port) {
          const vals: PortfolioRow = {}
          ;['ibkr','binance_spot','binance_futures','fintual','santander','cash'].forEach((k: string) => {
            vals[k as keyof PortfolioRow] = (port as Record<string, number>)[k] ?? 0
          })
          setPortfolio(vals)
          try { localStorage.setItem('sigma_portfolio', JSON.stringify(vals)) } catch {}
        }
      } catch {}

      // Meta FIRE — misma fórmula que /fire
      try {
        const { data: prefs } = await supabase
          .from('user_preferences').select('fire_gasto_mensual, fire_completed').eq('user_id', uid).maybeSingle()
        if (prefs?.fire_completed && prefs.fire_gasto_mensual) {
          const target = (prefs.fire_gasto_mensual * 12) / 0.04
          setFireTarget(target)
          try { localStorage.setItem('sigma_fire_target', String(target)) } catch {}
        }
      } catch {}

      // Monte Carlo — última simulación guardada
      try {
        const { data: run } = await supabase
          .from('montecarlo_runs').select('prob_objetivo').eq('user_id', uid)
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (run?.prob_objetivo != null) {
          setFireProbability(run.prob_objetivo)
          try { localStorage.setItem('sigma_montecarlo', JSON.stringify({ fireProbability: run.prob_objetivo })) } catch {}
        }
      } catch {}
    })
  }, [])

  const trackActivity = useCallback((id: string) => {
    setActivity(prev => {
      const next = { ...prev, [id]: Date.now() }
      localStorage.setItem('sigma_activity', JSON.stringify(next))
      return next
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSpotlight(v => !v); setSpotQuery(''); setSpotIdx(0); return
      }
      if (e.key === 'Escape') { setSpotlight(false); setSpotQuery(''); setShowShortcuts(false); return }
      if (e.key === '?') { setShowShortcuts(v => !v); return }
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!spotlight && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool = TOOL_LIST.find(t => t.key?.toLowerCase() === e.key.toLowerCase())
        if (tool) { trackActivity(tool.id); router.push(tool.href) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [spotlight, router, trackActivity])

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const D = useMemo(() => {
    const FIRE_TARGET = fireTarget ?? 600_000
    const platformTotals = PLATFORMS.map(p => { const raw = portfolio[p.id] ?? 0; return p.isCLP ? raw / trm : raw })
    const totalUSD = platformTotals.reduce((s, v) => s + v, 0) || storedTotal
    const segments = PLATFORMS.map((p, i) => ({ ...p, usd: platformTotals[i], pct: totalUSD > 0 ? (platformTotals[i] / totalUSD) * 100 : 0 })).filter(s => s.usd > 0)
    const monthlyPassive = positions.reduce((s, p) => s + (p.ingresoMensual ?? 0), 0)

    // Fecha local del navegador, no UTC — evita que "hoy"/"este mes" se
    // corran un día para usuarios detrás de UTC en las últimas horas del día.
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const ym = todayStr.slice(0, 7)
    const sorted = [...trades].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))

    const monthTrades = trades.filter(t => t.fecha?.startsWith(ym))
    const monthPnL    = monthTrades.reduce((s, t) => s + (t.pnl_usd ?? 0), 0)
    const wins        = monthTrades.filter(t => t.resultado === 'WIN').length
    const losses      = monthTrades.filter(t => t.resultado === 'LOSS').length
    // Denominador = solo trades decisivos (WIN+LOSS) — un BREAKEVEN no es
    // una derrota, no debería arrastrar el win rate hacia abajo solo por
    // contar en el total sin contar como victoria.
    const decisive    = wins + losses
    const winRate     = decisive > 0 ? (wins / decisive) * 100 : 0

    const dailyPnL = trades.filter(t => t.fecha?.startsWith(todayStr)).reduce((s, t) => s + (t.pnl_usd ?? 0), 0)
    const dailyPct = totalUSD > 0 && dailyPnL !== 0 ? (dailyPnL / totalUSD) * 100 : 0

    const weekAgo    = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
    const weekTrades = trades.filter(t => t.fecha >= weekAgo)
    const weekPnL    = weekTrades.reduce((s, t) => s + (t.pnl_usd ?? 0), 0)
    const weekCount  = weekTrades.length

    const sparkDays: number[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000).toISOString().split('T')[0]
      sparkDays.push(trades.filter(t => t.fecha?.startsWith(d)).reduce((s, t) => s + (t.pnl_usd ?? 0), 0))
    }
    let cum = 0
    const sparkCum = sparkDays.map(v => { cum += v; return cum })

    let streak = 0
    for (const t of sorted) { if (t.resultado === 'WIN') streak++; else break }

    const bestTrade = monthTrades.reduce<Trade | null>((b, t) => (!b || t.pnl_usd > b.pnl_usd) ? t : b, null)
    const last5     = sorted.slice(0, 5)

    const firePct  = FIRE_TARGET > 0 ? Math.min((totalUSD / FIRE_TARGET) * 100, 100) : 0
    const fireGap  = Math.max(0, FIRE_TARGET - totalUSD)
    let fireYears: number | null = null
    if (monthlyPassive > 0 && fireGap > 0) {
      const r = 0.08 / 12
      fireYears = Math.ceil(Math.log(1 + (fireGap * r) / monthlyPassive) / Math.log(1 + r) / 12)
    } else if (fireGap <= 0) {
      fireYears = 0
    }

    const todayDate = now.toISOString().split('T')[0]
    // Normalizar eventos del hook al shape { date, time, title, impact }
    const mappedEvents = calendarEvents
      .filter(e => e.impact === 'HIGH')          // solo HIGH impact en home
      .map(e => ({ date: e.event_date, time: e.event_time + ' ET', title: e.title, impact: e.impact }))
    const upcoming    = mappedEvents.filter(e => e.date >= todayDate)
    const nextRaw     = upcoming[0] ?? null
    const nextEvent   = nextRaw ? {
      ...nextRaw,
      daysUntil: Math.max(0, Math.round((new Date(nextRaw.date).getTime() - new Date(todayDate).getTime()) / 86400000)),
    } : null

    // Sparkline PnL del mes (acumulado día a día)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    let cumMonth = 0
    const sparkMonthCum = Array.from({ length: Math.min(now.getDate(), daysInMonth) }, (_, i) => {
      const d = `${ym}-${String(i + 1).padStart(2, '0')}`
      cumMonth += trades.filter(t => t.fecha?.startsWith(d)).reduce((s, t) => s + (t.pnl_usd ?? 0), 0)
      return cumMonth
    })

    // Mini barras de últimos 10 resultados (para Win Rate)
    const last10Results = sorted.slice(0, 10).reverse().map(t =>
      t.resultado === 'WIN' ? 1 : t.resultado === 'BREAKEVEN' ? 0.5 : 0
    )

    return {
      totalUSD, segments, monthlyPassive, monthPnL, winRate, dailyPnL, dailyPct,
      weekPnL, weekCount, sparkCum, sparkMonthCum, last10Results, streak, bestTrade, last5,
      firePct, FIRE_TARGET, fireYears, nextEvent, upcoming: upcoming.slice(0, 5),
      monthTradesCount: monthTrades.length, totalTrades: trades.length,
    }
  }, [portfolio, positions, trades, fireTarget, now, storedTotal, trm, calendarEvents])

  // Spotlight results
  const spotResults = useMemo(() => {
    const q = spotQuery.toLowerCase()
    return q ? TOOL_LIST.filter(t => t.label.toLowerCase().includes(q) || t.sub.toLowerCase().includes(q)) : TOOL_LIST
  }, [spotQuery])

  // Prioridad por perfil: si el usuario no ha usado nada aún, mostrar según su perfil
  const PROFILE_PRIORITY = useMemo<Record<string, string[]>>(() => ({
    retail:       ['fire', 'montecarlo', 'terminal', 'calendar', 'hud', 'journal', 'lp-defi', 'reportes', 'modelos'],
    trader:       ['hud', 'journal', 'terminal', 'montecarlo', 'fire', 'calendario', 'lp-defi', 'modelos', 'reportes'],
    institucional:['motor', 'hud', 'terminal', 'journal', 'montecarlo', 'fire', 'modelos', 'reportes', 'lp-defi'],
  }), [])

  const sortedTools = useMemo(() => {
    const hasActivity = Object.keys(activity).length > 0
    if (hasActivity) {
      return [...TOOL_LIST].sort((a, b) => (activity[b.id] ?? 0) - (activity[a.id] ?? 0))
    }
    // Sin actividad: ordenar por perfil del usuario
    const priority = PROFILE_PRIORITY[perfil] ?? PROFILE_PRIORITY.trader
    return [...TOOL_LIST].sort((a, b) => {
      const ai = priority.indexOf(a.id)
      const bi = priority.indexOf(b.id)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
  }, [activity, perfil, PROFILE_PRIORITY])

  function getToolBadge(id: string): string | null {
    switch (id) {
      case 'hud':        return 'Régimen: —'
      case 'terminal':   return D.totalUSD > 0 ? 'Live: BTC · ETH · SOL' : 'Sin posiciones abiertas'
      case 'journal':    return D.weekCount > 0 ? `${D.weekCount} trades esta semana` : 'Sin trades esta semana'
      case 'montecarlo': return fireProbability !== null ? `${fireProbability}% prob. FIRE` : 'Sin simulación reciente'
      case 'fire':       return D.fireYears !== null ? (D.fireYears === 0 ? '¡Meta alcanzada!' : `~${D.fireYears} años restantes`) : 'Configura tu meta'
      case 'modelos':    return 'Modelos disponibles'
      case 'reportes':   return D.totalTrades > 0 ? `${D.totalTrades} trades analizados` : 'Sin datos'
      case 'lp-defi':    return 'Posiciones activas'
      case 'calendario': return D.nextEvent ? D.nextEvent.title.slice(0, 28) + '…' : 'Sin eventos próximos'
      default:           return null
    }
  }

  const h    = now.getHours()
  const greeting = (h < 12 ? 'BUENOS DÍAS' : h < 18 ? 'BUENAS TARDES' : 'BUENAS NOCHES') + ', ' + username
  const dateStr  = `${DAYS_ES[now.getDay()]} ${now.getDate()} · ${MONTHS_ES[now.getMonth()]} · ${now.getFullYear()}`
  const initials = username.slice(0, 2)
  const hasDailyTrades  = D.dailyPnL !== 0
  const fireConfigured  = fireTarget !== null

  return (
    <>
      {/* ── Global animations ── */}
      <style>{`
        @keyframes sp-ping    { 75%,100% { transform:scale(2.2); opacity:0 } }
        @keyframes sp-shimmer { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
        @keyframes sp-fadein  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        .sp-ping    { animation: sp-ping 1.6s cubic-bezier(0,0,.2,1) infinite }
        .sp-shimmer { background: linear-gradient(90deg,${C.border} 25%,${C.surface} 50%,${C.border} 75%); background-size:200% 100%; animation:sp-shimmer 1.4s ease infinite }
        .sp-fadein  { animation: sp-fadein .4s ease both }
        .tool-card  { transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; overflow:hidden }
        .tool-card:hover { transform:translateY(-3px); box-shadow:${C.shadowHero}; border-color:${C.gold}40 }

        /* ── Hero 3D: tilt + parallax por capas ── */
        .h3d { --px:0; --py:0; --mx:50%; --my:30%;
          transform: rotateX(calc(var(--py) * -6deg)) rotateY(calc(var(--px) * 8deg));
          transition: transform .5s ease; will-change: transform }
        .h3d.h3d-on { transition: transform .1s ease-out }
        .h3d-back  { transform: translate(calc(var(--px) * -8px), calc(var(--py) * -7px)); transition: transform .25s ease }
        .h3d-front { transform: translate(calc(var(--px) *  5px), calc(var(--py) *  4px)); transition: transform .25s ease }
        .h3d-shine { position:absolute; inset:0; pointer-events:none; opacity:0; transition:opacity .35s;
          background: radial-gradient(280px circle at var(--mx) var(--my), ${C.gold}18, transparent 65%) }
        .h3d.h3d-on .h3d-shine { opacity:1 }

        /* ── Tool cards: identidad visual ── */
        .tviz { width:36px; height:36px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
          border:1px solid ${C.border}; color:${C.dimText};
          transition: color .2s, border-color .2s, box-shadow .2s }
        .tool-card:hover .tviz { color:${C.gold}; border-color:${C.gold}55; box-shadow:0 0 14px ${C.gold}22 }
        .tool-card::before, .tool-card::after { content:''; position:absolute; width:10px; height:10px;
          opacity:.28; transition: opacity .2s, border-color .2s; pointer-events:none }
        .tool-card::before { top:7px; left:7px; border-top:1px solid ${C.gold}; border-left:1px solid ${C.gold} }
        .tool-card::after  { bottom:7px; right:7px; border-bottom:1px solid ${C.gold}; border-right:1px solid ${C.gold} }
        .tool-card:hover::before, .tool-card:hover::after { opacity:.9 }
        .tc-sweep { position:absolute; top:0; bottom:0; width:55%; left:-75%; pointer-events:none;
          background:linear-gradient(105deg,transparent,${C.gold}12,transparent); transition:left .55s ease }
        .tool-card:hover .tc-sweep { left:125% }

        @media (prefers-reduced-motion: reduce) {
          .h3d, .h3d.h3d-on { transform:none !important; transition:none }
          .h3d-back, .h3d-front { transform:none !important }
          .h3d-shine { display:none }
          .tc-sweep { display:none }
          .tool-card, .tool-card:hover { transform:none }
        }
      `}</style>

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {spotlight && (
        <SpotlightModal
          query={spotQuery}
          setQuery={q => { setSpotQuery(q); setSpotIdx(0) }}
          results={spotResults}
          activeIdx={spotIdx}
          setActiveIdx={setSpotIdx}
          onClose={() => { setSpotlight(false); setSpotQuery('') }}
          onSelect={t => { trackActivity(t.id); router.push(t.href); setSpotlight(false); setSpotQuery('') }}
        />
      )}

      {/* ── Page ── */}
      <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:"var(--font-dm-mono,'DM Mono',monospace)", position:'relative', overflow:'hidden' }}>
        {/* Profundidad atmosférica — orbes de luz dispersos, asimétricos, estáticos */}
        <div style={{ position:'absolute', top:-140, right:-100, width:520, height:520, background:`radial-gradient(circle,${C.gold}14,transparent 70%)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:320, left:-160, width:380, height:380, background:`radial-gradient(circle,${C.gold}09,transparent 72%)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:680, right:60, width:260, height:260, background:`radial-gradient(circle,${C.green}08,transparent 70%)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-120, left:200, width:340, height:340, background:`radial-gradient(circle,${C.gold}07,transparent 70%)`, pointerEvents:'none' }} />
        <div className="dash-content" style={{ maxWidth:1280, margin:'0 auto', padding:'72px 24px 56px', position:'relative' }}>

          {/* ══ HEADER ══ */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:32, position:'relative' }}>
            {/* Curva plasma de marca — se traza una sola vez al entrar, queda fija */}
            <svg
              viewBox="0 0 560 100" preserveAspectRatio="none"
              style={{ position:'absolute', left:0, top:-6, width:'min(560px,70%)', height:100, zIndex:0, pointerEvents:'none', opacity:0.55 }}
            >
              <defs>
                <linearGradient id="homeHeaderLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"  stopColor={C.gold} stopOpacity="0" />
                  <stop offset="40%" stopColor={C.gold} stopOpacity="0.55" />
                  <stop offset="100%" stopColor={C.glow} stopOpacity="1" />
                </linearGradient>
                <filter id="homeHeaderGlow" x="-20%" y="-300%" width="140%" height="700%">
                  <feGaussianBlur stdDeviation="2.4" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <path
                d={HEADER_CURVE_D} fill="none" stroke="url(#homeHeaderLine)" strokeWidth="1.6"
                strokeLinejoin="round" filter="url(#homeHeaderGlow)"
                style={{ strokeDasharray:700, strokeDashoffset: headerDrawn ? 0 : 700, transition:'stroke-dashoffset 1.6s cubic-bezier(0.4,0,0.2,1)' }}
              />
            </svg>
            <div style={{ position:'relative', zIndex:1 }}>
              <div style={{ fontFamily:'monospace', fontSize:11, letterSpacing:'0.3em', textTransform:'uppercase', color:C.dimText, marginBottom:8 }}>
                {'// SIGMA RESEARCH · MORNING BRIEFING'}
              </div>
              <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:'clamp(32px,5vw,60px)', lineHeight:0.95, letterSpacing:'0.04em', marginBottom:8 }}>
                <span style={{ background:`linear-gradient(135deg,${C.gold},${C.glow})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                  {greeting}
                </span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <span style={{ fontFamily:'monospace', fontSize:12, color:C.dimText, letterSpacing:'0.12em' }}>{dateStr}</span>
                <span style={{ color:C.border }}>·</span>
                {/* TRM badge */}
                <span style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'monospace', fontSize:10, color: trmLive ? C.green : C.dimText, background: trmLive ? 'rgba(52,211,153,0.08)' : 'transparent', border:`1px solid ${trmLive ? 'rgba(52,211,153,0.25)' : C.border}`, borderRadius:C.radiusSm, padding:'2px 8px' }}>
                  {trmLive && <span style={{ width:5, height:5, borderRadius:'50%', background:C.green, display:'inline-block', animation:'sp-ping 1.5s infinite' }} />}
                  USD/CLP {trm.toLocaleString('es-CL')}
                  {trmLive ? ' · live' : ' · est.'}
                </span>
                <span style={{ color:C.border }}>·</span>
                <button
                  onClick={() => { setSpotlight(true); setSpotQuery(''); setSpotIdx(0) }}
                  style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:C.radiusSm, padding:'3px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
                >
                  <span style={{ fontFamily:'monospace', fontSize:9, color:C.dimText, letterSpacing:'0.1em' }}>
                    <kbd style={{ background:C.surface, padding:'1px 4px', marginRight:4, fontSize:9 }}>⌘K</kbd>
                    BÚSQUEDA
                  </span>
                </button>
              </div>
            </div>
            {/* Avatar */}
            <div style={{ width:44, height:44, borderRadius:'50%', flexShrink:0, background:`linear-gradient(135deg,${C.gold}44,${C.gold}1a)`, border:`1.5px solid ${C.gold}66`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:18, color:C.gold, letterSpacing:'0.05em', userSelect:'none' }}>
              {initials}
            </div>
          </div>

          {/* ══ GETTING STARTED BANNER ══ */}
          {!loading && D.totalUSD === 0 && (
            <div style={{ marginBottom:16, border:`1px solid ${C.gold}30`, borderRadius:C.radiusMd, boxShadow:C.shadowCard, background:`${C.gold}06`, padding:'20px 24px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.25em', color:C.gold, marginBottom:8 }}>
                    {'// PRIMEROS PASOS · CONFIGURA TU CUENTA'}
                  </div>
                  <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:22, color:C.text, marginBottom:12 }}>
                    BIENVENIDO A SIGMA RESEARCH
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {[
                      { n:'01', label:'Configura tu portafolio',  href:'/portafolio',  done: false, desc:'Registra tus plataformas: IBKR, Binance, Fintual, Santander' },
                      { n:'02', label:'Añade un trade al journal', href:'/journal',     done: trades.length > 0, desc:'Importa CSV de Binance o agrega trades manualmente' },
                      { n:'03', label:'Configura tu objetivo FIRE', href:'/fire',       done: !!fireTarget, desc:'Define tu meta de independencia financiera' },
                    ].map(step => (
                      <a key={step.n} href={step.href} style={{ display:'flex', alignItems:'center', gap:12, textDecoration:'none', padding:'8px 12px', borderRadius:C.radiusSm, background: step.done ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.03)', border:`1px solid ${step.done ? 'rgba(52,211,153,0.2)' : C.border}`, transition:'border-color 0.15s' }}>
                        <div style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: step.done ? 'rgba(52,211,153,0.15)' : `${C.gold}15`, border:`1px solid ${step.done ? 'rgba(52,211,153,0.4)' : `${C.gold}40`}` }}>
                          <span style={{ fontFamily:'monospace', fontSize:9, color: step.done ? C.green : C.gold }}>{step.done ? '✓' : step.n}</span>
                        </div>
                        <div>
                          <div style={{ fontFamily:'monospace', fontSize:12, color: step.done ? C.green : C.text }}>{step.label}</div>
                          <div style={{ fontFamily:'monospace', fontSize:10, color:C.dimText }}>{step.desc}</div>
                        </div>
                        {!step.done && <span style={{ marginLeft:'auto', fontFamily:'monospace', fontSize:11, color:C.gold }}>→</span>}
                      </a>
                    ))}
                  </div>
                </div>
                <div style={{ fontFamily:'monospace', fontSize:10, color:C.muted, flexShrink:0 }}>
                  Presiona <kbd style={{ background:C.border, padding:'2px 6px', fontFamily:'monospace' }}>?</kbd> para ver todos los atajos
                </div>
              </div>
            </div>
          )}

          {/* ══ KPI BAR ══ */}
          <div className="sp-kpi-grid" style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr 1fr 1fr 1fr', gap:12, marginBottom:32 }}>

            {/* Patrimonio — hero KPI: ancla visual de la página, rompe la grilla a propósito */}
            <div style={{ position:'relative' }}>
              {/* Capas fantasma — profundidad apilada detrás del hero (glassmorphism) */}
              <div style={{ position:'absolute', inset:0, transform:'translate(7px,9px)', background:`${C.gold}07`, border:`1px solid ${C.gold}14`, borderRadius:C.radiusMd, zIndex:-2 }} />
              <div style={{ position:'absolute', inset:0, transform:'translate(3px,4px)', background:`${C.gold}0a`, border:`1px solid ${C.gold}1c`, borderRadius:C.radiusMd, zIndex:-1 }} />
              <Hero3D>
                {/* Watermark Σ — capa de fondo: se mueve contra el mouse (profundidad) */}
                <span className="h3d-back" style={{ position:'absolute', right:-6, bottom:-22, fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:120, lineHeight:1, color:C.gold, opacity:0.09, textShadow:`0 2px 3px rgba(0,0,0,0.5), 0 -1px 0 rgba(255,255,255,0.15), 0 0 24px ${C.gold}40`, pointerEvents:'none', userSelect:'none' }}>Σ</span>
                <div style={{ position:'relative', fontFamily:'monospace', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText, marginBottom:8 }}>PATRIMONIO</div>
                {/* Cifra + sparkline — capa frontal: flota hacia el mouse */}
                <div className="h3d-front" style={{ position:'relative', display:'flex', alignItems:'flex-end', gap:10, marginBottom:6 }}>
                  {loading ? <Sk w={90} h={32} /> : (
                    <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:34, lineHeight:1, background:`linear-gradient(135deg,${C.gold},${C.glow})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', textShadow:numberEmboss }}>
                      {fmtUSD(D.totalUSD)}
                    </div>
                  )}
                  <Sparkline data={D.sparkCum} />
                </div>
                <div style={{ position:'relative', fontFamily:'monospace', fontSize:10, color: hasDailyTrades ? (D.dailyPnL >= 0 ? C.green : C.red) : C.muted }}>
                  {hasDailyTrades ? `${fmtDiff(D.dailyPnL)} / ${D.dailyPnL >= 0 ? '+' : ''}${D.dailyPct.toFixed(2)}% hoy` : '— sin operaciones hoy'}
                </div>
              </Hero3D>
            </div>

            {/* PnL Mes */}
            <div className="sp-fadein" style={{ ...cardStyle, background:C.surface, padding:'16px 18px', animationDelay:'50ms' }}>
              <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText, marginBottom:8 }}>PNL DEL MES</div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:10, marginBottom:6 }}>
                {loading ? <Sk w={80} h={28} /> : <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:28, color:D.monthPnL >= 0 ? C.green : C.red, lineHeight:1, textShadow:numberEmboss }}>{fmtDiff(D.monthPnL)}</div>}
                {!loading && D.sparkMonthCum.length > 1 && <Sparkline data={D.sparkMonthCum} w={56} h={22} />}
              </div>
              <div style={{ fontFamily:'monospace', fontSize:10, color:C.dimText }}>{D.monthTradesCount} trades este mes</div>
            </div>

            {/* Win Rate */}
            <div className="sp-fadein" style={{ ...cardStyle, background:C.surface, padding:'16px 18px', animationDelay:'100ms' }}>
              <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText, marginBottom:8 }}>WIN RATE MES</div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:10, marginBottom:6 }}>
                {loading ? <Sk w={70} h={28} /> : <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:28, color:D.winRate >= 50 ? C.green : C.red, lineHeight:1, textShadow:numberEmboss }}>{pct(D.winRate)}</div>}
                {!loading && D.last10Results.length > 0 && <MiniBarChart data={D.last10Results} w={52} h={22} />}
              </div>
              {D.streak > 1 && !loading && <div style={{ fontFamily:'monospace', fontSize:10, color:C.green }}>🔥 {D.streak}W STREAK</div>}
            </div>

            {/* Ingreso pasivo */}
            <div className="sp-fadein" style={{ ...cardStyle, background:C.surface, padding:'16px 18px', animationDelay:'150ms' }}>
              <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText, marginBottom:8 }}>INGRESO/MES</div>
              {loading ? <Sk w={80} h={28} /> : <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:28, color:C.green, lineHeight:1, marginBottom:6, textShadow:numberEmboss }}>{fmtUSD(D.monthlyPassive)}</div>}
              <div style={{ fontFamily:'monospace', fontSize:10, color:C.dimText }}>ingreso pasivo</div>
            </div>

            {/* FIRE */}
            <div className="sp-fadein" style={{ ...cardStyle, background:C.surface, padding:'16px 18px', animationDelay:'200ms' }}>
              <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText, marginBottom:8 }}>PROGRESO FIRE</div>
              {loading ? <Sk w={80} h={28} /> : !fireConfigured ? (
                <Link href="/fire" style={{ textDecoration:'none' }}>
                  <div style={{ fontFamily:'monospace', fontSize:10, color:C.gold, border:`1px solid ${C.gold}44`, padding:'7px 10px', letterSpacing:'0.1em', display:'inline-block' }}>
                    Configurar objetivo →
                  </div>
                </Link>
              ) : (
                <>
                  <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:28, color:C.gold, lineHeight:1, marginBottom:8, textShadow:numberEmboss }}>{pct(D.firePct)}</div>
                  <div style={{ height:3, background:C.border, borderRadius:2, marginBottom:4 }}>
                    <div style={{ width:`${D.firePct}%`, height:'100%', background:`linear-gradient(90deg,${C.gold},${C.glow})`, borderRadius:2, transition:'width .5s' }} />
                  </div>
                  <div style={{ fontFamily:'monospace', fontSize:9, color:C.dimText }}>
                    meta {fmtUSD(D.FIRE_TARGET)}{D.fireYears != null && D.fireYears > 0 ? ` · ~${D.fireYears}a` : ''}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ══ GANANCIA EQUIVALENTE SIGMA ══ */}
          {/* Proyección: % real del motor aplicado al capital del usuario. No es
              P&L ejecutado — se etiqueta explícito para no confundir con dinero real. */}
          {!loading && motorReturn && D.totalUSD > 0 && (() => {
            const equivalentGain = D.totalUSD * (motorReturn.monthlyReturnPct / 100)
            return (
              <div style={{ ...heroCardStyle, padding:'18px 22px', marginBottom:20, display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:220 }}>
                  <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText, marginBottom:6 }}>
                    GANANCIA EQUIVALENTE · SIGUIENDO LA ESTRATEGIA SIGMA
                  </div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:12, flexWrap:'wrap' }}>
                    <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:30, lineHeight:1, color: equivalentGain >= 0 ? C.green : C.red, textShadow:numberEmboss }}>
                      {fmtDiff(equivalentGain)}
                    </div>
                    <div style={{ fontFamily:'monospace', fontSize:11, color:C.dimText }}>
                      ({motorReturn.monthlyReturnPct >= 0 ? '+' : ''}{motorReturn.monthlyReturnPct.toFixed(2)}% este mes · motor)
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily:'monospace', fontSize:10, color:C.muted, maxWidth:320, lineHeight:1.6, borderLeft:`1px solid ${C.border}`, paddingLeft:16 }}>
                  ⓘ Proyección educativa: lo que tu capital actual ({fmtUSD(D.totalUSD)}) habría ganado este mes si hubiera seguido el desempeño real del motor SIGMA. No es tu P&L ejecutado ni una orden real.
                </div>
              </div>
            )
          })()}

          {/* ══ QUICK SUMMARY BAR ══ */}
          <div className="sp-summary-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:40 }}>

            <div style={{ ...cardStyle, background:C.surface2, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:24, color:C.gold, lineHeight:1, flexShrink:0, width:20, textAlign:'center' }}>★</div>
              <div>
                <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase', color:C.dimText, marginBottom:4 }}>MEJOR TRADE DEL MES</div>
                {loading ? <Sk w={80} h={14} /> : D.bestTrade ? (
                  <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                    <span style={{ fontFamily:'monospace', fontSize:13, color:C.green }}>{fmtDiff(D.bestTrade.pnl_usd)}</span>
                    <span style={{ fontFamily:'monospace', fontSize:10, color:C.dimText }}>{D.bestTrade.par} · {D.bestTrade.lado}</span>
                  </div>
                ) : <span style={{ fontFamily:'monospace', fontSize:11, color:C.muted }}>Sin trades este mes</span>}
              </div>
            </div>

            <div style={{ ...cardStyle, background:C.surface2, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:24, color:D.weekPnL >= 0 ? C.green : C.red, lineHeight:1, flexShrink:0, width:20, textAlign:'center' }}>
                {D.weekPnL >= 0 ? '▲' : '▼'}
              </div>
              <div>
                <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase', color:C.dimText, marginBottom:4 }}>P&L SEMANAL</div>
                {loading ? <Sk w={80} h={14} /> : (
                  <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                    <span style={{ fontFamily:'monospace', fontSize:13, color:D.weekPnL >= 0 ? C.green : C.red }}>{fmtDiff(D.weekPnL)}</span>
                    <span style={{ fontFamily:'monospace', fontSize:10, color:C.dimText }}>{D.weekCount} trades</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ ...cardStyle, background:C.surface2, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ flexShrink:0 }}>
                {D.nextEvent ? (
                  <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:24, lineHeight:1, textAlign:'center', width:20,
                    color: D.nextEvent.daysUntil === 0 ? C.red : D.nextEvent.daysUntil === 1 ? C.yellow : C.dimText }}>
                    {D.nextEvent.daysUntil === 0 ? '!' : D.nextEvent.daysUntil <= 2 ? '⚡' : '◎'}
                  </div>
                ) : <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:24, color:C.dimText, width:20 }}>◎</div>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase', color:C.dimText, marginBottom:4 }}>PRÓXIMO EVENTO HIGH</div>
                {D.nextEvent ? (
                  <div>
                    <div style={{ fontFamily:'monospace', fontSize:11, color:C.text, marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{D.nextEvent.title}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontFamily:'monospace', fontSize:9, color:C.dimText }}>{D.nextEvent.date} · {D.nextEvent.time}</span>
                      <span style={{ fontFamily:'monospace', fontSize:9, fontWeight:700, padding:'1px 6px',
                        color:   D.nextEvent.daysUntil === 0 ? C.red : D.nextEvent.daysUntil === 1 ? C.yellow : C.gold,
                        background: D.nextEvent.daysUntil === 0 ? 'rgba(248,113,113,0.12)' : D.nextEvent.daysUntil === 1 ? 'rgba(251,191,36,0.12)' : 'rgba(212,175,55,0.08)',
                        border: `1px solid ${D.nextEvent.daysUntil === 0 ? 'rgba(248,113,113,0.3)' : D.nextEvent.daysUntil === 1 ? 'rgba(251,191,36,0.3)' : 'rgba(212,175,55,0.2)'}`,
                      }}>
                        {D.nextEvent.daysUntil === 0 ? 'HOY' : D.nextEvent.daysUntil === 1 ? 'MAÑANA' : `en ${D.nextEvent.daysUntil}d`}
                      </span>
                    </div>
                  </div>
                ) : <span style={{ fontFamily:'monospace', fontSize:11, color:C.muted }}>Sin eventos próximos</span>}
              </div>
            </div>
          </div>

          {/* ══ SEPARATOR ══ */}
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
            <div style={{ flex:1, height:1, background:C.border }} />
            <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.35em', textTransform:'uppercase', color:C.dimText }}>HERRAMIENTAS</div>
            <div style={{ flex:1, height:1, background:C.border }} />
          </div>

          {/* ══ TOOL CARDS (3×3) ══ */}
          <div className="sp-tool-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:40 }}>
            {sortedTools.map(tool => {
              const badge    = getToolBadge(tool.id)
              const lastSeen = activity[tool.id]
              return (
                <Link
                  key={tool.id}
                  href={tool.href}
                  className="tool-card"
                  onClick={() => trackActivity(tool.id)}
                  style={{ ...cardStyle, background:C.surface, padding:'20px 20px', textDecoration:'none', display:'flex', flexDirection:'column', gap:0, position:'relative' }}
                  title={tool.key ? `[${tool.key}] ${tool.label}` : undefined}
                >
                  {/* Barrido de luz al hover */}
                  <span className="tc-sweep" aria-hidden />

                  {/* Live dot top-right */}
                  {tool.isLive && (
                    <div style={{ position:'absolute', top:14, right:14, display:'flex', alignItems:'center', gap:5 }}>
                      <LiveDot />
                    </div>
                  )}

                  {/* Viz + label + shortcut key */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                    <ToolViz id={tool.id} />
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:22, color:C.text, letterSpacing:'0.05em', lineHeight:1 }}>
                          {tool.label}
                        </div>
                        {tool.key && (
                          <kbd style={{ fontFamily:'monospace', fontSize:8, color:C.dimText, background:C.bg, border:`1px solid ${C.border}`, padding:'1px 4px', lineHeight:'14px', flexShrink:0, opacity:0.65 }}>
                            {tool.key}
                          </kbd>
                        )}
                      </div>
                      <div style={{ fontFamily:'monospace', fontSize:10, color:C.dimText }}>{tool.sub}</div>
                    </div>
                  </div>

                  {/* Live badge */}
                  {badge && (
                    <div style={{ fontFamily:'monospace', fontSize:10, color:tool.isLive ? C.green : C.gold, background:tool.isLive ? C.green+'12' : C.gold+'10', borderRadius:C.radiusSm, padding:'3px 8px', marginBottom:14, display:'inline-block', letterSpacing:'0.04em', alignSelf:'flex-start' }}>
                      {badge}
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto', paddingTop:10, borderTop:`1px solid ${C.border}` }}>
                    <div style={{ fontFamily:'monospace', fontSize:9, color:C.muted }}>
                      {lastSeen ? `Último acceso: ${timeAgo(lastSeen)}` : 'Sin accesos recientes'}
                    </div>
                    <span style={{ fontFamily:'monospace', fontSize:10, color:C.gold, letterSpacing:'0.1em' }}>ABRIR →</span>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* ══ TRES COLUMNAS — DATA ══ */}
          <div className="sp-bottom-grid" style={{ display:'grid', gridTemplateColumns:'35% 35% 30%', gap:12, marginBottom:32, alignItems:'start' }}>

            {/* Portfolio snapshot */}
            <div style={{ ...cardStyle, background:C.surface, padding:'20px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText }}>PORTAFOLIO SNAPSHOT</div>
              {D.segments.length === 0 ? (
                <div style={{ fontFamily:'monospace', fontSize:12, color:C.muted }}>Sin datos — <a href="/portafolio" style={{ color:C.gold, textDecoration:'none' }}>configura tu portafolio →</a></div>
              ) : (
                <>
                  <div style={{ display:'flex', height:8, borderRadius:2, overflow:'hidden', background:C.border }}>
                    {D.segments.map(s => <div key={s.id} style={{ width:`${s.pct}%`, background:s.color }} title={`${s.name} ${pct(s.pct)}`} />)}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {D.segments.map(s => (
                      <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <div style={{ width:7, height:7, background:s.color, borderRadius:1, flexShrink:0 }} />
                          <span style={{ fontFamily:'monospace', fontSize:11, color:C.dimText }}>{s.name}</span>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <span style={{ fontFamily:'monospace', fontSize:11, color:C.text }}>{fmtUSD(s.usd)}</span>
                          <span style={{ fontFamily:'monospace', fontSize:10, color:C.muted, marginLeft:6 }}>{pct(s.pct)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontFamily:'monospace', fontSize:10, color:C.dimText }}>Total</span>
                  <span style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:20, color:C.gold, lineHeight:1, textShadow:numberEmboss }}>{fmtUSD(D.totalUSD)}</span>
                </div>
                <div style={{ height:3, background:C.border, borderRadius:2 }}>
                  <div style={{ width:`${D.firePct}%`, height:'100%', background:`linear-gradient(90deg,${C.gold},${C.glow})`, borderRadius:2, transition:'width .5s' }} />
                </div>
                <div style={{ fontFamily:'monospace', fontSize:9, color:C.dimText, marginTop:4 }}>
                  FIRE {pct(D.firePct)} · meta {fmtUSD(D.FIRE_TARGET)}
                </div>
              </div>
              <Link href="/portafolio" style={{ fontFamily:'monospace', fontSize:10, color:C.gold, letterSpacing:'0.15em', textDecoration:'none', textTransform:'uppercase' }}>
                Ver portfolio completo →
              </Link>
            </div>

            {/* Últimos 5 trades */}
            <div style={{ ...cardStyle, background:C.surface, padding:'20px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText }}>ÚLTIMOS TRADES</div>
                {D.streak > 0 && (
                  <div style={{ fontFamily:'monospace', fontSize:10, color:C.green, background:C.green+'18', borderRadius:C.radiusSm, padding:'2px 8px', letterSpacing:'0.1em' }}>🔥 {D.streak}W STREAK</div>
                )}
              </div>
              {D.last5.length === 0 ? (
                <div style={{ fontFamily:'monospace', fontSize:12, color:C.muted }}>Sin trades — <a href="/journal" style={{ color:C.gold, textDecoration:'none' }}>registra tu primer trade →</a></div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                      {['Fecha','Par','Lado','PnL'].map(col => (
                        <th key={col} style={{ padding:'4px 8px', fontFamily:'monospace', fontSize:9, letterSpacing:'0.15em', textTransform:'uppercase', color:C.dimText, textAlign:'left' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {D.last5.map((t, i) => (
                      <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                        <td style={{ padding:'7px 8px', fontFamily:'monospace', fontSize:11, color:C.dimText }}>{t.fecha?.slice(5) ?? '—'}</td>
                        <td style={{ padding:'7px 8px', fontFamily:'monospace', fontSize:11, color:C.text }}>{t.par ?? '—'}</td>
                        <td style={{ padding:'7px 8px', fontFamily:'monospace', fontSize:10, color:t.lado === 'LONG' ? C.green : C.red }}>{t.lado ?? '—'}</td>
                        <td style={{ padding:'7px 8px', fontFamily:'monospace', fontSize:11, color:(t.pnl_usd ?? 0) >= 0 ? C.green : C.red, textAlign:'right' }}>
                          {(t.pnl_usd ?? 0) >= 0 ? '+' : ''}{fmtUSD(t.pnl_usd ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ background:C.bg, borderRadius:C.radiusSm, padding:'10px 12px', display:'flex', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontFamily:'monospace', fontSize:9, color:C.dimText, marginBottom:2 }}>PNL ESTE MES</div>
                  <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:22, color:D.monthPnL >= 0 ? C.green : C.red, lineHeight:1, textShadow:numberEmboss }}>{fmtDiff(D.monthPnL)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'monospace', fontSize:9, color:C.dimText, marginBottom:2 }}>WIN RATE</div>
                  <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:22, color:D.winRate >= 50 ? C.green : C.red, lineHeight:1, textShadow:numberEmboss }}>{pct(D.winRate)}</div>
                </div>
              </div>
              <Link href="/journal" style={{ fontFamily:'monospace', fontSize:10, color:C.gold, letterSpacing:'0.15em', textDecoration:'none', textTransform:'uppercase' }}>
                Ver journal completo →
              </Link>
            </div>

            {/* Eventos macro */}
            <div style={{ ...cardStyle, background:C.surface, padding:'20px 18px', display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText }}>PRÓXIMOS EVENTOS HIGH</div>
              {D.upcoming.length === 0 ? (
                <div style={{ fontFamily:'monospace', fontSize:12, color:C.muted }}>Sin eventos próximos</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {D.upcoming.map((ev, i) => {
                    const isNext = i === 0
                    return (
                      <div key={i} style={{ padding:'10px 12px', borderRadius:C.radiusSm, background:isNext ? C.gold+'0c' : C.bg, border:`1px solid ${isNext ? C.gold+'44' : C.border}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:6, marginBottom:4 }}>
                          <span style={{ fontFamily:'monospace', fontSize:10, color:isNext ? C.gold : C.dimText, lineHeight:1.4, flex:1 }}>{ev.title}</span>
                          <span style={{ fontFamily:'monospace', fontSize:8, letterSpacing:'0.1em', color:C.red, background:C.red+'18', padding:'1px 5px', whiteSpace:'nowrap', flexShrink:0 }}>HIGH</span>
                        </div>
                        <div style={{ fontFamily:'monospace', fontSize:9, color:C.muted, letterSpacing:'0.05em' }}>{ev.date} · {ev.time}</div>
                      </div>
                    )
                  })}
                </div>
              )}
              <Link href="/calendario" style={{ fontFamily:'monospace', fontSize:10, color:C.gold, letterSpacing:'0.15em', textDecoration:'none', textTransform:'uppercase', marginTop:4 }}>
                Ver calendario completo →
              </Link>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ─── ShortcutsModal ───────────────────────────────────────────────────────────
const SHORTCUTS = [
  { key: '?',   desc: 'Abrir/cerrar este panel' },
  { key: '⌘K',  desc: 'Búsqueda rápida de herramientas' },
  { key: 'H',   desc: 'Ir al HUD — señales en vivo' },
  { key: 'T',   desc: 'Ir al Portafolio' },
  { key: 'J',   desc: 'Ir al Journal de trades' },
  { key: 'M',   desc: 'Ir a Monte Carlo' },
  { key: 'F',   desc: 'Ir a la calculadora FIRE' },
  { key: 'L',   desc: 'Ir a LP DeFi' },
  { key: 'C',   desc: 'Ir al Calendario macro' },
  { key: 'ESC', desc: 'Cerrar modales' },
]

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(4,5,10,.85)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center' }}
    >
      <div onClick={e => e.stopPropagation()}
        style={{ width:480, background:C.surface, border:`1px solid ${C.gold}33`, boxShadow:'0 24px 80px rgba(0,0,0,.65)', padding:'28px 32px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.28em', color:C.gold }}>{'// ATAJOS DE TECLADO'}</div>
          <kbd style={{ fontFamily:'monospace', fontSize:10, color:C.dimText, background:C.border, padding:'2px 8px' }}>ESC para cerrar</kbd>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          {SHORTCUTS.map(s => (
            <div key={s.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom:`1px solid ${C.border}20` }}>
              <span style={{ fontFamily:'monospace', fontSize:12, color:C.dimText }}>{s.desc}</span>
              <kbd style={{ fontFamily:'monospace', fontSize:11, color:C.gold, background:`${C.gold}12`, border:`1px solid ${C.gold}30`, padding:'3px 10px', minWidth:32, textAlign:'center' }}>{s.key}</kbd>
            </div>
          ))}
        </div>
        <div style={{ fontFamily:'monospace', fontSize:10, color:C.muted, marginTop:16, textAlign:'center' }}>
          Los atajos funcionan cuando no estás escribiendo en un input
        </div>
      </div>
    </div>
  )
}

// ─── SpotlightModal ───────────────────────────────────────────────────────────
type ToolEntry = typeof TOOL_LIST[number]

interface SpotlightProps {
  query:        string
  setQuery:     (q: string) => void
  results:      ToolEntry[]
  activeIdx:    number
  setActiveIdx: (i: number) => void
  onClose:      () => void
  onSelect:     (t: ToolEntry) => void
}

function SpotlightModal({ query, setQuery, results, activeIdx, setActiveIdx, onClose, onSelect }: SpotlightProps) {
  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(4,5,10,.88)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'14vh' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width:520, background:C.surface, border:`1px solid ${C.border}`, boxShadow:`0 24px 80px rgba(0,0,0,.65),0 0 0 1px ${C.gold}22` }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:`1px solid ${C.border}` }}>
          <span style={{ fontFamily:'monospace', fontSize:14, color:C.dimText }}>⌘</span>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(Math.min(activeIdx + 1, results.length - 1)) }
              if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(Math.max(activeIdx - 1, 0)) }
              if (e.key === 'Enter' && results[activeIdx]) onSelect(results[activeIdx])
            }}
            placeholder="Buscar herramienta…"
            style={{ flex:1, background:'transparent', border:'none', fontFamily:'monospace', fontSize:14, color:C.text, outline:'none', caretColor:C.gold }}
          />
          <kbd style={{ fontFamily:'monospace', fontSize:10, color:C.dimText, background:C.border, padding:'2px 6px' }}>ESC</kbd>
        </div>
        <div style={{ maxHeight:320, overflowY:'auto' }}>
          {results.map((t, i) => (
            <div
              key={t.id}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => onSelect(t)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', cursor:'pointer', background:i === activeIdx ? C.gold+'12' : 'transparent', borderLeft:`2px solid ${i === activeIdx ? C.gold : 'transparent'}`, transition:'background .1s' }}
            >
              <div>
                <div style={{ fontFamily:'monospace', fontSize:12, color:C.text, marginBottom:2 }}>{t.label}</div>
                <div style={{ fontFamily:'monospace', fontSize:10, color:C.dimText }}>{t.sub}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {t.isLive && <LiveDot size={6} />}
                {t.key && <kbd style={{ fontFamily:'monospace', fontSize:9, color:C.dimText, background:C.border, padding:'2px 5px' }}>{t.key}</kbd>}
              </div>
            </div>
          ))}
          {results.length === 0 && (
            <div style={{ padding:'20px 16px', fontFamily:'monospace', fontSize:12, color:C.muted, textAlign:'center' }}>Sin resultados</div>
          )}
        </div>
        <div style={{ padding:'8px 16px', borderTop:`1px solid ${C.border}`, display:'flex', gap:16 }}>
          {[['↵','Abrir'],['↑↓','Navegar'],['ESC','Cerrar']].map(([k, v]) => (
            <span key={k} style={{ fontFamily:'monospace', fontSize:9, color:C.muted }}>
              <kbd style={{ background:C.border, padding:'1px 4px', marginRight:4 }}>{k}</kbd>{v}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
