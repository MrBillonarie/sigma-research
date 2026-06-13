import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
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

    return {
      metrics:          engine?.portfolio                              ?? null,
      fire:             engine?.fire                                   ?? null as FireData | null,
      coverage:         engine?.coverage                               ?? null,
      backtests:        (engine?.backtests_total ?? 16_767_345) as number,
      last_decision_at: (engine?.last_decision_at ?? null)            as string | null,
      regime:           (pub?.regime ?? 'UNKNOWN')                    as string,
      champions:        ((pub?.top_models ?? []).slice(0, 6))         as Champion[],
      history:          ((pub?.history ?? []).filter((t: HistoryTrade) => t.equity_after != null)) as HistoryTrade[],
    }
  } catch {
    return {
      metrics: null, fire: null, coverage: null,
      backtests: 16_767_345, last_decision_at: null,
      regime: 'UNKNOWN', champions: [], history: [],
    }
  }
}

// ─── Equity curve SVG (server-rendered) ───────────────────────────────────────
function EquityCurveSVG({ history, initial }: { history: HistoryTrade[]; initial: number }) {
  type Point = { eq: number; status: string }
  const points: Point[] = [
    { eq: initial, status: 'start' },
    ...history
      .filter(t => t.equity_after != null)
      .map(t => ({ eq: t.equity_after!, status: t.status })),
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }} aria-hidden>
      <defs>
        <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#d4af37" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="0"    />
        </linearGradient>
        <linearGradient id="eq-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#d4af37" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="1"    />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={fillPts} fill="url(#eq-fill)" />

      {/* Line */}
      <path d={linePts} fill="none" stroke="url(#eq-line)" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Trade markers */}
      {points.slice(1).map((p, i) => {
        const x     = mapX(i + 1)
        const y     = mapY(p.eq)
        const isWin = p.status === 'TP_HIT' || p.status === 'TRAIL_HIT'
        const color = isWin ? '#34d399' : '#f87171'
        return (
          <g key={i}>
            <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="5"
              fill={color} fillOpacity="0.15" stroke={color} strokeOpacity="0.4" strokeWidth="1" />
            <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5"
              fill={color} fillOpacity="0.9" />
          </g>
        )
      })}

      {/* Last point highlight */}
      <circle
        cx={mapX(points.length - 1).toFixed(1)}
        cy={mapY(points[points.length - 1].eq).toFixed(1)}
        r="4" fill="#d4af37"
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
  const regimeColor = REGIME_COLOR[regime] ?? REGIME_COLOR.UNKNOWN

  return (
    <main className="bg-bg min-h-screen">

      {/* ══ 1. HERO — 2 columnas ═════════════════════════════════════════════ */}
      <section className="pt-40 pb-24 px-6 bg-grid-pattern bg-grid relative overflow-hidden border-b border-gold/8">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-[1fr_420px] gap-16 items-center">

            {/* Left — headline */}
            <div>
              <div className="section-label text-gold mb-6">{'// SQUANT DESK · LATAM'}</div>
              <h1 className="display-heading text-[clamp(4.5rem,11vw,9rem)] text-text leading-[0.9] mb-8">
                SQUANT<br /><span className="gold-text">DESK</span>
              </h1>
              <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-lg mb-10">
                Infraestructura cuantitativa institucional para inversores independientes en LATAM.
                Modelos validados, datos reales, sin conflictos de interés.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/registro" className="bg-gold text-bg section-label px-8 py-3.5 hover:bg-gold-glow transition-colors duration-200 text-center">
                  CREAR CUENTA GRATIS
                </Link>
                <Link href="/login" className="border border-border text-text-dim section-label px-8 py-3.5 hover:border-gold hover:text-gold transition-colors duration-200 text-center">
                  INICIAR SESIÓN
                </Link>
              </div>
            </div>

            {/* Right — live engine panel (client, polls every 30s) */}
            <div>
              <EngineHeroPanel />
            </div>
          </div>
        </div>
      </section>

      {/* ══ 2. ENGINE STATUS STRIP ═══════════════════════════════════════════ */}
      <section className="border-b border-gold/10 bg-surface/40">
        <div className="max-w-7xl mx-auto px-6 py-3.5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="terminal-text text-[9px] text-emerald-400 tracking-[0.25em]">MOTOR ACTIVO</span>
            </div>
            {[
              { label: 'RÉGIMEN', value: regime, color: regimeColor },
              { label: 'EQUITY',  value: fire ? `$${fire.current_equity.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: '#d4af37' },
              { label: 'RETORNO', value: `+${returnPct}%`, color: '#34d399' },
              { label: 'WIN RATE', value: metrics?.wr ? `${metrics.wr.toFixed(0)}%` : '68%', color: undefined },
              { label: 'MODELOS', value: `${coverage?.active ?? 18} activos`, color: undefined },
              { label: 'BACKTESTS', value: `${(backtests / 1_000_000).toFixed(1)}M`, color: undefined },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:block w-px h-3 bg-border" />
                <span className="terminal-text text-[9px] text-muted">{label}:</span>
                <span className="terminal-text text-[9px] font-bold" style={color ? { color } : { color: '#e8e9f0' }}>
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
          <div className="mb-16">
            <div className="section-label text-gold mb-4">{'// HERRAMIENTAS · 6 MÓDULOS'}</div>
            <h2 className="display-heading text-5xl sm:text-7xl text-text">
              TODO LO QUE<br /><span className="gold-text">NECESITAS</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {tools.map((t) => (
              <div key={t.tag} className="bg-surface p-6 flex flex-col gap-4 group hover:bg-surface/80 transition-colors">
                <span className="terminal-text text-xs text-gold border border-gold/20 px-2 py-0.5 self-start">
                  {t.tag}
                </span>
                <h3 className="display-heading text-2xl text-text group-hover:text-gold transition-colors">
                  {t.name}
                </h3>
                <p className="terminal-text text-sm text-text-dim leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-end">
            <Link href="/recursos" className="section-label text-sm text-gold border border-gold/30 px-6 py-2.5 hover:bg-gold hover:text-bg transition-all duration-200">
              VER TODOS LOS RECURSOS →
            </Link>
          </div>
        </div>
      </section>

      {/* ══ 4. EQUITY CURVE REAL ═════════════════════════════════════════════ */}
      <section className="py-20 px-6 bg-surface border-y border-border">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <div>
              <div className="section-label text-gold mb-4">{'// PAPER TRADING EN PRODUCCIÓN'}</div>
              <h2 className="display-heading text-4xl sm:text-6xl text-text">
                SIGMA ENGINE<br />
                <span className="gold-text">
                  DESDE {fire?.baseline_date ? new Date(fire.baseline_date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : '12 MAY 2026'}
                </span>
              </h2>
            </div>
            <div className="text-right shrink-0">
              <div className="num text-5xl sm:text-6xl font-bold text-emerald-400 tabular-nums leading-none">
                +{returnPct}%
              </div>
              <div className="terminal-text text-xs text-muted mt-2 tracking-[0.15em]">RETORNO PAPER</div>
            </div>
          </div>

          {/* SVG panel */}
          <div className="relative border border-gold/15 bg-bg overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
            <div className="px-6 pt-6 pb-2">
              <EquityCurveSVG history={history} initial={fire?.starting_equity ?? 10_000} />
            </div>
            {/* Legend */}
            <div className="px-6 py-3 border-t border-gold/8 flex flex-wrap items-center gap-x-6 gap-y-1">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border mt-px">
            {[
              { v: `${metrics?.wr        ? metrics.wr.toFixed(0)        : '68'}%`,  l: 'Win Rate'       },
              { v: `${metrics?.pf        ? metrics.pf.toFixed(1)        : '1.7'}x`, l: 'Profit Factor'  },
              { v: `${metrics?.calmar    ? metrics.calmar.toFixed(1)    : '1.6'}x`, l: 'Calmar Ratio'   },
              { v: `${metrics?.n_trades  ? metrics.n_trades             : history.length + 1}`,           l: 'Trades registrados' },
            ].map(({ v, l }) => (
              <div key={l} className="bg-surface px-6 py-6 text-center">
                <div className="num text-3xl font-bold text-gold mb-1 tabular-nums">{v}</div>
                <div className="terminal-text text-[9px] text-muted tracking-[0.15em] uppercase">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 5. TOP CHAMPIONS — cards ═════════════════════════════════════════ */}
      {champions.length > 0 && (
        <section className="py-20 px-6 bg-bg">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <div>
                <div className="section-label text-gold mb-4">{'// MOTOR · TOP CHAMPIONS'}</div>
                <h2 className="display-heading text-4xl sm:text-6xl text-text">
                  MODELOS EN<br /><span className="gold-text">PRODUCCIÓN</span>
                </h2>
              </div>
              <Link href="/modelos" className="section-label text-xs text-gold border border-gold/30 px-5 py-2.5 hover:bg-gold hover:text-bg transition-all self-start md:self-auto">
                VER TODOS →
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
              {champions.map((c, i) => (
                <div key={i} className="bg-surface p-6 relative overflow-hidden flex flex-col gap-4">
                  {/* Top row: grade + TF */}
                  <div className="flex items-center justify-between">
                    <span
                      className="terminal-text text-xs px-2.5 py-1 border font-bold"
                      style={{
                        color:       gradeColor(c.grade),
                        borderColor: gradeColor(c.grade) + '50',
                        background:  gradeColor(c.grade) + '12',
                      }}
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
                          background: c.direction === 'short' ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)',
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

                  {/* CAGR — big number */}
                  <div>
                    <div className="num text-4xl font-bold tabular-nums leading-none" style={{ color: gradeColor(c.grade) }}>
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
                          background: `linear-gradient(90deg, ${gradeColor(c.grade)}50, ${gradeColor(c.grade)})`,
                        }}
                      />
                    </div>
                    <span className="terminal-text text-[10px] text-text tabular-nums shrink-0">
                      {c.wr?.toFixed(1)}% WR
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ 6. PLANES ════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-surface border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="section-label text-gold mb-4">{'// PLANES DE ACCESO'}</div>
            <h2 className="display-heading text-5xl sm:text-7xl text-text">
              ELIGE TU<br /><span className="gold-text">PLAN</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-border">
            {plans.map((p) => (
              <div
                key={p.name}
                className="bg-surface p-8 flex flex-col gap-6 relative"
                style={{ outline: p.recommended ? `2px solid ${p.color}` : undefined }}
              >
                {p.recommended && (
                  <div
                    className="absolute -top-3 left-6 section-label text-xs px-3 py-0.5"
                    style={{ background: p.color, color: '#04050a' }}
                  >
                    ★ RECOMENDADO
                  </div>
                )}
                <div>
                  <div className="section-label mb-1" style={{ color: p.color }}>{p.name}</div>
                  <div className="display-heading text-5xl" style={{ color: p.color }}>{p.price}</div>
                  <div className="terminal-text text-xs text-text-dim mt-1">{p.period}</div>
                </div>
                <ul className="flex flex-col gap-2 flex-1">
                  {p.items.map((item) => (
                    <li key={item} className="terminal-text text-sm text-text-dim flex items-start gap-2">
                      <span style={{ color: p.color }}>→</span>{item}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className="section-label text-sm text-center py-3 transition-colors duration-200"
                  style={{
                    background:  p.recommended ? p.color : 'transparent',
                    color:       p.recommended ? '#04050a' : p.color,
                    border:      `1px solid ${p.color}`,
                  }}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 7. CTA FINAL + LEGAL ═════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-bg border-t border-border">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-8 mb-20">
          <div className="section-label text-gold">{'// EMPIEZA HOY'}</div>
          <h2 className="display-heading text-5xl sm:text-7xl text-text">
            OPERA CON<br /><span className="gold-text">VENTAJA</span><br />REAL
          </h2>
          <p className="terminal-text text-text-dim leading-relaxed">
            Crea tu cuenta gratuita en segundos. Sin tarjeta de crédito.<br />
            Acceso inmediato al terminal y la calculadora FIRE.
          </p>
          <Link href="/registro" className="bg-gold text-bg section-label px-12 py-4 hover:bg-gold-glow transition-colors duration-200">
            CREAR CUENTA GRATIS
          </Link>
          <div className="terminal-text text-xs text-text-dim">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-gold hover:underline">Iniciar sesión →</Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-border pt-10">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {legalLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="terminal-text text-xs text-text-dim hover:text-gold transition-colors tracking-widest uppercase"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="terminal-text text-xs text-text-dim text-center mt-6 tracking-widest">
            © {new Date().getFullYear()} SQUANT DESK · TODOS LOS DERECHOS RESERVADOS
          </div>
        </div>
      </section>

    </main>
  )
}
