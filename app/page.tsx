import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import EngineHeroPanel from './components/landing/EngineHeroPanel'

export const metadata: Metadata = {
  title: 'SQuant Desk — Infraestructura Cuantitativa LATAM',
  description:
    'Infraestructura cuantitativa institucional para inversores independientes en LATAM. Terminal en vivo, modelos ML, simulador FIRE y más.',
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Champion {
  sym: string; tf: string; strategy: string; grade: string
  wr: number; cagr: number; direction?: string; dd?: number
}
interface HistoryTrade {
  sym: string; direction: string; status: string
  equity_after?: number; closed_at?: string
}
interface FireData {
  current_equity: number; starting_equity: number
  target_equity: number; progress_pct: number; baseline_date: string
}

// ─── Server data fetch ────────────────────────────────────────────────────────
const VPS = process.env.VPS_URL ?? 'http://localhost:8080'

async function getPageData() {
  try {
    const [engineRes, publicRes] = await Promise.all([
      fetch(`${VPS}/api/v2/engine_status`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) }),
      fetch(`${VPS}/api/public`,           { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) }),
    ])
    const engine = engineRes.ok ? await engineRes.json() : null
    const pub    = publicRes.ok  ? await publicRes.json()  : null

    const fire: FireData | null           = engine?.fire ?? null
    const last_decision_at: string | null = engine?.last_decision_at ?? null
    const regime: string                  = pub?.regime ?? 'UNKNOWN'
    const champions: Champion[]           = (pub?.top_models ?? []).slice(0, 6)
    const history: HistoryTrade[]         = (pub?.history ?? []).filter(
      (t: HistoryTrade) => t.equity_after != null
    )
    return {
      metrics:   engine?.portfolio ?? null,
      fire,
      coverage:  engine?.coverage ?? null,
      backtests: Number(engine?.backtests_total ?? 16_767_345),
      last_decision_at,
      regime,
      champions,
      history,
    }
  } catch {
    return {
      metrics: null, fire: null as (FireData | null), coverage: null,
      backtests: 16_767_345, last_decision_at: null as (string | null),
      regime: 'UNKNOWN', champions: [] as Champion[], history: [] as HistoryTrade[],
    }
  }
}

// ─── Equity curve SVG (server-rendered) ───────────────────────────────────────
function EquityCurveSVG({ history, initial }: { history: HistoryTrade[]; initial: number }) {
  const points: Array<{ eq: number; status: string }> = [
    { eq: initial, status: 'start' },
    ...history.filter(t => t.equity_after != null).map(t => ({ eq: t.equity_after!, status: t.status })),
  ]
  if (points.length < 2) return null

  const W = 760, H = 140
  const PAD_X = 12, PAD_Y = 20
  const eqs   = points.map(p => p.eq)
  const minEq = Math.min(...eqs) - 150
  const maxEq = Math.max(...eqs) + 150

  const mapX = (i: number) => PAD_X + (i / (points.length - 1)) * (W - 2 * PAD_X)
  const mapY = (eq: number) => H - PAD_Y - ((eq - minEq) / (maxEq - minEq)) * (H - 2 * PAD_Y)

  const linePts = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${mapX(i).toFixed(1)},${mapY(p.eq).toFixed(1)}`)
    .join(' ')
  const lastX   = mapX(points.length - 1)
  const fillPts = `${linePts} L${lastX.toFixed(1)},${H} L${PAD_X},${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }} aria-hidden="true">
      <defs>
        <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#d4af37" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="0"    />
        </linearGradient>
        <linearGradient id="eq-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#d4af37" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="1"   />
        </linearGradient>
        <filter id="glow-gold" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Subtle horizontal grid dashes */}
      {[0.25, 0.5, 0.75].map(t => (
        <line key={t}
          x1={PAD_X} y1={(H - PAD_Y) - t * (H - 2 * PAD_Y)}
          x2={W - PAD_X} y2={(H - PAD_Y) - t * (H - 2 * PAD_Y)}
          stroke="rgba(212,175,55,0.07)" strokeWidth="1" strokeDasharray="4,10"
        />
      ))}

      {/* Area fill */}
      <path d={fillPts} fill="url(#eq-fill)" />

      {/* Line with glow */}
      <path d={linePts} fill="none" stroke="url(#eq-line)"
        strokeWidth="1.5" strokeLinejoin="round" filter="url(#glow-gold)" />

      {/* Trade markers */}
      {points.slice(1).map((p, i) => {
        const x     = mapX(i + 1)
        const y     = mapY(p.eq)
        const isWin = p.status === 'TP_HIT' || p.status === 'TRAIL_HIT'
        const color = isWin ? '#34d399' : '#f87171'
        return (
          <g key={i}>
            <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="5"
              fill={color} fillOpacity="0.12" stroke={color} strokeOpacity="0.3" strokeWidth="1" />
            <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={color} fillOpacity="0.9" />
          </g>
        )
      })}

      {/* Last point — pulsing ring effect (static, 2 circles) */}
      <circle
        cx={mapX(points.length - 1).toFixed(1)}
        cy={mapY(points[points.length - 1].eq).toFixed(1)}
        r="6" fill="none" stroke="#d4af37" strokeOpacity="0.2" strokeWidth="1"
      />
      <circle
        cx={mapX(points.length - 1).toFixed(1)}
        cy={mapY(points[points.length - 1].eq).toFixed(1)}
        r="3" fill="#d4af37"
      />
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gradeColor(grade: string) {
  if (grade === 'A+') return '#d4af37'
  if (grade === 'A')  return '#4a9eff'
  if (grade === 'B')  return '#8b8fa8'
  return '#f87171'
}

