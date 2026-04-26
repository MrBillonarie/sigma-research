import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Sigma Research — Infraestructura Cuantitativa LATAM',
  description:
    'Infraestructura cuantitativa institucional para inversores independientes en LATAM. Terminal en vivo, modelos ML, simulador FIRE y más.',
}

const tools = [
  { tag: 'T-01', name: 'SIGMA TERMINAL',   desc: 'Dashboard de trading en vivo. Portafolio multi-broker, balances Binance Spot & Futures, P&L consolidado y posiciones abiertas en tiempo real.' },
  { tag: 'T-02', name: 'MODELOS ML',        desc: 'Señales cuantitativas de régimen de mercado, volatilidad, momentum y análisis macro. Validadas con walk-forward out-of-sample.' },
  { tag: 'T-03', name: 'MONTE CARLO',       desc: '10.000 simulaciones de portafolio con ajuste por inflación CLP/USD, retiro dinámico y percentiles de probabilidad de ruina.' },
  { tag: 'T-04', name: 'REPORTE MENSUAL',   desc: 'Análisis de rendimiento, Sharpe, Sortino, max drawdown y comparación contra benchmarks. Exportable en PDF incluido en plan PRO.' },
  { tag: 'T-05', name: 'SIMULADOR FIRE',    desc: 'Proyección de independencia financiera con horizonte personalizable. Calcula tu número FIRE y el tiempo estimado para alcanzarlo.' },
  { tag: 'T-06', name: 'SEÑALES LP',        desc: 'Motor cuantitativo automático para PancakeSwap v3. Rangos óptimos, Kelly sizing, Monte Carlo de impermanent loss y APR estimado.' },
]

const metrics = [
  { value: '85.2%', label: 'Win Rate verificado' },
  { value: '4.16x', label: 'Profit Factor' },
  { value: '10.25', label: 'Sharpe Ratio' },
  { value: '122',   label: 'Trades Feb–Abr 2026' },
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

  return (
    <main className="bg-bg min-h-screen">

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-28 px-6 bg-grid-pattern bg-grid relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="section-label text-gold mb-6">{'// SIGMA RESEARCH · LATAM'}</div>
          <h1 className="display-heading text-6xl sm:text-8xl lg:text-[9rem] text-text leading-none mb-8">
            SIGMA
            <br />
            <span className="gold-text">RESEARCH</span>
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
            {'// TRACK RECORD VERIFICADO · FEB–ABR 2026'}
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

      {/* ── 4. PLANES/PRICING ───────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-bg">
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

      {/* ── 5. CTA FINAL + LINKS LEGALES ────────────────────────────────────── */}
      <section className="py-24 px-6 bg-surface border-t border-border">
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
            © {new Date().getFullYear()} SIGMA RESEARCH · TODOS LOS DERECHOS RESERVADOS
          </div>
        </div>
      </section>

    </main>
  )
}
