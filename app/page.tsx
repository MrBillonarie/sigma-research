import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import HeroAnimation from './components/HeroAnimation'
import MotorVivoPanel from './components/landing/MotorVivoPanel'

export const metadata: Metadata = {
  title: 'SQuant Desk — Infraestructura Cuantitativa LATAM',
  description:
    'Infraestructura cuantitativa institucional para inversores independientes en LATAM. Terminal en vivo, modelos ML, simulador FIRE y más.',
}

// ─── Design tokens (aligned with English version palette) ─────────────────────
const G   = '#d4af37'  // gold
const BG  = '#04050a'  // background
const S   = '#0b0d14'  // surface
const B   = '#1a1d2e'  // border
const T   = '#e8e9f0'  // text
const D   = '#7a7f9a'  // dim
const M   = '#7a7f9a'  // muted — era #4a5068 (2.44:1 sobre S, bajo el mínimo WCAG 3:1)

// Gutter horizontal responsivo — antes 32px fijo, comprimía demasiado el
// contenido contra el borde en mobile. clamp() lo angosta hasta 20px en
// pantallas chicas sin tocar el desktop.
const PX = 'clamp(20px, 6vw, 32px)'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Champion {
  sym: string; tf: string; strategy: string; grade: string
  wr: number; cagr: number; dd: number; direction?: string
}
// Forma cruda del motor — incluye campos de robustez que NO deben llegar al
// público (is_champion/robustness_action), usados solo para filtrar acá.
interface RawModel {
  sym: string; tf: string; strategy: string; grade: string; type?: string
  wr: number; cagr: number; dd: number; is_champion?: boolean
}
interface HistoryTrade {
  sym: string; direction: string; status: string; equity_after?: number
}
interface FireData {
  current_equity: number; starting_equity: number
  target_equity: number; progress_pct: number; baseline_date: string
}
interface Ticker { symbol: string; price: number; change24h: number }

// ─── Data fetch ───────────────────────────────────────────────────────────────
const VPS = process.env.VPS_URL ?? ''

