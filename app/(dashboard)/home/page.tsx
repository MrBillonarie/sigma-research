'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { C } from '@/app/lib/constants'
import { supabase } from '@/app/lib/supabase'

// ─── Platform config ──────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'ibkr',            name: 'IBKR',           color: '#3b82f6', isCLP: false },
  { id: 'binance_spot',    name: 'Binance Spot',    color: '#f59e0b', isCLP: false },
  { id: 'binance_futures', name: 'Binance Futures', color: '#ef4444', isCLP: false },
  { id: 'fintual',         name: 'Fintual',         color: '#8b5cf6', isCLP: true  },
  { id: 'santander',       name: 'Santander',       color: '#ec4899', isCLP: true  },
  { id: 'cash',            name: 'Cash',            color: '#6b7280', isCLP: false },
]

const MACRO_EVENTS = [
  { date: '2026-04-30', time: '08:30 UTC', title: 'PCE Price Index (YoY)' },
  { date: '2026-05-01', time: '08:30 UTC', title: 'NFP (Non-Farm Payrolls)' },
  { date: '2026-05-06', time: '18:00 UTC', title: 'FOMC Meeting (Día 1)' },
  { date: '2026-05-07', time: '18:00 UTC', title: 'FOMC Decision + Press Conference' },
  { date: '2026-05-13', time: '08:30 UTC', title: 'CPI (YoY) — Mayo' },
  { date: '2026-05-29', time: '08:30 UTC', title: 'GDP Q1 2026 (Revisado)' },
  { date: '2026-06-05', time: '08:30 UTC', title: 'NFP — Junio' },
  { date: '2026-06-11', time: '08:30 UTC', title: 'CPI (YoY) — Junio' },
  { date: '2026-06-17', time: '18:00 UTC', title: 'FOMC Decision — Junio' },
  { date: '2026-06-26', time: '08:30 UTC', title: 'PCE Price Index — Junio' },
]