const REGIME_COLOR: Record<string, string> = {
  BEAR: '#f87171', BULL: '#34d399', NEUTRAL: '#d4af37', UNKNOWN: '#7a7f9a',
}

// Section divider with label — luxury chapter marker
function SectionRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-5">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold/15" />
      <span className="terminal-text text-[8px] text-gold/25 tracking-[0.5em] shrink-0 select-none">{label}</span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold/15" />
    </div>
  )
}

// ─── Static data ──────────────────────────────────────────────────────────────
const tools = [
  { tag: 'T-01', name: 'SIGMA ENGINE',      desc: 'Motor de trading cuantitativo 24/7. 70+ estrategias sobre BTC/ETH/SOL/BNB/LTC/XAU con Bayesian Search, walk-forward OOS y paper trading en tiempo real.' },
  { tag: 'T-02', name: 'MODELOS ML',        desc: 'Champions cuantitativos con grades A+/A/B/C. Cada modelo valida con robustness gate, OOS gate y Kelly sizing antes de activarse.' },
  { tag: 'T-03', name: 'MOTOR DE DECISIÓN', desc: 'Rotación cross-market. Señales BUY/SELL/HOLD sobre ETFs, fondos mutuos, cripto y renta fija. Ajustado por régimen de mercado (risk-on/off).' },
  { tag: 'T-04', name: 'MONTE CARLO',       desc: '10.000 simulaciones de portafolio con ajuste por inflación CLP/USD, retiro dinámico y percentiles de probabilidad de ruina.' },
  { tag: 'T-05', name: 'SIMULADOR FIRE',    desc: 'Proyección de independencia financiera con horizonte personalizable. Calcula tu número FIRE y el tiempo estimado para alcanzarlo.' },
  { tag: 'T-06', name: 'SEÑALES LP',        desc: 'Motor cuantitativo para PancakeSwap v3. Rangos óptimos, Kelly sizing, Monte Carlo de impermanent loss y APR estimado por par.' },
]

