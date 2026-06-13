import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Champion {
  sym: string
  tf: string
  strategy: string
  grade: string
  wr: number
  cagr: number
  direction?: string
}

function gradeColor(grade: string) {
  if (grade === 'A+') return '#d4af37'
  if (grade === 'A')  return '#4a9eff'
  if (grade === 'B')  return '#8b8fa8'
  return '#ff6b6b'
}

// ─── Métricas reales del VPS (con fallback) ───────────────────────────────────
const METRICS_FALLBACK = [
  { value: '68%',    label: 'Win Rate validado' },
  { value: '78%',    label: 'CAGR champions' },
  { value: '1.7x',   label: 'Profit Factor' },
  { value: '1.460+', label: 'Trades backtested' },
]

async function getEngineMetrics() {
  const VPS = process.env.VPS_URL ?? 'http://178.104.10.97:8080'
  try {
    const res = await fetch(`${VPS}/api/v2/engine_status`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return METRICS_FALLBACK
    const d = await res.json()
    const p = d?.portfolio
    if (!p) return METRICS_FALLBACK
    const wr   = p.wr   !== undefined ? (p.wr <= 1 ? p.wr * 100 : p.wr) : null
    const cagr = p.cagr_weighted ?? p.cagr_pass_live ?? p.cagr ?? null
    const pf   = p.pf   !== undefined ? p.pf   : null
    const n    = p.n_trades ?? p.trades_total ?? null
    return [
      { value: wr   !== null ? `${wr.toFixed(0)}%`   : METRICS_FALLBACK[0].value, label: 'Win Rate validado'  },
      { value: cagr !== null ? `${cagr.toFixed(0)}%` : METRICS_FALLBACK[1].value, label: 'CAGR champions'     },
      { value: pf   !== null ? `${pf.toFixed(1)}x`   : METRICS_FALLBACK[2].value, label: 'Profit Factor'      },
      { value: n    !== null ? `${Number(n).toLocaleString('es-CL')}+` : METRICS_FALLBACK[3].value, label: 'Trades backtested' },
    ]
  } catch {
    return METRICS_FALLBACK
  }
}

async function getTopChampions(): Promise<Champion[]> {
  const VPS = process.env.VPS_URL ?? 'http://178.104.10.97:8080'
  try {
    const res = await fetch(`${VPS}/api/public`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const d = await res.json()
    return (d?.top_models ?? []).slice(0, 6) as Champion[]
  } catch {
    return []
  }
}

export const metadata: Metadata = {
  title: 'SQuant Desk — Infraestructura Cuantitativa LATAM',
  description:
    'Infraestructura cuantitativa institucional para inversores independientes en LATAM. Terminal en vivo, modelos ML, simulador FIRE y más.',
}

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
    name: 'TERMINAL',
    price: '$0',
    period: 'siempre gratis',
    color: '#8b8fa8',
    recommended: false,
    cta: 'EMPEZAR GRATIS',
    href: '/registro',
    items: ['Dashboard de portfolio', 'Journal de trades', 'Calculadora FIRE básica', 'Calendario macro'],
  },
  {
    name: 'PRO',
    price: '$29',
    period: '/mes USD',
    color: '#d4af37',
    recommended: true,
    cta: 'ACTIVAR PRO',
    href: '/registro',
    items: ['Todo lo anterior', 'Modelos ML + señales', 'Monte Carlo avanzado', 'LP DeFi cuantitativo', 'Reporte mensual PDF', 'Soporte prioritario'],
  },
  {
    name: 'INSTITUTIONAL',
    price: 'Custom',
    period: 'cotizar',
    color: '#4a9eff',
    recommended: false,
    cta: 'CONTACTAR',
    href: '/contacto',
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

export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/home')
  }

  const [metrics, champions] = await Promise.all([
    getEngineMetrics(),
    getTopChampions(),
  ])

  return (
    <main className="bg-bg min-h-screen">

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-28 px-6 bg-grid-pattern bg-grid relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="section-label text-gold mb-6">{'// SQUANT DESK · LATAM'}</div>
          <h1 className="display-heading text-6xl sm:text-8xl lg:text-[9rem] text-text leading-none mb-8">
            SQUANT
            <br />
            <span className="gold-text">DESK</span>
          </h1>
          <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-2xl mb-10">
            Infraestructura cuantitativa institucional para inversores independientes en LATAM.
            Modelos validados, datos reales, sin conflictos de interés.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/registro" className="bg-gold text-bg section-label px-8 py-3 hover:bg-gold-glow transition-colors duration-200 text-center">
              CREAR CUENTA GRATIS
            </Link>
            <Link href="/login" className="border border-border text-text-dim section-label px-8 py-3 hover:border-gold hover:text-gold transition-colors duration-200 text-center">
              INICIAR SESIÓN
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. HERRAMIENTAS ─────────────────────────────────────────────────── */}
      <section id="modelos" className="py-24 px-6 bg-bg">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="section-label text-gold mb-4">{'// HERRAMIENTAS'}</div>
            <h2 className="display-heading text-5xl sm:text-7xl text-text">
              TODO LO QUE
              <br />
              <span className="gold-text">NECESITAS</span>
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

      {/* ── 3. MÉTRICAS REALES ──────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-surface border-y border-border">
        <div className="max-w-7xl mx-auto">
          <div className="section-label text-gold mb-10 text-center">
            {'// SIGMA ENGINE · CHAMPIONS EN PRODUCCIÓN · BTC/ETH/SOL/BNB/LTC/XAU'}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {metrics.map((m) => (
              <div key={m.label} className="bg-bg p-10 text-center">
                <div className="display-heading text-5xl sm:text-6xl gold-text mb-2">{m.value}</div>
                <div className="terminal-text text-xs text-text-dim tracking-widest uppercase">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. TOP CHAMPIONS (live del motor) ───────────────────────────────── */}
      {champions.length > 0 && (
        <section className="py-20 px-6 bg-bg">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <div>
                <div className="section-label text-gold mb-4">{'// MOTOR · TOP CHAMPIONS'}</div>
                <h2 className="display-heading text-4xl sm:text-6xl text-text">
                  MODELOS EN
                  <br />
                  <span className="gold-text">PRODUCCIÓN</span>
                </h2>
              </div>
              <Link href="/modelos" className="section-label text-xs text-gold border border-gold/30 px-5 py-2.5 hover:bg-gold hover:text-bg transition-all self-start md:self-auto">
                VER TODOS →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full terminal-text text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 text-left text-text-dim tracking-widest text-xs font-normal">GRADE</th>
                    <th className="pb-3 text-left text-text-dim tracking-widest text-xs font-normal">ACTIVO</th>
                    <th className="pb-3 text-left text-text-dim tracking-widest text-xs font-normal">TF</th>
                    <th className="pb-3 text-left text-text-dim tracking-widest text-xs font-normal hidden md:table-cell">ESTRATEGIA</th>
                    <th className="pb-3 text-right text-text-dim tracking-widest text-xs font-normal">WIN RATE</th>
                    <th className="pb-3 text-right text-text-dim tracking-widest text-xs font-normal">CAGR</th>
                  </tr>
                </thead>
                <tbody>
                  {champions.map((c, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-surface/50 transition-colors">
                      <td className="py-3.5 pr-4">
                        <span
                          className="terminal-text text-xs px-2 py-0.5 border"
                          style={{ color: gradeColor(c.grade), borderColor: gradeColor(c.grade) + '40' }}
                        >
                          {c.grade}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-text">{c.sym}</td>
                      <td className="py-3.5 pr-4 text-text-dim">{c.tf}</td>
                      <td className="py-3.5 pr-4 text-text-dim text-xs hidden md:table-cell">
                        {c.strategy?.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3.5 text-right text-text">{c.wr?.toFixed(1)}%</td>
                      <td className="py-3.5 text-right gold-text font-bold">{c.cagr?.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── 5. PLANES/PRICING ───────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-surface border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="section-label text-gold mb-4">{'// PLANES'}</div>
            <h2 className="display-heading text-5xl sm:text-7xl text-text">
              ELIGE TU
              <br />
              <span className="gold-text">PLAN</span>
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
                    background: p.recommended ? p.color : 'transparent',
                    color: p.recommended ? '#04050a' : p.color,
                    border: `1px solid ${p.color}`,
                  }}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. CTA FINAL + LINKS LEGALES ────────────────────────────────────── */}
      <section className="py-24 px-6 bg-bg border-t border-border">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-8 mb-20">
          <div className="section-label text-gold">{'// EMPIEZA HOY'}</div>
          <h2 className="display-heading text-5xl sm:text-7xl text-text">
            OPERA CON
            <br />
            <span className="gold-text">VENTAJA</span>
            <br />
            REAL
          </h2>
          <p className="terminal-text text-text-dim leading-relaxed">
            Crea tu cuenta gratuita en segundos. Sin tarjeta de crédito.
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

        {/* Legal links */}
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
