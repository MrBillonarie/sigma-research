import type { Metadata } from 'next'
import Link from 'next/link'
import FadeIn from '@/app/components/landing/FadeIn'
import SigmaDivider from '@/app/components/landing/SigmaDivider'

export const metadata: Metadata = {
  title: 'Roadmap — SQuant Desk',
  description:
    'La hoja de ruta de SQuant Desk: lo que ya construimos, en qué estamos trabajando y hacia dónde va la arquitectura multi-motor.',
}

type Status = 'done' | 'progress' | 'next'

const STATUS_LABEL: Record<Status, string> = {
  done: 'COMPLETADO',
  progress: 'EN CURSO',
  next: 'PLANEADO',
}

const STATUS_COLOR: Record<Status, string> = {
  done: 'text-gold border-gold/40 bg-gold/5',
  progress: 'text-text border-border bg-surface',
  next: 'text-text-dim border-border bg-transparent',
}


type MilestoneTrack = {
  tag: string
  title: string
  desc: string
  current: number
  unit: string
  format: (n: number) => string
  targets: number[]
  link?: { href: string; label: string }
}

const TRACKS: MilestoneTrack[] = [
  {
    tag: 'M-01',
    title: 'Cómputo del motor',
    desc: 'Núcleos de CPU dedicados al pipeline de Optuna. Más núcleos = más estrategias evaluadas en paralelo = ciclos de validación más rápidos.',
    current: 8,
    unit: 'núcleos',
    format: (n) => `${n}`,
    targets: [16, 40, 50, 100],
  },
  {
    tag: 'M-02',
    title: 'Capital del motor en Binance',
    desc: 'Capital propio operando en vivo (no incluye capital de seguidores de copy trading). Crece solo con profit reinvertido — sin nuevos aportes externos.',
    current: 521.51,
    unit: 'USD',
    format: (n) => `$${n.toLocaleString('es-CL')}`,
    targets: [1000, 2000, 5000, 10000],
  },
  {
    tag: 'M-03',
    title: 'Copy traders activos',
    desc: 'Personas siguiendo la cuenta de Lead Trader en Binance Copy Trading con capital real.',
    current: 8,
    unit: 'traders',
    format: (n) => `${n}`,
    targets: [10, 20, 50, 100],
    link: { href: 'https://www.binance.com/es-LA/copy-trading/lead-details/5096369356136167936', label: 'Ver perfil público en Binance' },
  },
]