const plans = [
  {
    name: 'TERMINAL', price: '$0', period: 'siempre gratis', color: '#8b8fa8',
    recommended: false, cta: 'EMPEZAR GRATIS', href: '/registro',
    items: ['Dashboard de portfolio', 'Journal de trades', 'Calculadora FIRE básica', 'Calendario macro'],
  },
  {
    name: 'PRO', price: '$29', period: '/mes USD', color: '#d4af37',
    recommended: true, cta: 'ACTIVAR PRO', href: '/registro',
    items: ['Todo lo anterior', 'Modelos ML + señales', 'Monte Carlo avanzado', 'LP DeFi cuantitativo', 'Reporte mensual PDF', 'Soporte prioritario'],
  },
  {
    name: 'INSTITUTIONAL', price: 'Custom', period: 'cotizar', color: '#4a9eff',
    recommended: false, cta: 'CONTACTAR', href: '/contacto',
    items: ['Todo lo anterior', 'API acceso directo', 'Modelos a medida', 'White label disponible', 'SLA garantizado', 'Multi-usuario'],
  },
]

const legalLinks = [
  { href: '/quienes-somos', label: 'Quiénes Somos' },
  { href: '/terminos',      label: 'Términos y Condiciones' },
  { href: '/privacidad',    label: 'Privacidad' },
  { href: '/faq',           label: 'FAQ' },
  { href: '/contacto',      label: 'Contacto' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  const { metrics, fire, coverage, backtests, regime, champions, history } = await getPageData()

  const returnPct   = fire
    ? (((fire.current_equity - fire.starting_equity) / fire.starting_equity) * 100).toFixed(2)
    : '13.19'
  const regimeColor = REGIME_COLOR[regime] ?? '#7a7f9a'

  // Metallic gold gradient — reused in headlines
  const goldMetal: CSSProperties = {
    background: 'linear-gradient(135deg, #a07828 0%, #d4af37 35%, #f5d060 52%, #d4af37 68%, #9a7020 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  }

  return (
    <main className="bg-bg min-h-screen">

      {/* ══ 1. HERO ══════════════════════════════════════════════════════════ */}
      <section className="pt-40 pb-24 px-6 bg-grid-pattern bg-grid relative overflow-hidden border-b border-gold/8">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        {/* Vignette for depth — pulls focus to centre */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 85% 85% at 50% 50%, transparent 35%, rgba(4,5,10,0.55) 100%)' }}
        />

        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-[1fr_420px] gap-16 items-center">

            {/* Left — headline + readout + CTAs */}
            <div>
              <div className="section-label text-gold/50 mb-6 tracking-[0.4em]">{'// SQUANT DESK · LATAM'}</div>

              <h1 className="display-heading text-[clamp(4.5rem,11vw,9rem)] text-text leading-[0.9] mb-8">
                SQUANT<br />
                <span style={goldMetal}>DESK</span>
              </h1>

              {/* Terminal attribute readout — shows system status, not just marketing */}
              <div className="mb-10 border border-gold/10 bg-surface/20 backdrop-blur-sm relative">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/35 to-transparent" />
                {([
                  { k: 'MERCADOS',     v: 'BTC · ETH · SOL · BNB · XAU',   accent: false, live: false },
                  { k: 'ESTRATEGIAS',  v: '70+ validadas · walk-forward OOS', accent: false, live: false },
                  { k: 'CAPITAL FIRE', v: fire
                      ? `$${Math.round(fire.current_equity).toLocaleString('es-CL')}  ·  +${returnPct}%`
                      : `$11.319  ·  +${returnPct}%`,
                    accent: true, live: false },
                  { k: 'ESTADO',       v: `LIVE · ${regime}`, accent: true, live: true },
                ] as Array<{ k: string; v: string; accent: boolean; live: boolean }>).map(
                  ({ k, v, accent, live }, idx, arr) => (
                    <div
                      key={k}
                      className={`px-5 py-2.5 flex items-center gap-5 ${idx < arr.length - 1 ? 'border-b border-gold/5' : ''}`}
                    >
                      <span className="terminal-text text-[9px] text-gold/30 tracking-[0.3em] w-24 shrink-0">{k}</span>
                      <div className="flex items-center gap-2">
                        {live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
                        <span
                          className="terminal-text text-[10px] font-medium"
                          style={{ color: accent ? '#34d399' : '#c0c1d0' }}
                        >
                          {v}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/registro"
                  className="section-label px-8 py-3.5 text-center relative overflow-hidden transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #c09520, #d4af37, #e5c84a)',
                    color: '#04050a',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 28px rgba(212,175,55,0.22)',
                  }}
                >
                  {/* inner sheen */}
                  <span className="absolute inset-0 bg-gradient-to-b from-white/8 to-transparent pointer-events-none" />
                  <span className="relative z-10">CREAR CUENTA GRATIS</span>
                </Link>
                <Link
                  href="/login"
                  className="group border border-gold/18 text-gold/55 section-label px-8 py-3.5 hover:border-gold/45 hover:text-gold/80 transition-all duration-300 text-center relative overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gold/0 group-hover:bg-gold/3 transition-colors duration-300 pointer-events-none" />
                  <span className="relative z-10">INICIAR SESIÓN</span>
                </Link>
              </div>
            </div>

            {/* Right — live engine panel */}
            <div>
              <EngineHeroPanel />
            </div>
          </div>
        </div>
      </section>

      {/* ══ 2. ENGINE STATUS STRIP ═══════════════════════════════════════════ */}
      <section
        className="border-b border-gold/8"
        style={{ background: 'linear-gradient(90deg, #07080f, #050610, #07080f)' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="terminal-text text-[9px] text-emerald-400 tracking-[0.3em] font-medium">MOTOR ACTIVO</span>
            </div>
            {[
              { label: 'RÉGIMEN',   value: regime, color: regimeColor },
              { label: 'EQUITY',    value: fire ? `$${fire.current_equity.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '--', color: '#d4af37' },
              { label: 'RETORNO',   value: `+${returnPct}%`, color: '#34d399' },
              { label: 'WIN RATE',  value: metrics?.wr ? `${metrics.wr.toFixed(0)}%` : '68%', color: undefined },
              { label: 'MODELOS',   value: `${coverage?.active ?? 18} activos`, color: undefined },
              { label: 'BACKTESTS', value: `${(backtests / 1_000_000).toFixed(1)}M`, color: undefined },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:block w-px h-4 bg-gold/10" />
                <span className="terminal-text text-[9px] text-gold/28 tracking-[0.2em]">{label}</span>
                <span
                  className="terminal-text text-[9px] font-bold tabular-nums"
                  style={color ? { color } : { color: '#c0c1d0' }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 3. HERRAMIENTAS ══════════════════════════════════════════════════ */}
      <section id="herramientas" className="py-24 px-6 bg-bg">
        <div className="max-w-7xl mx-auto">
          <SectionRule label="// HERRAMIENTAS · 6 MÓDULOS" />
          <div className="mt-14 mb-12">
            <h2 className="display-heading text-5xl sm:text-7xl text-text">
              TODO LO QUE<br /><span style={goldMetal}>NECESITAS</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-gold/5">
            {tools.map((t) => (
              <div
                key={t.tag}
                className="bg-surface p-6 flex flex-col gap-4 group relative overflow-hidden transition-colors duration-200 hover:bg-surface/75"
                style={{ borderLeft: '2px solid transparent', transition: 'border-color 0.25s, background-color 0.2s' }}
                onMouseEnter={undefined}
              >
                {/* Left accent — CSS only, via group-hover on parent we simulate with a pseudo via sibling */}
                <div className="absolute top-0 left-0 bottom-0 w-0.5 bg-gold/0 group-hover:bg-gold/35 transition-colors duration-300 pointer-events-none" />
                {/* Top scan on hover */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-gold/50 via-gold/12 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                {/* Corner brackets top-right — appear on hover */}
                <span className="absolute top-3 right-3 w-3.5 h-3.5 border-t border-r border-gold/0 group-hover:border-gold/25 transition-[border-color] duration-300 pointer-events-none" />
                <span className="absolute bottom-3 right-3 w-3.5 h-3.5 border-b border-r border-gold/0 group-hover:border-gold/20 transition-[border-color] duration-300 pointer-events-none" />

                <span className="terminal-text text-xs text-gold border border-gold/18 group-hover:border-gold/40 px-2 py-0.5 self-start transition-colors duration-200">
                  {t.tag}
                </span>
                <h3 className="display-heading text-2xl text-text group-hover:text-gold transition-colors duration-200">
                  {t.name}
                </h3>
                <p className="terminal-text text-sm text-text-dim leading-relaxed flex-1">{t.desc}</p>
                <div className="flex justify-end">
                  <span className="terminal-text text-[9px] tracking-[0.35em] text-gold/0 group-hover:text-gold/35 transition-colors duration-300">
                    EXPLORAR →
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-end">
            <Link
              href="/recursos"
              className="group section-label text-sm text-gold border border-gold/20 px-6 py-2.5 hover:bg-gold hover:text-bg transition-all duration-200 relative overflow-hidden"
            >
              VER TODOS LOS RECURSOS →
            </Link>
          </div>
        </div>
      </section>

      {/* ══ 4. EQUITY CURVE ══════════════════════════════════════════════════ */}
      <section
        className="py-20 px-6 border-y border-border"
        style={{ background: 'linear-gradient(180deg, #04050b 0%, #03040a 100%)' }}
      >
        <div className="max-w-7xl mx-auto">
          <SectionRule label="// PAPER TRADING EN PRODUCCIÓN" />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mt-14 mb-10">
            <div>
              <h2 className="display-heading text-4xl sm:text-6xl text-text">
                SIGMA ENGINE<br />
                <span style={goldMetal}>
                  DESDE {fire?.baseline_date
                    ? new Date(fire.baseline_date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
                    : '12 MAY 2026'}
                </span>
              </h2>
            </div>
            <div className="text-right shrink-0">
              <div
                className="num text-5xl sm:text-6xl font-bold text-emerald-400 tabular-nums leading-none"
                style={{ textShadow: '0 0 40px rgba(52,211,153,0.28)' }}
              >
                +{returnPct}%
              </div>
              <div className="terminal-text text-xs text-muted mt-2 tracking-[0.15em]">RETORNO PAPER</div>
            </div>
          </div>

          {/* SVG panel — deep glass */}
          <div
            className="relative border border-gold/12 overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #060710 0%, #030409 100%)',
              boxShadow: 'inset 0 1px 0 rgba(212,175,55,0.08)',
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/35 to-transparent" />
            <div className="px-6 pt-6 pb-2">
              <EquityCurveSVG history={history} initial={fire?.starting_equity ?? 10_000} />
            </div>
            <div className="px-6 py-3 border-t border-gold/6 flex flex-wrap items-center gap-x-6 gap-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="terminal-text text-[9px] text-muted">TP / TRAIL</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="terminal-text text-[9px] text-muted">SL</span>
              </div>
              <span className="terminal-text text-[9px] text-muted ml-auto">
                PAPER TRADING · ALGORITMO REAL · NO SE GESTIONA CAPITAL DE TERCEROS
              </span>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gold/5 mt-px">
            {[
              { v: `${metrics?.wr     ? metrics.wr.toFixed(0)     : '68'}%`,  l: 'Win Rate'          },
              { v: `${metrics?.pf     ? metrics.pf.toFixed(1)     : '1.7'}x`, l: 'Profit Factor'     },
              { v: `${metrics?.calmar ? metrics.calmar.toFixed(1) : '1.6'}x`, l: 'Calmar Ratio'      },
              { v: `${metrics?.n_trades ?? history.length + 1}`,              l: 'Trades registrados' },
            ].map(({ v, l }) => (
              <div key={l} className="bg-surface px-6 py-6 text-center group relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/12 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div
                  className="num text-3xl font-bold text-gold mb-1 tabular-nums"
                  style={{ textShadow: '0 0 24px rgba(212,175,55,0.18)' }}
                >
                  {v}
                </div>
                <div className="terminal-text text-[9px] text-muted tracking-[0.15em] uppercase">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 5. TOP CHAMPIONS ═════════════════════════════════════════════════ */}
      {champions.length > 0 && (
        <section className="py-20 px-6 bg-bg">
          <div className="max-w-7xl mx-auto">
            <SectionRule label="// MOTOR · TOP CHAMPIONS" />
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mt-14 mb-10">
              <div>
                <h2 className="display-heading text-4xl sm:text-6xl text-text">
                  MODELOS EN<br /><span style={goldMetal}>PRODUCCIÓN</span>
                </h2>
              </div>
              <Link
                href="/modelos"
                className="section-label text-xs text-gold border border-gold/20 px-5 py-2.5 hover:bg-gold hover:text-bg transition-all duration-200 self-start md:self-auto"
              >
                VER TODOS →
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gold/5">
              {champions.map((c, i) => {
                const gc = gradeColor(c.grade)
                return (
                  <div
                    key={i}
                    className="bg-surface p-6 relative overflow-hidden flex flex-col gap-4 group hover:bg-surface/70 transition-colors duration-200"
                  >
                    {/* Top scan on hover — colored by grade */}
                    <div
                      className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{ background: `linear-gradient(90deg, transparent, ${gc}45, transparent)` }}
                    />
                    {/* Bottom grade accent line — always visible, subtle */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
                      style={{ background: `linear-gradient(90deg, transparent, ${gc}20, transparent)` }}
                    />
                    {/* Rank — engraved feel */}
                    <div
                      className="absolute top-4 right-4 terminal-text text-[11px] font-bold tabular-nums select-none"
                      style={{ color: gc + '28' }}
                    >
                      #{String(i + 1).padStart(2, '0')}
                    </div>

                    {/* Grade + TF */}
                    <div className="flex items-center gap-3">
                      <span
                        className="terminal-text text-xs px-2.5 py-1 border font-bold"
                        style={{ color: gc, borderColor: gc + '40', background: gc + '0f' }}
                      >
                        {c.grade}
                      </span>
                      <span className="terminal-text text-[9px] text-muted">{c.tf}</span>
                    </div>

                    {/* Symbol + direction */}
                    <div className="flex items-baseline gap-3">
                      <span className="display-heading text-3xl text-text">{c.sym}</span>
                      {c.direction && (
                        <span
                          className="terminal-text text-[9px] px-1.5 py-0.5"
                          style={{
                            color:      c.direction === 'short' ? '#f87171' : '#34d399',
                            background: c.direction === 'short' ? 'rgba(248,113,113,0.08)' : 'rgba(52,211,153,0.08)',
                          }}
                        >
                          {c.direction.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Strategy */}
                    <div className="terminal-text text-[9px] text-muted tracking-[0.1em] -mt-2">
                      {c.strategy.replace(/_/g, ' ').toUpperCase()}
                    </div>

                    {/* CAGR — big number with grade glow */}
                    <div>
                      <div
                        className="num text-4xl font-bold tabular-nums leading-none"
                        style={{ color: gc, textShadow: `0 0 28px ${gc}28` }}
                      >
                        {c.cagr?.toFixed(0)}%
                      </div>
                      <div className="terminal-text text-[9px] text-muted mt-1">CAGR validado OOS</div>
                    </div>

                    {/* Win Rate bar */}
                    <div className="flex items-center gap-3 mt-auto">
                      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width:      `${Math.min(c.wr, 100)}%`,
                            background: `linear-gradient(90deg, ${gc}45, ${gc})`,
                          }}
                        />
                      </div>
                      <span className="terminal-text text-[10px] text-text tabular-nums shrink-0">
                        {c.wr?.toFixed(1)}% WR
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══ 6. PLANES ════════════════════════════════════════════════════════ */}
      <section
        className="py-24 px-6 border-t border-border"
        style={{ background: 'linear-gradient(180deg, #050609 0%, #03040a 60%)' }}
      >
        <div className="max-w-7xl mx-auto">
          <SectionRule label="// PLANES DE ACCESO" />
          <div className="mt-14 mb-16">
            <h2 className="display-heading text-5xl sm:text-7xl text-text">
              ELIGE TU<br /><span style={goldMetal}>PLAN</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-gold/5">
            {plans.map((p) => (
              <div
                key={p.name}
                className="bg-surface p-8 flex flex-col gap-6 relative overflow-hidden"
                style={p.recommended ? {
                  boxShadow: '0 0 0 1px rgba(212,175,55,0.32), 0 0 60px rgba(212,175,55,0.06), inset 0 1px 0 rgba(212,175,55,0.07)',
                  background: 'linear-gradient(160deg, #080a14, #060810)',
                } : undefined}
              >
                {/* PRO top accent line */}
                {p.recommended && (
                  <div
                    className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)' }}
                  />
                )}
                {p.recommended && (
                  <div
                    className="absolute -top-3 left-6 section-label text-xs px-3 py-0.5"
                    style={{ background: 'linear-gradient(135deg, #c09520, #d4af37)', color: '#04050a' }}
                  >
                    ★ RECOMENDADO
                  </div>
                )}

                <div>
                  <div
                    className="section-label mb-2 text-xs tracking-[0.35em]"
                    style={{ color: p.color + 'aa' }}
                  >
                    {p.name}
                  </div>
                  <div className="display-heading text-5xl font-bold" style={{ color: p.color }}>{p.price}</div>
                  <div className="terminal-text text-xs text-muted mt-1">{p.period}</div>
                </div>

                {/* Colored separator under price */}
                <div className="h-px" style={{ background: `linear-gradient(90deg, ${p.color}25, transparent)` }} />

                <ul className="flex flex-col gap-2.5 flex-1">
                  {p.items.map((item) => (
                    <li key={item} className="terminal-text text-sm text-text-dim flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0" style={{ color: p.color + 'aa' }}>→</span>
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href={p.href}
                  className="section-label text-sm text-center py-3 transition-all duration-200 relative overflow-hidden"
                  style={{
                    background:  p.recommended ? 'linear-gradient(135deg, #c09520, #d4af37)' : 'transparent',
                    color:       p.recommended ? '#04050a' : p.color,
                    border:      `1px solid ${p.color}38`,
                    boxShadow:   p.recommended ? '0 2px 16px rgba(212,175,55,0.18)' : undefined,
                  }}
                >
                  <span className="relative z-10">{p.cta}</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 7. CTA FINAL + LEGAL ═════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-bg border-t border-border relative overflow-hidden">
        {/* Radial gold breath from top */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(212,175,55,0.05) 0%, transparent 70%)' }}
        />

        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-8 mb-20 relative">
          <div className="terminal-text text-[9px] text-gold/30 tracking-[0.6em]">{'// EMPIEZA HOY'}</div>
          <h2 className="display-heading text-5xl sm:text-7xl text-text leading-[0.9]">
            OPERA CON<br />
            <span style={goldMetal}>VENTAJA</span>
            <br />REAL
          </h2>
          <p className="terminal-text text-text-dim leading-relaxed max-w-sm">
            Crea tu cuenta gratuita en segundos. Sin tarjeta de crédito.<br />
            Acceso inmediato al terminal y la calculadora FIRE.
          </p>
          <Link
            href="/registro"
            className="section-label px-12 py-4 relative overflow-hidden transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #c09520, #d4af37, #e5c848)',
              color: '#04050a',
              boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 8px 36px rgba(212,175,55,0.22)',
            }}
          >
            <span className="absolute inset-0 bg-gradient-to-b from-white/8 to-transparent pointer-events-none" />
            <span className="relative z-10">CREAR CUENTA GRATIS</span>
          </Link>
          <div className="terminal-text text-xs text-text-dim">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-gold/50 hover:text-gold transition-colors duration-200">
              Iniciar sesión →
            </Link>
          </div>
        </div>

        {/* Legal footer */}
        <div className="max-w-7xl mx-auto border-t border-gold/6 pt-10">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {legalLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="terminal-text text-xs text-muted/70 hover:text-gold/50 transition-colors duration-200 tracking-[0.2em] uppercase"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="terminal-text text-[10px] text-muted/35 text-center mt-6 tracking-[0.35em]">
            © {new Date().getFullYear()} SQUANT DESK · TODOS LOS DERECHOS RESERVADOS
          </div>
        </div>
      </section>

    </main>
  )
}