const TOOL_LIST = [
  { id: 'hud',        href: '/hud',        label: 'HUD',         sub: 'Vista operativa live',      key: 'H', isLive: true  },
  { id: 'terminal',   href: '/terminal',   label: 'TERMINAL',    sub: 'Posiciones y órdenes',       key: 'T', isLive: true  },
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
const TRM = 950

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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DashboardHome() {
  const router = useRouter()

  const [portfolio,       setPortfolio]       = useState<PortfolioRow>({})
  const [positions,       setPositions]       = useState<PassivePos[]>([])
  const [trades,          setTrades]          = useState<Trade[]>([])
  const [fireTarget,      setFireTarget]      = useState<number | null>(null)
  const [fireProbability, setFireProbability] = useState<number | null>(null)
  const [activity,        setActivity]        = useState<Record<string, number>>({})
  const [username,        setUsername]        = useState('TRADER')
  const [loading,         setLoading]         = useState(true)
  const [now,             setNow]             = useState(new Date())
  const [spotlight,       setSpotlight]       = useState(false)
  const [spotQuery,       setSpotQuery]       = useState('')
  const [spotIdx,         setSpotIdx]         = useState(0)

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // localStorage hydration
  useEffect(() => {
    try { const r = localStorage.getItem('sigma_portfolio');    if (r) setPortfolio(JSON.parse(r))    } catch {}
    try { const r = localStorage.getItem('sigma_positions');    if (r) setPositions(JSON.parse(r))    } catch {}
    try { const r = localStorage.getItem('sigma_trades');       if (r) setTrades(JSON.parse(r))       } catch {}
    try { const r = localStorage.getItem('sigma_fire_target');  if (r) setFireTarget(Number(r))       } catch {}
    try { const r = localStorage.getItem('sigma_montecarlo');   if (r) { const d = JSON.parse(r); if (d?.fireProbability) setFireProbability(d.fireProbability) } } catch {}
    try { const r = localStorage.getItem('sigma_activity');     if (r) setActivity(JSON.parse(r))     } catch {}
    setLoading(false)
  }, [])

  // Auth user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      const m = data.user.user_metadata
      const name = m?.username || m?.full_name || data.user.email?.split('@')[0] || 'TRADER'
      setUsername(name.toUpperCase())
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
      if (e.key === 'Escape') { setSpotlight(false); setSpotQuery(''); return }
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
    const platformTotals = PLATFORMS.map(p => { const raw = portfolio[p.id] ?? 0; return p.isCLP ? raw / TRM : raw })
    const totalUSD = platformTotals.reduce((s, v) => s + v, 0)
    const segments = PLATFORMS.map((p, i) => ({ ...p, usd: platformTotals[i], pct: totalUSD > 0 ? (platformTotals[i] / totalUSD) * 100 : 0 })).filter(s => s.usd > 0)
    const monthlyPassive = positions.reduce((s, p) => s + (p.ingresoMensual ?? 0), 0)

    const todayStr = now.toISOString().split('T')[0]
    const ym = todayStr.slice(0, 7)
    const sorted = [...trades].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))

    const monthTrades = trades.filter(t => t.fecha?.startsWith(ym))
    const monthPnL    = monthTrades.reduce((s, t) => s + (t.pnl_usd ?? 0), 0)
    const wins        = monthTrades.filter(t => t.resultado === 'WIN').length
    const winRate     = monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0

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
    const upcoming  = MACRO_EVENTS.filter(e => e.date >= todayDate)
    const nextEvent = upcoming[0] ?? null

    return {
      totalUSD, segments, monthlyPassive, monthPnL, winRate, dailyPnL, dailyPct,
      weekPnL, weekCount, sparkCum, streak, bestTrade, last5,
      firePct, FIRE_TARGET, fireYears, nextEvent, upcoming: upcoming.slice(0, 5),
      monthTradesCount: monthTrades.length, totalTrades: trades.length,
    }
  }, [portfolio, positions, trades, fireTarget, now])

  // Spotlight results
  const spotResults = useMemo(() => {
    const q = spotQuery.toLowerCase()
    return q ? TOOL_LIST.filter(t => t.label.toLowerCase().includes(q) || t.sub.toLowerCase().includes(q)) : TOOL_LIST
  }, [spotQuery])

  // Tools sorted by last activity
  const sortedTools = useMemo(
    () => [...TOOL_LIST].sort((a, b) => (activity[b.id] ?? 0) - (activity[a.id] ?? 0)),
    [activity]
  )

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
        .tool-card  { transition: transform .15s ease, box-shadow .15s ease }
        .tool-card:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(0,0,0,.55) }
      `}</style>

      {/* ── Spotlight ── */}
      {spotlight && (
        <div
          onClick={() => { setSpotlight(false); setSpotQuery('') }}
          style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(4,5,10,.88)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'14vh' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width:520, background:C.surface, border:`1px solid ${C.border}`, boxShadow:`0 24px 80px rgba(0,0,0,.65),0 0 0 1px ${C.gold}22` }}>
            {/* Input */}
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontFamily:'monospace', fontSize:14, color:C.dimText }}>⌘</span>
              <input
                autoFocus
                value={spotQuery}
                onChange={e => { setSpotQuery(e.target.value); setSpotIdx(0) }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSpotIdx(i => Math.min(i+1, spotResults.length-1)) }
                  if (e.key === 'ArrowUp')   { e.preventDefault(); setSpotIdx(i => Math.max(i-1, 0)) }
                  if (e.key === 'Enter' && spotResults[spotIdx]) {
                    const t = spotResults[spotIdx]
                    trackActivity(t.id); router.push(t.href); setSpotlight(false); setSpotQuery('')
                  }
                }}
                placeholder="Buscar herramienta…"
                style={{ flex:1, background:'transparent', border:'none', fontFamily:'monospace', fontSize:14, color:C.text, outline:'none', caretColor:C.gold }}
              />
              <kbd style={{ fontFamily:'monospace', fontSize:10, color:C.dimText, background:C.border, padding:'2px 6px' }}>ESC</kbd>
            </div>
            {/* Results */}
            <div style={{ maxHeight:320, overflowY:'auto' }}>
              {spotResults.map((t, i) => (
                <div
                  key={t.id}
                  onMouseEnter={() => setSpotIdx(i)}
                  onClick={() => { trackActivity(t.id); router.push(t.href); setSpotlight(false); setSpotQuery('') }}
                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', cursor:'pointer', background:i===spotIdx ? C.gold+'12' : 'transparent', borderLeft:`2px solid ${i===spotIdx ? C.gold : 'transparent'}`, transition:'background .1s' }}
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
              {spotResults.length === 0 && (
                <div style={{ padding:'20px 16px', fontFamily:'monospace', fontSize:12, color:C.muted, textAlign:'center' }}>Sin resultados</div>
              )}
            </div>
            {/* Footer hints */}
            <div style={{ padding:'8px 16px', borderTop:`1px solid ${C.border}`, display:'flex', gap:16 }}>
              {[['↵','Abrir'],['↑↓','Navegar'],['ESC','Cerrar']].map(([k,v]) => (
                <span key={k} style={{ fontFamily:'monospace', fontSize:9, color:C.muted }}>
                  <kbd style={{ background:C.border, padding:'1px 4px', marginRight:4 }}>{k}</kbd>{v}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Page ── */}
      <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:"var(--font-dm-mono,'DM Mono',monospace)" }}>
        <div style={{ maxWidth:1280, margin:'0 auto', padding:'72px 24px 56px' }}>

          {/* ══ HEADER ══ */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:32 }}>
            <div>
              <div style={{ fontFamily:'monospace', fontSize:11, letterSpacing:'0.3em', textTransform:'uppercase', color:C.dimText, marginBottom:8 }}>
                {'// SIGMA RESEARCH · MORNING BRIEFING'}
              </div>
              <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:'clamp(32px,5vw,60px)', lineHeight:0.95, letterSpacing:'0.04em', marginBottom:8 }}>
                <span style={{ background:`linear-gradient(135deg,${C.gold},${C.glow})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                  {greeting}
                </span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontFamily:'monospace', fontSize:12, color:C.dimText, letterSpacing:'0.12em' }}>{dateStr}</span>
                <span style={{ color:C.border }}>·</span>
                <button
                  onClick={() => { setSpotlight(true); setSpotQuery(''); setSpotIdx(0) }}
                  style={{ background:'none', border:`1px solid ${C.border}`, padding:'3px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
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

          {/* ══ KPI BAR ══ */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:1, background:C.border, marginBottom:1 }}>

            {/* Patrimonio */}
            <div className="sp-fadein" style={{ background:C.surface, padding:'16px 18px', animationDelay:'0ms' }}>
              <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText, marginBottom:8 }}>PATRIMONIO</div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:10, marginBottom:6 }}>
                {loading ? <Sk w={90} h={28} /> : <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:28, color:C.text, lineHeight:1 }}>{fmtUSD(D.totalUSD)}</div>}
                <Sparkline data={D.sparkCum} />
              </div>
              <div style={{ fontFamily:'monospace', fontSize:10, color: hasDailyTrades ? (D.dailyPnL >= 0 ? C.green : C.red) : C.muted }}>
                {hasDailyTrades ? `${fmtDiff(D.dailyPnL)} / ${D.dailyPnL >= 0 ? '+' : ''}${D.dailyPct.toFixed(2)}% hoy` : '— sin operaciones hoy'}
              </div>
            </div>

            {/* PnL Mes */}
            <div className="sp-fadein" style={{ background:C.surface, padding:'16px 18px', animationDelay:'50ms' }}>
              <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText, marginBottom:8 }}>PNL DEL MES</div>
              {loading ? <Sk w={80} h={28} /> : <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:28, color:D.monthPnL >= 0 ? C.green : C.red, lineHeight:1, marginBottom:6 }}>{fmtDiff(D.monthPnL)}</div>}
              <div style={{ fontFamily:'monospace', fontSize:10, color:C.dimText }}>{D.monthTradesCount} trades</div>
            </div>

            {/* Win Rate */}
            <div className="sp-fadein" style={{ background:C.surface, padding:'16px 18px', animationDelay:'100ms' }}>
              <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText, marginBottom:8 }}>WIN RATE MES</div>
              {loading ? <Sk w={70} h={28} /> : <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:28, color:D.winRate >= 50 ? C.green : C.red, lineHeight:1, marginBottom:6 }}>{pct(D.winRate)}</div>}
              {D.streak > 1 && !loading && <div style={{ fontFamily:'monospace', fontSize:10, color:C.green }}>🔥 {D.streak}W STREAK</div>}
            </div>

            {/* Ingreso pasivo */}
            <div className="sp-fadein" style={{ background:C.surface, padding:'16px 18px', animationDelay:'150ms' }}>
              <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText, marginBottom:8 }}>INGRESO/MES</div>
              {loading ? <Sk w={80} h={28} /> : <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:28, color:C.green, lineHeight:1, marginBottom:6 }}>{fmtUSD(D.monthlyPassive)}</div>}
              <div style={{ fontFamily:'monospace', fontSize:10, color:C.dimText }}>ingreso pasivo</div>
            </div>

            {/* FIRE */}
            <div className="sp-fadein" style={{ background:C.surface, padding:'16px 18px', animationDelay:'200ms' }}>
              <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText, marginBottom:8 }}>PROGRESO FIRE</div>
              {loading ? <Sk w={80} h={28} /> : !fireConfigured ? (
                <Link href="/fire" style={{ textDecoration:'none' }}>
                  <div style={{ fontFamily:'monospace', fontSize:10, color:C.gold, border:`1px solid ${C.gold}44`, padding:'7px 10px', letterSpacing:'0.1em', display:'inline-block' }}>
                    Configurar objetivo →
                  </div>
                </Link>
              ) : (
                <>
                  <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:28, color:C.gold, lineHeight:1, marginBottom:8 }}>{pct(D.firePct)}</div>
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

          {/* ══ QUICK SUMMARY BAR ══ */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:C.border, marginBottom:40 }}>

            <div style={{ background:C.bg, padding:'13px 18px', display:'flex', alignItems:'center', gap:14 }}>
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

            <div style={{ background:C.bg, padding:'13px 18px', display:'flex', alignItems:'center', gap:14 }}>
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

            <div style={{ background:C.bg, padding:'13px 18px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:24, color:C.red, lineHeight:1, flexShrink:0, width:20, textAlign:'center' }}>!</div>
              <div>
                <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase', color:C.dimText, marginBottom:4 }}>PRÓXIMO EVENTO</div>
                {D.nextEvent ? (
                  <div>
                    <div style={{ fontFamily:'monospace', fontSize:11, color:C.text, marginBottom:2 }}>{D.nextEvent.title}</div>
                    <div style={{ fontFamily:'monospace', fontSize:9, color:C.dimText }}>{D.nextEvent.date} · {D.nextEvent.time}</div>
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
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:C.border, marginBottom:40 }}>
            {sortedTools.map(tool => {
              const badge    = getToolBadge(tool.id)
              const lastSeen = activity[tool.id]
              return (
                <Link
                  key={tool.id}
                  href={tool.href}
                  className="tool-card"
                  onClick={() => trackActivity(tool.id)}
                  style={{ background:C.surface, padding:'20px 20px', textDecoration:'none', display:'flex', flexDirection:'column', gap:0, position:'relative' }}
                  title={tool.key ? `[${tool.key}] ${tool.label}` : undefined}
                >
                  {/* Live dot top-right */}
                  {tool.isLive && (
                    <div style={{ position:'absolute', top:14, right:14, display:'flex', alignItems:'center', gap:5 }}>
                      <LiveDot />
                    </div>
                  )}

                  {/* Label + shortcut key */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                    <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:22, color:C.text, letterSpacing:'0.05em', lineHeight:1 }}>
                      {tool.label}
                    </div>
                    {tool.key && (
                      <kbd style={{ fontFamily:'monospace', fontSize:8, color:C.dimText, background:C.bg, border:`1px solid ${C.border}`, padding:'1px 4px', lineHeight:'14px', flexShrink:0, opacity:0.65 }}>
                        {tool.key}
                      </kbd>
                    )}
                  </div>

                  {/* Description */}
                  <div style={{ fontFamily:'monospace', fontSize:10, color:C.dimText, marginBottom:10 }}>{tool.sub}</div>

                  {/* Live badge */}
                  {badge && (
                    <div style={{ fontFamily:'monospace', fontSize:10, color:tool.isLive ? C.green : C.gold, background:tool.isLive ? C.green+'12' : C.gold+'10', padding:'3px 8px', marginBottom:14, display:'inline-block', letterSpacing:'0.04em', alignSelf:'flex-start' }}>
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
          <div style={{ display:'grid', gridTemplateColumns:'35% 35% 30%', gap:1, background:C.border, marginBottom:32, alignItems:'start' }}>

            {/* Portfolio snapshot */}
            <div style={{ background:C.surface, padding:'20px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText }}>PORTFOLIO SNAPSHOT</div>
              {D.segments.length === 0 ? (
                <div style={{ fontFamily:'monospace', fontSize:12, color:C.muted }}>Sin datos — carga en Terminal</div>
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
                  <span style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:20, color:C.gold, lineHeight:1 }}>{fmtUSD(D.totalUSD)}</span>
                </div>
                <div style={{ height:3, background:C.border, borderRadius:2 }}>
                  <div style={{ width:`${D.firePct}%`, height:'100%', background:`linear-gradient(90deg,${C.gold},${C.glow})`, borderRadius:2, transition:'width .5s' }} />
                </div>
                <div style={{ fontFamily:'monospace', fontSize:9, color:C.dimText, marginTop:4 }}>
                  FIRE {pct(D.firePct)} · meta {fmtUSD(D.FIRE_TARGET)}
                </div>
              </div>
              <Link href="/portfolio" style={{ fontFamily:'monospace', fontSize:10, color:C.gold, letterSpacing:'0.15em', textDecoration:'none', textTransform:'uppercase' }}>
                Ver portfolio completo →
              </Link>
            </div>

            {/* Últimos 5 trades */}
            <div style={{ background:C.surface, padding:'20px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText }}>ÚLTIMOS TRADES</div>
                {D.streak > 0 && (
                  <div style={{ fontFamily:'monospace', fontSize:10, color:C.green, background:C.green+'18', padding:'2px 8px', letterSpacing:'0.1em' }}>🔥 {D.streak}W STREAK</div>
                )}
              </div>
              {D.last5.length === 0 ? (
                <div style={{ fontFamily:'monospace', fontSize:12, color:C.muted }}>Sin trades — carga en Journal</div>
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
              <div style={{ background:C.bg, padding:'10px 12px', display:'flex', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontFamily:'monospace', fontSize:9, color:C.dimText, marginBottom:2 }}>PNL ESTE MES</div>
                  <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:22, color:D.monthPnL >= 0 ? C.green : C.red, lineHeight:1 }}>{fmtDiff(D.monthPnL)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'monospace', fontSize:9, color:C.dimText, marginBottom:2 }}>WIN RATE</div>
                  <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:22, color:D.winRate >= 50 ? C.green : C.red, lineHeight:1 }}>{pct(D.winRate)}</div>
                </div>
              </div>
              <Link href="/journal" style={{ fontFamily:'monospace', fontSize:10, color:C.gold, letterSpacing:'0.15em', textDecoration:'none', textTransform:'uppercase' }}>
                Ver journal completo →
              </Link>
            </div>

            {/* Eventos macro */}
            <div style={{ background:C.surface, padding:'20px 18px', display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:C.dimText }}>PRÓXIMOS EVENTOS HIGH</div>
              {D.upcoming.length === 0 ? (
                <div style={{ fontFamily:'monospace', fontSize:12, color:C.muted }}>Sin eventos próximos</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {D.upcoming.map((ev, i) => {
                    const isNext = i === 0
                    return (
                      <div key={i} style={{ padding:'10px 12px', background:isNext ? C.gold+'0c' : C.bg, border:`1px solid ${isNext ? C.gold+'44' : C.border}` }}>
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

          {/* ══ TAGLINE ══ */}
          <div style={{ textAlign:'center', fontFamily:'monospace', fontSize:11, letterSpacing:'0.35em', textTransform:'uppercase', color:C.gold+'aa' }}>
            SURVIVE FIRST · WIN AFTER
          </div>

        </div>
      </div>
    </>
  )
}