function MilestoneCard({ t }: { t: MilestoneTrack }) {
  const nextIdx = t.targets.findIndex((target) => t.current < target)
  const next = nextIdx === -1 ? null : t.targets[nextIdx]
  const prev = nextIdx <= 0 ? 0 : t.targets[nextIdx - 1]
  const pct = next ? Math.min(100, Math.max(0, ((t.current - prev) / (next - prev)) * 100) ) : 100

  return (
    <div className="bg-surface border border-border p-8 flex flex-col gap-6 h-full">
      <div>
        <span className="terminal-text text-xs text-gold tracking-widest">{t.tag}</span>
        <h3 className="text-text text-lg font-semibold mt-2 mb-2">{t.title}</h3>
        <p className="terminal-text text-text-dim text-xs leading-relaxed">{t.desc}</p>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="num text-gold font-bold text-3xl tabular-nums">{t.format(t.current)}</span>
        <span className="terminal-text text-text-dim text-xs">{t.unit} hoy</span>
      </div>

      {next !== null && (
        <div>
          <div className="bg-bg border border-border rounded-full h-1.5 overflow-hidden mb-2">
            <div className="bg-gold h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="terminal-text text-[10px] text-text-dim">
            {pct.toFixed(0)}% hacia {t.format(next)}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-auto">
        {t.targets.map((target) => {
          const reached = t.current >= target
          return (
            <span
              key={target}
              className={`terminal-text text-[10px] tracking-wider px-2.5 py-1 border ${
                reached ? 'border-gold/40 bg-gold/10 text-gold' : 'border-border text-text-dim'
              }`}
            >
              {reached ? '✓ ' : ''}{t.format(target)}
            </span>
          )
        })}
      </div>

      {t.link && (
        <a
          href={t.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="terminal-text text-[10px] text-gold hover:text-gold-glow tracking-wide underline underline-offset-2"
        >
          {t.link.label} ↗
        </a>
      )}
    </div>
  )
}

const TIMELINE: { date: string; title: string; desc: string; status: Status }[] = [
  {
    date: 'MAYO 2026',
    title: 'Nace el SIGMA ENGINE',
    desc: 'Pipeline de backtesting con Optuna Bayesian Search sobre BTC, ETH, SOL, BNB y LTC. Walk-forward out-of-sample testing y robustness gates anti-overfitting desde el día uno.',
    status: 'done',
  },
  {
    date: 'MAYO 2026',
    title: 'Paper trading en vivo',
    desc: 'Los primeros modelos empiezan a operar en simulación con datos de mercado reales — entradas, stop-loss y take-profit ejecutados como si fueran capital real, sin riesgo.',
    status: 'done',
  },
  {
    date: 'MAYO–JUNIO 2026',
    title: 'Expansión de la librería de estrategias',
    desc: 'De un puñado de modelos iniciales a una librería balanceada de decenas de estrategias long y short, con sizing dinámico (Kelly adaptativo) y filtros de régimen de mercado.',
    status: 'done',
  },
  {
    date: 'JUNIO 13, 2026',
    title: 'Rebrand a SQuant Desk',
    desc: 'La plataforma pública toma forma: landing, FAQ, journal de trades, calculadora FIRE y el HUD de señales en vivo, todo construido sobre la misma infraestructura del motor.',
    status: 'done',
  },
  {
    date: 'JUNIO 17, 2026',
    title: 'Activación de capital real',
    desc: 'Tras cumplir un gate de validación de 5 criterios (volumen de trades, win rate, profit factor, diversidad de régimen y duración mínima), el motor empieza a operar con capital real en Binance Futures.',
    status: 'done',
  },
  {
    date: 'JUNIO 2026',
    title: 'Motor 2: Commodities en vivo',
    desc: 'XAU, XAG, WTI, NG, HG y PL se suman al universo operable. Los primeros modelos de commodities pasan el mismo gate de validación y comienzan a operar con capital real junto al motor de cripto.',
    status: 'done',
  },
  {
    date: 'AHORA',
    title: 'Arquitectura multi-motor',
    desc: 'Dos motores activos (Cripto + Commodities) corriendo 24/7 bajo un mismo meta-allocator de riesgo, con circuit breakers automáticos y trazabilidad completa de cada decisión.',
    status: 'progress',
  },
  {
    date: 'AHORA',
    title: 'Copy trading',
    desc: 'Apertura gradual a capital de seguidores junto al capital propio, con la misma disciplina de riesgo y el mismo motor de decisión para todos.',
    status: 'progress',
  },
  {
    date: 'PRÓXIMO',
    title: 'Motor 3 — Acciones US',
    desc: 'Extender la misma metodología de validación (walk-forward, robustness gates, Kelly sizing) al mercado de acciones estadounidense.',
    status: 'next',
  },
  {
    date: 'PRÓXIMO',
    title: 'Motor 4 — Mercados LATAM',
    desc: 'Cobertura de activos latinoamericanos, pensado para usuarios que ya operan en mercados locales y quieren la misma rigurosidad cuantitativa.',
    status: 'next',
  },
  {
    date: 'PRÓXIMO',
    title: 'Motor 5 — Forex',
    desc: 'El quinto motor de la arquitectura planeada, completando la cobertura cripto + commodities + acciones + LATAM + forex bajo un solo dashboard.',
    status: 'next',
  },
  {
    date: 'PRÓXIMO',
    title: 'API institucional',
    desc: 'Acceso programático a señales y métricas para quienes quieran integrar SQuant Desk en su propio stack de trading.',
    status: 'next',
  },
]

export default function RoadmapPage() {
  return (
    <main className="bg-bg min-h-screen">

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-24 px-6 bg-grid-pattern bg-grid relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <FadeIn>
            <div className="section-label text-gold mb-6">{'// HOJA DE RUTA'}</div>
            <h1 className="display-heading text-[clamp(3.5rem,10vw,8rem)] text-text leading-[0.92] mb-8">
              CONSTRUIDO EN<br />
              <span className="gold-text">PÚBLICO.</span>
            </h1>
            <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-2xl">
              No prometemos nada que no podamos mostrar. Esta es la línea de tiempo real
              del SIGMA ENGINE: lo que ya está construido y operando con capital real,
              lo que está en curso, y hacia dónde va la arquitectura.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── METAS ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="section-label text-gold mb-6">{'// METAS DEL MOTOR'}</div>
            <h2 className="display-heading text-[clamp(2.5rem,6vw,5rem)] text-text leading-[0.95] mb-4 max-w-3xl">
              NÚMEROS, NO<br />
              <span className="gold-text">PROMESAS.</span>
            </h2>
            <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-2xl mb-12">
              Tres escalones que medimos en público. Se actualizan a medida que el motor crece —
              sin maquillaje.
            </p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {TRACKS.map((t) => (
              <FadeIn key={t.tag}>
                <MilestoneCard t={t} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* · σ · */}
      <div className="px-6 bg-bg">
        <div className="max-w-7xl mx-auto">
          <SigmaDivider />
        </div>
      </div>

      {/* ── TIMELINE ────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col">
            {TIMELINE.map((item, i) => (
              <FadeIn key={i} delay={Math.min(i * 60, 360)}>
                <div className="flex gap-6 pb-10 relative">
                  {/* rail */}
                  <div className="flex flex-col items-center w-6 shrink-0">
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                        item.status === 'done' ? 'bg-gold' : item.status === 'progress' ? 'bg-text' : 'bg-border'
                      }`}
                    />
                    {i < TIMELINE.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>

                  {/* content */}
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="terminal-text text-[10px] tracking-widest text-text-dim">{item.date}</span>
                      <span
                        className={`terminal-text text-[9px] tracking-widest px-2 py-0.5 border ${STATUS_COLOR[item.status]}`}
                      >
                        {STATUS_LABEL[item.status]}
                      </span>
                    </div>
                    <h3 className="text-text text-lg font-semibold mb-2">{item.title}</h3>
                    <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-xl">{item.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* · σ · */}
      <div className="px-6 bg-bg">
        <div className="max-w-7xl mx-auto">
          <SigmaDivider />
        </div>
      </div>

      {/* ── PRINCIPIOS QUE NO CAMBIAN ───────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="section-label text-gold mb-6">{'// LO QUE NO VA A CAMBIAR'}</div>
            <h2 className="display-heading text-[clamp(2.5rem,6vw,5rem)] text-text leading-[0.95] mb-12 max-w-3xl">
              MÁS MOTORES,<br />
              <span className="gold-text">MISMO RIGOR.</span>
            </h2>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-px bg-border">
            {[
              {
                tag: 'P-01',
                title: 'Sin overfitting conveniente',
                desc: 'Cada motor nuevo pasa por el mismo pipeline: walk-forward OOS, robustness gates multi-seed y validación antes de tocar capital real — sin excepciones por apuro.',
              },
              {
                tag: 'P-02',
                title: 'Capital real solo si pasa el gate',
                desc: 'Ningún modelo, en ningún motor, opera con dinero real sin cumplir el mismo umbral de trades, win rate, profit factor y duración de validación.',
              },
              {
                tag: 'P-03',
                title: 'Transparencia ante todo',
                desc: 'Lo que no funciona se documenta igual que lo que funciona. Esta página se actualiza con la realidad del motor, no con la versión optimista de la realidad.',
              },
            ].map((p) => (
              <FadeIn key={p.tag}>
                <div className="bg-bg p-8 h-full flex flex-col gap-3">
                  <span className="terminal-text text-xs text-gold tracking-widest">{p.tag}</span>
                  <h3 className="text-text text-lg font-semibold">{p.title}</h3>
                  <p className="terminal-text text-text-dim text-sm leading-relaxed">{p.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
          <div className="section-label text-gold">{'// SIGUE EL PROGRESO'}</div>
          <p className="terminal-text text-text-dim">
            El motor corre 24/7 y el dashboard se actualiza en tiempo real. Únete a la
            comunidad para ver cada hito a medida que pasa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/registro" className="bg-gold text-bg section-label px-8 py-3 hover:bg-gold-glow transition-colors duration-200">
              CREAR CUENTA
            </Link>
            <Link href="/quienes-somos" className="border border-border text-text-dim section-label px-8 py-3 hover:border-gold hover:text-gold transition-colors duration-200">
              QUIÉNES SOMOS
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}