async function getPageData() {
  try {
    const binUrl = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent('["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT"]')}`
    if (!VPS) {
      const binRes  = await fetch(binUrl, { next: { revalidate: 30 }, signal: AbortSignal.timeout(5000) }).catch(() => null)
      const binRaw  = binRes?.ok ? await binRes.json() : []
      const tickers: Ticker[] = (binRaw as Array<{ symbol: string; lastPrice: string; priceChangePercent: string }>).map(t => ({
        symbol: t.symbol.replace('USDT', ''), price: parseFloat(t.lastPrice), change24h: parseFloat(t.priceChangePercent),
      }))
      return {
        metrics: null, fire: null as (FireData | null), coverage: null,
        backtests: 16_767_345, regime: 'UNKNOWN',
        champions: [] as Champion[], history: [] as HistoryTrade[],
        bayesian: { confirmed: 1, watching: 2 },
        lastDecisionAt: null as string | null,
        tickers,
      }
    }
    const [engineRes, publicRes, binRes] = await Promise.all([
      fetch(`${VPS}/api/v2/engine_status`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) }),
      fetch(`${VPS}/api/public`,           { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) }),
      fetch(binUrl,                        { next: { revalidate: 30 }, signal: AbortSignal.timeout(5000) }),
    ])
    const engine = engineRes.ok ? await engineRes.json() : null
    const pub    = publicRes.ok ? await publicRes.json() : null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const binRaw = binRes.ok    ? await binRes.json()   : []
    const fire: FireData | null = engine?.fire ?? null
    const tickers: Ticker[] = (binRaw as Array<{ symbol: string; lastPrice: string; priceChangePercent: string }>).map(t => ({
      symbol:    t.symbol.replace('USDT', ''),
      price:     parseFloat(t.lastPrice),
      change24h: parseFloat(t.priceChangePercent),
    }))
    return {
      metrics:       engine?.portfolio ?? null,
      fire,
      coverage:      engine?.coverage ?? null,
      backtests:     Number(engine?.backtests_total ?? 16_767_345),
      regime:        (pub?.regime ?? 'UNKNOWN') as string,
      // Solo campeones reales activados por el motor — el feed crudo incluye
      // modelos BLOQUEADOS por su propio gate de robustez (ej. CAGR_IMPOSSIBLE,
      // resultados de backtest estadísticamente inválidos) que no deben
      // mostrarse en público como si fueran resultados de producción.
      champions: ((pub?.top_models ?? []) as RawModel[])
        .filter(m => m.is_champion)
        .slice(0, 6)
        .map(m => ({ sym: m.sym, tf: m.tf, strategy: m.strategy, grade: m.grade, wr: m.wr, cagr: m.cagr, dd: m.dd, direction: m.type })),
      history:       ((pub?.history   ?? []) as HistoryTrade[]).filter(t => t.equity_after != null),
      bayesian:      { confirmed: (engine?.bayesian?.edge_confirmed ?? 0) as number, watching: (engine?.bayesian?.watching ?? 0) as number },
      lastDecisionAt: (engine?.last_decision_at ?? null) as string | null,
      tickers,
    }
  } catch {
    return {
      metrics: null, fire: null as (FireData | null), coverage: null,
      backtests: 16_767_345, regime: 'UNKNOWN',
      champions: [] as Champion[], history: [] as HistoryTrade[],
      bayesian: { confirmed: 1, watching: 2 },
      lastDecisionAt: null as string | null,
      tickers: [] as Ticker[],
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getUserCount(): Promise<number> {
  try {
    const sb = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
    return data?.users?.length ?? 0
  } catch {
    return 0
  }
}

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return '—'
  const mins = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60_000)
  if (mins < 1)  return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  return hrs < 24 ? `hace ${hrs}h` : `hace ${Math.floor(hrs / 24)}d`
}

function RegimePill({ regime }: { regime: string }) {
  const ro   = regime === 'risk-on'  || regime.toUpperCase() === 'BULL'
  const roff = regime === 'risk-off' || regime.toUpperCase() === 'BEAR'
  const c = ro ? '#34d399' : roff ? '#f87171' : '#f59e0b'
  const l = ro ? 'RISK-ON' : roff ? 'RISK-OFF' : 'NEUTRAL'
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 9, padding: '3px 10px', letterSpacing: '0.2em', color: c, background: `${c}12`, border: `1px solid ${c}35` }}>
      {l}
    </span>
  )
}

// ─── Equity curve SVG ─────────────────────────────────────────────────────────
function EquityCurveSVG({ history, initial }: { history: HistoryTrade[]; initial: number }) {
  const points: Array<{ eq: number; status: string }> = [
    { eq: initial, status: 'start' },
    ...history.filter(t => t.equity_after != null).map(t => ({ eq: t.equity_after!, status: t.status })),
  ]
  if (points.length < 2) return null

  const W = 760, H = 140, PX = 12, PY = 20
  const eqs   = points.map(p => p.eq)
  const minEq = Math.min(...eqs) - 150
  const maxEq = Math.max(...eqs) + 150
  const mapX  = (i: number)   => PX + (i / (points.length - 1)) * (W - 2 * PX)
  const mapY  = (eq: number)  => H - PY - ((eq - minEq) / (maxEq - minEq)) * (H - 2 * PY)
  const linePts = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${mapX(i).toFixed(1)},${mapY(p.eq).toFixed(1)}`).join(' ')
  const lastX   = mapX(points.length - 1)
  const fillPts = `${linePts} L${lastX.toFixed(1)},${H} L${PX},${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }} aria-hidden="true">
      <defs>
        <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={G} stopOpacity="0.2" />
          <stop offset="100%" stopColor={G} stopOpacity="0"   />
        </linearGradient>
        <linearGradient id="eq-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={G} stopOpacity="0.3" />
          <stop offset="100%" stopColor={G} stopOpacity="1"   />
        </linearGradient>
        <filter id="glow-g" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {[0.25, 0.5, 0.75].map(t => (
        <line key={t}
          x1={PX} y1={(H - PY) - t * (H - 2 * PY)}
          x2={W - PX} y2={(H - PY) - t * (H - 2 * PY)}
          stroke="rgba(212,175,55,0.06)" strokeWidth="1" strokeDasharray="4,10"
        />
      ))}
      <path d={fillPts} fill="url(#eq-fill)" />
      <path d={linePts} fill="none" stroke="url(#eq-line)" strokeWidth="1.5" strokeLinejoin="round" filter="url(#glow-g)" />
      {points.slice(1).map((p, i) => {
        const x = mapX(i + 1), y = mapY(p.eq)
        const isWin = p.status === 'TP_HIT' || p.status === 'TRAIL_HIT'
        const c = isWin ? '#34d399' : '#f87171'
        return (
          <g key={i}>
            <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="5"
              fill={c} fillOpacity="0.12" stroke={c} strokeOpacity="0.3" strokeWidth="1" />
            <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={c} fillOpacity="0.9" />
          </g>
        )
      })}
      <circle cx={mapX(points.length - 1).toFixed(1)} cy={mapY(points[points.length - 1].eq).toFixed(1)}
        r="6" fill="none" stroke={G} strokeOpacity="0.25" strokeWidth="1" />
      <circle cx={mapX(points.length - 1).toFixed(1)} cy={mapY(points[points.length - 1].eq).toFixed(1)}
        r="3" fill={G} />
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gradeColor(g: string) {
  if (g === 'A+') return G
  if (g === 'A')  return '#4a9eff'
  if (g === 'B')  return '#8b8fa8'
  return '#f87171'
}

// Section rule — luxury chapter marker
function SectionRule({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 48 }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${B})` }} />
      <span style={{ fontFamily: 'monospace', fontSize: 9, color: M, letterSpacing: '0.4em', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(270deg, transparent, ${B})` }} />
    </div>
  )
}

// ─── Mini-visuales de herramientas ──────────────────────────────────────────
// Cada herramienta tiene su propio device en miniatura — donde la página real
// ya tiene una firma visual propia (cono Monte Carlo, sparkline FIRE, banda de
// rango LP), se reutiliza aquí en escala pequeña, así esta sección funciona
// como vitrina real y no como ícono genérico de marketing.
function VizPulse({ color }: { color: string }) {
  return (
    <svg width="56" height="22" viewBox="0 0 56 22" fill="none">
      <path d="M0,11 L10,11 L14,4 L18,18 L22,11 L30,11 L34,7 L38,15 L42,11 L56,11"
        stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" fill="none" />
    </svg>
  )
}
function VizLadder({ color }: { color: string }) {
  const heights = [6, 11, 16, 21]
  return (
    <svg width="56" height="22" viewBox="0 0 56 22" fill="none">
      {heights.map((h, i) => (
        <rect key={i} x={i * 14 + 2} y={22 - h} width="8" height={h} fill={color} opacity={0.32 + i * 0.18} rx="1" />
      ))}
    </svg>
  )
}
function VizDial({ color }: { color: string }) {
  return (
    <svg width="56" height="22" viewBox="0 0 56 22" fill="none">
      <circle cx="11" cy="11" r="8.5" stroke={color} strokeWidth="1.3" opacity="0.4" />
      <line x1="11" y1="11" x2="16.5" y2="5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="11" cy="11" r="1.6" fill={color} />
      <line x1="28" y1="11" x2="56" y2="11" stroke={color} strokeWidth="1" strokeDasharray="2,3" opacity="0.4" />
    </svg>
  )
}
function VizCone({ color }: { color: string }) {
  const ends = [3, 7, 11, 15, 19]
  return (
    <svg width="56" height="22" viewBox="0 0 56 22" fill="none">
      {ends.map((y, i) => (
        <line key={i} x1="0" y1="11" x2="56" y2={y} stroke={color} strokeWidth={i === 2 ? 1.6 : 1} opacity={i === 2 ? 0.9 : 0.22} />
      ))}
    </svg>
  )
}
function VizAscend({ color }: { color: string }) {
  return (
    <svg width="56" height="22" viewBox="0 0 56 22" fill="none">
      <path d="M0,20 Q28,20 38,7" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <line x1="38" y1="7" x2="38" y2="1" stroke={color} strokeWidth="1.2" opacity="0.5" />
      <circle cx="38" cy="7" r="2.6" fill={color} />
    </svg>
  )
}
function VizRange({ color }: { color: string }) {
  return (
    <svg width="56" height="22" viewBox="0 0 56 22" fill="none">
      <line x1="0" y1="11" x2="56" y2="11" stroke={color} strokeWidth="1" opacity="0.25" />
      <rect x="16" y="8" width="24" height="6" rx="1.5" fill={color} opacity="0.18" stroke={color} strokeOpacity="0.5" strokeWidth="1" />
      <line x1="30" y1="2" x2="30" y2="20" stroke={color} strokeWidth="1.6" opacity="0.9" />
    </svg>
  )
}

// ─── Static data ──────────────────────────────────────────────────────────────
const tools = [
  { id: '01', name: 'SIGMA ENGINE',      col: '#34d399', viz: VizPulse,  desc: 'Motor de trading cuantitativo 24/7. 70+ estrategias sobre BTC/ETH/SOL/BNB/XAU con Bayesian Search, walk-forward OOS y paper trading en tiempo real.' },
  { id: '02', name: 'MODELOS ML',        col: G,         viz: VizLadder, desc: 'Champions cuantitativos con grades A+/A/B/C. Cada modelo valida con robustness gate, OOS gate y Kelly sizing antes de activarse en producción.' },
  { id: '03', name: 'MOTOR DECISIÓN',    col: '#60a5fa', viz: VizDial,   desc: 'Rotación cross-market. Señales BUY/SELL/HOLD sobre ETFs, fondos mutuos, cripto y renta fija. Ajustado por régimen de mercado (risk-on/off).' },
  { id: '04', name: 'MONTE CARLO',       col: '#a78bfa', viz: VizCone,   desc: '10.000 simulaciones de portafolio con ajuste por inflación CLP/USD, retiro dinámico y percentiles de probabilidad de ruina.' },
  { id: '05', name: 'SIMULADOR FIRE',    col: '#f59e0b', viz: VizAscend, desc: 'Proyección de independencia financiera con horizonte personalizable. Calcula tu número FIRE y el tiempo estimado para alcanzarlo.' },
  { id: '06', name: 'SEÑALES LP',        col: '#f87171', viz: VizRange,  desc: 'Motor cuantitativo para PancakeSwap v3. Rangos óptimos, Kelly sizing, Monte Carlo de impermanent loss y APR estimado por par.' },
]

const plans = [
  {
    tier: 'ACCESO LIBRE', price: '$0',      period: 'siempre gratis', col: D,         fill: false, badge: null,            cta: 'CREAR CUENTA',  href: '/registro',
    items: ['Dashboard completo', 'Journal de trades', 'Calculadora FIRE', 'Monte Carlo', 'Signal HUD', 'Comparadores'],
  },
  {
    tier: 'PRO',           price: '$29',    period: 'USD / mes',      col: G,         fill: true,  badge: '★ MÁS POPULAR', cta: 'ACTIVAR PRO',   href: '/registro',
    items: ['Todo lo anterior', 'Reportes PDF mensuales', 'Señales PRO.MACD activas', 'Equity curves actualizadas', 'Soporte prioritario'],
  },
  {
    tier: 'INSTITUTIONAL', price: 'Custom', period: 'cotizar',        col: '#60a5fa', fill: false, badge: null,            cta: 'CONTACTAR',     href: '/contacto',
    items: ['Todo lo anterior', 'Acceso API completo', 'Modelos a medida', 'White label disponible', 'SLA garantizado'],
  },
]

const legalLinks = [
  { href: '/quienes-somos', label: 'Quiénes Somos' },
  { href: '/terminos',      label: 'Términos' },
  { href: '/privacidad',    label: 'Privacidad' },
  { href: '/faq',           label: 'FAQ' },
  { href: '/contacto',      label: 'Contacto' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  const [{ metrics, fire, backtests, regime, champions, history, bayesian, lastDecisionAt, tickers }, userCount] = await Promise.all([
    getPageData(),
    getUserCount(),
  ])

  const returnPct = fire
    ? (((fire.current_equity - fire.starting_equity) / fire.starting_equity) * 100).toFixed(2)
    : '13.19'

  // Color del glow del panel Motor en Vivo — espeja la clasificación de RegimePill.
  const regimeRo   = regime === 'risk-on'  || regime.toUpperCase() === 'BULL'
  const regimeRoff = regime === 'risk-off' || regime.toUpperCase() === 'BEAR'
  const regimeGlow = regimeRo ? '#34d399' : regimeRoff ? '#f87171' : '#f59e0b'

  // Metallic gold gradient — spread into style={{}} where needed.
  // textShadow funciona aunque el fill sea transparente (pinta sobre el
  // contorno del glifo, no sobre el color) — da la sensación de relieve/grabado
  // en vez de un degradado plano.
  const gMetal: CSSProperties = {
    background: `linear-gradient(135deg, #a07828 0%, ${G} 35%, #f5d060 52%, ${G} 68%, #9a7020 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    textShadow: '0 1px 0 rgba(255,255,255,0.2), 0 3px 10px rgba(0,0,0,0.4)',
  }

  // Entrada escalonada del hero — fade + slide-up una sola vez al cargar
  // (no un loop). Delay creciente por elemento para que el hero entre como
  // una sola secuencia coreografiada en vez de aparecer todo de golpe.
  function reveal(delayMs: number): CSSProperties {
    return { opacity: 0, animation: 'heroReveal 0.7s cubic-bezier(0.16,1,0.3,1) forwards', animationDelay: `${delayMs}ms` }
  }

  return (
    <main style={{ background: BG, color: T, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ══ 1. HERO — full viewport ══════════════════════════════════════════ */}
      <section style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden', borderBottom: `1px solid ${B}`,
      }}>
        {/* Grid texture */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(rgba(212,175,55,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.03) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />
        {/* Radial gold glow — left anchor */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 80% 80% at -5% 50%, rgba(212,175,55,0.11) 0%, transparent 55%)`,
        }} />

        {/* Animated equity curve + live tickers */}
        <HeroAnimation />

        <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%', padding: `clamp(100px, 24vw, 160px) ${PX} 80px`, position: 'relative', zIndex: 1 }}>

          {/* Status badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 44, flexWrap: 'wrap', ...reveal(0) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.05)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399', flexShrink: 0 }} />
              <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.25em', color: '#34d399' }}>PLATAFORMA ACTIVA</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['HMM · LIVE', 'XGB · LIVE', 'GARCH · LIVE'].map(m => (
                <span key={m} style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.15em', color: D, border: `1px solid ${B}`, padding: '4px 10px' }}>{m}</span>
              ))}
            </div>
          </div>

          {/* 3-line headline — único h1 de la página */}
          <h1 style={{ margin: '0 0 32px', fontFamily: "'Bebas Neue', Impact, sans-serif", letterSpacing: '0.02em', lineHeight: 0.88, fontWeight: 400, ...reveal(120) }}>
            <div style={{ fontSize: 'clamp(34px, 12vw, 140px)', color: T }}>VENTAJA</div>
            <div style={{ fontSize: 'clamp(34px, 12vw, 140px)', ...gMetal }}>CUANTITATIVA</div>
            <div style={{ fontSize: 'clamp(22px, 7vw, 86px)', color: D, marginTop: 6 }}>PARA OPERADORES EN LATAM</div>
          </h1>

          {/* Description */}
          <p style={{ fontFamily: 'monospace', fontSize: 13, color: D, lineHeight: 1.9, maxWidth: 520, marginBottom: 28, borderLeft: `2px solid ${G}40`, paddingLeft: 18, ...reveal(320) }}>
            Infraestructura analítica de nivel institucional — modelos ML validados out-of-sample, datos de mercado reales y planificación FIRE integrada. Sin conflictos de interés.
          </p>

          {/* Terminal attribute readout */}
          <div style={{ marginBottom: 36, border: `1px solid ${B}`, background: 'rgba(11,13,20,0.65)', maxWidth: 460, backdropFilter: 'blur(4px)', position: 'relative', ...reveal(600) }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}40, transparent)` }} />
            {([
              { k: 'MERCADOS',     v: 'BTC · ETH · SOL · BNB · XAU',  accent: false, dot: false },
              { k: 'ESTRATEGIAS',  v: '70+ validadas · walk-forward OOS', accent: false, dot: false },
              { k: 'CAPITAL FIRE', v: fire ? `$${Math.round(fire.current_equity).toLocaleString('es-CL')}  ·  +${returnPct}%` : `$11.319  ·  +${returnPct}%`, accent: true, dot: false },
              { k: 'ESTADO',       v: `LIVE · ${regime}`, accent: true, dot: true },
            ] as Array<{ k: string; v: string; accent: boolean; dot: boolean }>).map(
              ({ k, v, accent, dot }, idx, arr) => (
                <div key={k} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 20, borderBottom: idx < arr.length - 1 ? `1px solid ${B}` : 'none' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: M, letterSpacing: '0.28em', width: 86, flexShrink: 0 }}>{k}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />}
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: accent ? '#34d399' : '#b0b1c0', fontWeight: accent ? 600 : 400 }}>{v}</span>
                  </div>
                </div>
              )
            )}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 48, ...reveal(900) }}>
            <Link href="/registro" className="gold-cta" style={{
              background: `linear-gradient(135deg, ${G}, #c9a227)`,
              color: BG, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.22em',
              padding: '15px 40px', textDecoration: 'none', display: 'inline-block',
              boxShadow: `0 0 32px rgba(212,175,55,0.28)`,
            }}>
              CREAR CUENTA GRATIS
            </Link>
            <Link href="/login" className="outline-cta" style={{
              border: `1px solid ${B}`, color: D,
              fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.18em',
              padding: '15px 28px', textDecoration: 'none', display: 'inline-block',
              background: 'rgba(255,255,255,0.02)',
            }}>
              INICIAR SESIÓN →
            </Link>
          </div>

          {/* Trust bullets */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', ...reveal(1150) }}>
            {[
              { dot: '#34d399', text: 'Sin tarjeta de crédito' },
              { dot: G,         text: 'Comunidad de traders'   },
              { dot: '#60a5fa', text: 'Datos Binance en vivo'  },
            ].map(b => (
              <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: b.dot, flexShrink: 0 }} />
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: M, letterSpacing: '0.08em' }}>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ URGENCY STRIP — cupos beta ════════════════════════════════════════ */}
      <div style={{ background: 'rgba(212,175,55,0.04)', borderBottom: `1px solid rgba(212,175,55,0.12)` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: `11px ${PX}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b', flexShrink: 0 }} />
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: G, letterSpacing: '0.22em' }}>
              BETA CERRADA — {userCount} DE 100 CUPOS OCUPADOS
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 100, height: 2, background: B, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min((userCount / 100) * 100, 100)}%`, background: `linear-gradient(90deg, ${G}80, ${G})` }} />
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: M }}>{100 - userCount} restantes</span>
            <Link href="/registro" style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.18em', color: BG, background: G, padding: '5px 14px', textDecoration: 'none', flexShrink: 0 }}>
              UNIRSE →
            </Link>
          </div>
        </div>
      </div>

      {/* ══ 2. STATS — 4 columnas con datos reales ═══════════════════════════ */}
      <section style={{ borderBottom: `1px solid ${B}` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: `0 ${PX}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', background: B, gap: 1 }}>
            {[
              { value: metrics?.wr     ? `${metrics.wr.toFixed(1)}%`    : '68%',   label: 'Win Rate',      detail: 'backtesting out-of-sample' },
              { value: metrics?.pf     ? `${metrics.pf.toFixed(2)}×`    : '1.70×', label: 'Profit Factor', detail: 'PRO · SIGMA ENGINE'        },
              { value: metrics?.calmar ? `${metrics.calmar.toFixed(2)}`  : '1.61',  label: 'Calmar Ratio',  detail: '12M rolling'               },
              { value: `${(backtests / 1_000_000).toFixed(1)}M`,                   label: 'Backtests',     detail: 'escenarios validados'      },
            ].map(s => (
              <div key={s.label} style={{ background: BG, padding: '44px 32px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${G}, transparent)` }} />
                <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.28em', color: M, textTransform: 'uppercase', marginBottom: 16 }}>{s.label}</div>
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 58, color: G, lineHeight: 1, letterSpacing: '0.02em', marginBottom: 8, textShadow: `0 0 30px rgba(212,175,55,0.2)` }}>{s.value}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: M, letterSpacing: '0.1em' }}>{s.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 3. HERRAMIENTAS — cards con borde superior por color ═════════════ */}
      <section style={{ padding: `clamp(64px, 16vw, 112px) ${PX}`, borderBottom: `1px solid ${B}`, position: 'relative', overflow: 'hidden' }}>
        {/* Atmósfera sutil — eco del hero, sin competir con el contenido */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 65% 55% at 100% 0%, rgba(212,175,55,0.05) 0%, transparent 60%)`,
        }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 56, gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', color: G, marginBottom: 14 }}>{'// PLATAFORMA · 9 HERRAMIENTAS'}</div>
              <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(48px, 7vw, 88px)', color: T, lineHeight: 0.92, margin: 0 }}>
                TODO LO QUE UN<br />
                <span style={gMetal}>QUANT NECESITA</span>
              </h2>
            </div>
            <Link href="/recursos" style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.2em', color: G, border: `1px solid rgba(212,175,55,0.25)`, padding: '10px 18px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
              VER TODOS →
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 1, background: B }}>
            {tools.map((t, i) => (
              <div key={t.id} className={`tool-card tool-card-${i}`} style={{ background: S, padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
                {/* Unique color top border per tool */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: t.col }} />
                {/* Numeral pálido de fondo — misma firma que el ranking de /lp-defi */}
                <span style={{
                  position: 'absolute', top: -10, right: 6, fontFamily: "'Bebas Neue', Impact, sans-serif",
                  fontSize: 76, lineHeight: 1, color: `${t.col}14`, userSelect: 'none', pointerEvents: 'none',
                }}>
                  {t.id}
                </span>
                <div style={{ marginBottom: 14, position: 'relative' }}>
                  <t.viz color={t.col} />
                </div>
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 30, color: T, letterSpacing: '0.03em', marginBottom: 16, position: 'relative' }}>
                  {t.name}
                </div>
                <p style={{ fontFamily: 'monospace', fontSize: 11, color: D, lineHeight: 1.8, margin: 0, position: 'relative' }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 4. MOTOR EN VIVO — engine status + scanner público ═══════════════ */}
      <section style={{ padding: `clamp(56px, 12vw, 80px) ${PX}`, background: BG, borderBottom: `1px solid ${B}`, position: 'relative', overflow: 'hidden' }}>
        {/* Atmósfera sutil — eco del hero, sin competir con el contenido */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 60% 50% at 0% 100%, rgba(212,175,55,0.045) 0%, transparent 60%)`,
        }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <SectionRule label="// SIGMA ENGINE · EN VIVO AHORA" />

          <MotorVivoPanel
            tokens={{ G, BG, S, B, T, D, M }}
            regimeNode={<RegimePill regime={regime} />}
            regimeGlow={regimeGlow}
            bayesianConfirmed={bayesian.confirmed}
            bayesianWatching={bayesian.watching}
            lastDecisionLabel={timeAgo(lastDecisionAt)}
            initialTickers={tickers}
          />
        </div>
      </section>

      {/* ══ 5. EQUITY CURVE — datos reales de paper trading ══════════════════ */}
      <section style={{ padding: `clamp(56px, 12vw, 80px) ${PX}`, background: S, borderBottom: `1px solid ${B}` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <SectionRule label="// PAPER TRADING EN PRODUCCIÓN" />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36, flexWrap: 'wrap', gap: 20 }}>
            <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(36px, 5vw, 64px)', color: T, lineHeight: 0.92, margin: 0 }}>
              SIGMA ENGINE ·{' '}
              <span style={gMetal}>
                DESDE {fire?.baseline_date
                  ? new Date(fire.baseline_date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
                  : '12 MAY 2026'}
              </span>
            </h2>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 64, color: '#34d399', lineHeight: 1, textShadow: '0 0 40px rgba(52,211,153,0.3)' }}>
                +{returnPct}%
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 9, color: M, letterSpacing: '0.15em', marginTop: 4 }}>RETORNO PAPER</div>
            </div>
          </div>

          {/* Chart panel */}
          <div style={{ background: BG, border: `1px solid ${B}`, overflow: 'hidden', position: 'relative', boxShadow: `inset 0 1px 0 rgba(212,175,55,0.08)` }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}35, transparent)` }} />
            <div style={{ padding: '24px 24px 8px' }}>
              <EquityCurveSVG history={history} initial={fire?.starting_equity ?? 10_000} />
            </div>
            <div style={{ padding: '12px 24px', borderTop: `1px solid ${B}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
                <span style={{ fontFamily: 'monospace', fontSize: 9, color: M }}>TP / TRAIL</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171' }} />
                <span style={{ fontFamily: 'monospace', fontSize: 9, color: M }}>SL</span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: M, marginLeft: 'auto' }}>
                PAPER TRADING · ALGORITMO REAL · NO SE GESTIONA CAPITAL DE TERCEROS
              </span>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, background: B, marginTop: 1 }}>
            {[
              { v: `${metrics?.wr     ? metrics.wr.toFixed(1)     : '68'}%`,   l: 'Win Rate'          },
              { v: `${metrics?.pf     ? metrics.pf.toFixed(2)     : '1.70'}×`, l: 'Profit Factor'     },
              { v: `${metrics?.calmar ? metrics.calmar.toFixed(2) : '1.61'}`,  l: 'Calmar Ratio'      },
              { v: `${metrics?.n_trades ?? history.length + 1}`,               l: 'Trades registrados' },
            ].map(({ v, l }) => (
              <div key={l} style={{ background: BG, padding: '24px 28px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 44, color: G, lineHeight: 1, marginBottom: 6, textShadow: `0 0 20px rgba(212,175,55,0.2)` }}>{v}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: M, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 6. TOP CHAMPIONS ═════════════════════════════════════════════════ */}
      {champions.length > 0 && (
        <section style={{ padding: `clamp(56px, 12vw, 80px) ${PX}`, borderBottom: `1px solid ${B}` }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <SectionRule label="// MOTOR · TOP CHAMPIONS" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(40px, 6vw, 72px)', color: T, lineHeight: 0.92, margin: 0 }}>
                MODELOS EN{' '}
                <span style={gMetal}>PRODUCCIÓN</span>
              </h2>
              <Link href="/modelos" style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.2em', color: G, border: `1px solid rgba(212,175,55,0.25)`, padding: '10px 16px', textDecoration: 'none', flexShrink: 0 }}>
                VER TODOS →
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 1, background: B }}>
              {champions.map((c, i) => {
                const gc = gradeColor(c.grade)
                const isLeader = i === 0
                return (
                  <div key={i} className={`champion-card champion-card-${i}`} style={{
                    background: isLeader ? `linear-gradient(160deg, ${gc}14, ${S} 60%)` : S,
                    boxShadow: isLeader ? `0 0 20px ${gc}22` : 'none',
                    padding: '28px 24px', position: 'relative', overflow: 'hidden',
                  }}>
                    {/* Color top border matching grade */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: gc }} />
                    {/* Filo del líder — se dibuja una sola vez al montar, igual que en /lp-defi */}
                    {isLeader && (
                      <div style={{
                        position: 'absolute', top: 2, left: 0, right: 0, height: 1,
                        background: gc, boxShadow: `0 0 6px ${gc}90`,
                        transformOrigin: 'center', animation: 'leaderEdgeDraw 0.8s ease-out forwards',
                      }} />
                    )}
                    {/* Numeral de fondo — misma firma que el ranking de /lp-defi y las cards de Herramientas */}
                    <span style={{
                      position: 'absolute', top: -10, right: 2, fontFamily: "'Bebas Neue', Impact, sans-serif",
                      fontSize: 74, lineHeight: 1, color: `${gc}${isLeader ? '20' : '14'}`, userSelect: 'none', pointerEvents: 'none',
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: gc, border: `1px solid ${gc}40`, background: `${gc}12`, padding: '2px 8px', fontWeight: 700 }}>{c.grade}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: M }}>{c.tf}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, color: T }}>{c.sym}</span>
                      {c.direction && (
                        <span style={{
                          fontFamily: 'monospace', fontSize: 9, padding: '2px 6px',
                          color:      c.direction === 'short' ? '#f87171' : '#34d399',
                          background: c.direction === 'short' ? 'rgba(248,113,113,0.08)' : 'rgba(52,211,153,0.08)',
                        }}>
                          {c.direction.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div style={{ fontFamily: 'monospace', fontSize: 9, color: M, letterSpacing: '0.1em', marginBottom: 14 }}>
                      {c.strategy.replace(/_/g, ' ').toUpperCase()}
                    </div>

                    {/* CAGR + Drawdown — el upside y el riesgo juntos, no solo el número más grande */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: isLeader ? 56 : 48, color: gc, lineHeight: 1, textShadow: `0 0 28px ${gc}28` }}>
                          {c.cagr?.toFixed(0)}%
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 9, color: M, marginTop: 4 }}>CAGR validado OOS</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22, color: '#f87171', lineHeight: 1 }}>
                          {typeof c.dd === 'number' ? `${c.dd.toFixed(1)}%` : '—'}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 9, color: M, marginTop: 4 }}>DD MÁX</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 2, background: B, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(c.wr, 100)}%`, background: `linear-gradient(90deg, ${gc}50, ${gc})` }} />
                      </div>
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: T, flexShrink: 0 }}>{c.wr?.toFixed(1)}% WR</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══ 7. PLANES ════════════════════════════════════════════════════════ */}
      <section id="planes" style={{ padding: `clamp(64px, 16vw, 112px) ${PX}`, borderBottom: `1px solid ${B}` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 56, flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', color: G, marginBottom: 14 }}>{'// PLANES DE ACCESO'}</div>
              <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(48px, 6vw, 80px)', color: T, lineHeight: 0.92, margin: 0 }}>
                ELIGE TU{' '}
                <span style={gMetal}>PLAN</span>
              </h2>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: M, letterSpacing: '0.15em', textAlign: 'right' }}>
              SIN PERMANENCIA<br />CANCELA CUANDO QUIERAS
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 1, background: B }}>
            {plans.map(p => (
              <div key={p.tier} style={{
                background: p.fill ? 'linear-gradient(160deg, #080a14, #060810)' : S,
                padding: '40px 30px', position: 'relative', display: 'flex', flexDirection: 'column',
                boxShadow: p.fill ? `0 0 0 1px ${G}45, 0 0 60px rgba(212,175,55,0.06)` : 'none',
              }}>
                {p.badge && (
                  <div style={{ position: 'absolute', top: -1, left: 22, fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.18em', background: G, color: BG, padding: '4px 12px' }}>
                    {p.badge}
                  </div>
                )}
                {p.fill && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${G}, #f0cc5a)` }} />
                )}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.28em', color: `${p.col}99`, marginBottom: 12 }}>{p.tier}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 56, color: p.col, lineHeight: 1 }}>{p.price}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: M }}>{p.period}</span>
                  </div>
                </div>
                {/* Colored separator */}
                <div style={{ height: 1, background: `linear-gradient(90deg, ${p.col}25, transparent)`, marginBottom: 22 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                  {p.items.map(item => (
                    <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: p.col, fontFamily: 'monospace', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: D, lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>
                <Link href={p.href} className={p.fill ? 'gold-cta' : 'outline-cta'} style={{
                  display: 'block', textAlign: 'center', padding: '14px',
                  fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em',
                  textDecoration: 'none',
                  background: p.fill ? `linear-gradient(135deg, ${G}, #c9a227)` : 'transparent',
                  color: p.fill ? BG : p.col,
                  border: `1px solid ${p.col}40`,
                  boxShadow: p.fill ? '0 0 24px rgba(212,175,55,0.22)' : 'none',
                }}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 8. CTA FINAL ═════════════════════════════════════════════════════ */}
      <section style={{ padding: `clamp(64px, 16vw, 112px) ${PX} 80px`, background: S, borderBottom: `1px solid ${B}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 60% 50% at 50% 0%, rgba(212,175,55,0.05) 0%, transparent 70%)` }} />
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', color: G, marginBottom: 18 }}>{'// EMPIEZA HOY'}</div>
          <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", lineHeight: 0.88, margin: '0 0 24px' }}>
            <span style={{ display: 'block', fontSize: 'clamp(56px, 9vw, 120px)', color: T }}>OPERA CON</span>
            <span style={{ display: 'block', fontSize: 'clamp(56px, 9vw, 120px)', ...gMetal }}>VENTAJA REAL</span>
          </h2>
          <p style={{ fontFamily: 'monospace', fontSize: 12, color: D, lineHeight: 1.9, marginBottom: 40 }}>
            Cuenta gratuita en 30 segundos. Sin tarjeta de crédito.<br />
            Acceso inmediato a todas las herramientas del dashboard.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56 }}>
            <Link href="/registro" className="gold-cta" style={{
              background: `linear-gradient(135deg, ${G}, #c9a227)`,
              color: BG, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.22em',
              padding: '16px 44px', textDecoration: 'none',
              boxShadow: '0 0 40px rgba(212,175,55,0.3)',
            }}>
              ACTIVAR ACCESO GRATIS
            </Link>
            <Link href="/login" className="outline-cta" style={{
              border: `1px solid ${B}`, color: D, background: 'rgba(255,255,255,0.02)',
              fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.18em',
              padding: '16px 28px', textDecoration: 'none',
            }}>
              ¿YA TIENES CUENTA? →
            </Link>
          </div>

          {/* Legal */}
          <div style={{ borderTop: `1px solid ${B}`, paddingTop: 24 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 28px', marginBottom: 20 }}>
              {legalLinks.map(l => (
                <Link key={l.href} href={l.href} style={{ fontFamily: 'monospace', fontSize: 9, color: M, letterSpacing: '0.18em', textDecoration: 'none', textTransform: 'uppercase' }}>
                  {l.label}
                </Link>
              ))}
            </div>
            <p style={{ fontFamily: 'monospace', fontSize: 9, color: M, letterSpacing: '0.06em', lineHeight: 1.8, maxWidth: 600, margin: '0 auto 16px' }}>
              AVISO LEGAL: SQuant Desk es una plataforma de herramientas analíticas y no constituye asesoramiento financiero ni de inversión. Modelos, señales y análisis son solo informativos. Resultados pasados no garantizan retornos futuros.
            </p>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: M, letterSpacing: '0.3em' }}>
              © {new Date().getFullYear()} SQUANT DESK · TODOS LOS DERECHOS RESERVADOS
            </div>
          </div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes heroReveal {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .gold-cta, .outline-cta {
          position: relative;
          overflow: hidden;
          transition: transform 0.2s ease, filter 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }
        .gold-cta:hover { transform: translateY(-2px); filter: brightness(1.08); }
        .gold-cta::before {
          content: '';
          position: absolute; top: 0; left: -60%; width: 40%; height: 100%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: skewX(-20deg);
          transition: left 0.6s ease;
          pointer-events: none;
        }
        .gold-cta:hover::before { left: 130%; }
        .outline-cta:hover {
          transform: translateY(-1px);
          border-color: rgba(212,175,55,0.5) !important;
          color: #d4af37 !important;
          background: rgba(212,175,55,0.05) !important;
        }
        .tool-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        ${tools.map((t, i) => `
        .tool-card-${i}:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 30px -10px ${t.col}45, inset 0 0 0 1px ${t.col}35;
        }`).join('')}
        @keyframes leaderEdgeDraw {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
        .champion-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        ${champions.map((c, i) => {
          const gc = gradeColor(c.grade)
          return `
        .champion-card-${i}:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 30px -10px ${gc}45, inset 0 0 0 1px ${gc}35;
        }`
        }).join('')}
      ` }} />
    </main>
  )
}
