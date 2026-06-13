import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Quiénes Somos — SQuant Desk',
  description:
    'Conoce la historia y la misión de SQuant Desk: infraestructura cuantitativa para inversores independientes en LATAM.',
}

const valores = [
  {
    tag: 'V-01',
    name: 'RIGOR CUANTITATIVO',
    description:
      'Cada modelo pasa por walk-forward out-of-sample testing, validación de robustez multi-seed y backtests en periodo reciente separado. Sin overfitting conveniente.',
  },
  {
    tag: 'V-02',
    name: 'TRANSPARENCIA TOTAL',
    description:
      'Publicamos métricas reales: CAGR, Win Rate, Max Drawdown, Sharpe. Si un modelo falla en producción lo documentamos y lo comunicamos. Sin cherry-picking.',
  },
  {
    tag: 'V-03',
    name: 'DATOS REALES',
    description:
      'Trabajamos con datos reales de Binance Futures, Yahoo Finance y CME. Los backtests usan precios históricos reales con comisiones y slippage incluidos.',
  },
  {
    tag: 'V-04',
    name: 'INDEPENDENCIA',
    description:
      'Sin conflictos de interés. No gestionamos capital de terceros. Nuestra única fuente de ingresos es la suscripción. Lo que recomendamos, también lo operamos.',
  },
]

const tecnologias = [
  { label: 'Motor',       value: 'Python · Optuna · Backtest Engine propio' },
  { label: 'Optimización', value: 'Bayesian Search · Walk-Forward · Monte Carlo' },
  { label: 'Datos',       value: 'Binance Futures · Yahoo Finance · CME' },
  { label: 'Activos',     value: 'BTC / ETH / SOL / BNB / LTC / XAU' },
  { label: 'Timeframes',  value: '5m · 15m · 1h · 4h · 1d' },
  { label: 'Estrategias', value: '70+ longs & shorts en producción' },
  { label: 'Infraestructura', value: 'VPS dedicado · Dashboard 24/7 · Telegram + Discord' },
  { label: 'Validación',  value: 'Robustness Gate · OOS Gate · Kelly-sizing live' },
]

export default function QuienesSomosPage() {
  return (
    <main className="bg-bg min-h-screen">

      {/* ── HERO ── */}
      <section className="pt-40 pb-24 px-6 bg-grid-pattern bg-grid relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="section-label text-gold mb-6">{'// SQUANT DESK'}</div>
          <h1 className="display-heading text-6xl sm:text-8xl lg:text-[9rem] text-text leading-none mb-8">
            QUIÉNES
            <br />
            <span className="gold-text">SOMOS</span>
          </h1>
          <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-xl">
            Construimos infraestructura cuantitativa de grado institucional para inversores
            independientes en LATAM — modelos reales, datos reales, sin conflictos de interés.
          </p>
        </div>
      </section>

      {/* ── MISIÓN ── */}
      <section className="py-24 px-6 bg-surface">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="section-label text-gold mb-4">{'// MISIÓN'}</div>
            <h2 className="display-heading text-5xl sm:text-7xl text-text mb-6">
              DEMOCRATIZAR
              <br />
              <span className="gold-text">EL EDGE</span>
              <br />
              CUANTITATIVO
            </h2>
          </div>
          <div className="flex flex-col gap-5">
            <p className="terminal-text text-text-dim leading-relaxed">
              Las herramientas que usan los hedge funds — optimización Bayesiana, walk-forward
              testing, Kelly sizing, régimen de mercado, Monte Carlo — han estado fuera del
              alcance de inversores independientes. SQuant Desk nació para cambiar eso.
            </p>
            <p className="terminal-text text-text-dim leading-relaxed">
              Construimos y mantenemos el <span className="text-gold">SIGMA ENGINE</span>:
              un motor de trading cuantitativo que corre 24/7 sobre Futuros Binance con
              70+ estrategias optimizadas, paper trading en vivo y señales validadas con
              datos reales de mercado.
            </p>
            <p className="terminal-text text-text-dim leading-relaxed">
              No vendemos señales mágicas. Proveemos el sistema completo: backtesting honesto,
              gestión de riesgo real, y el contexto estadístico para interpretar cada decisión.
            </p>
          </div>
        </div>
      </section>

      {/* ── FUNDADOR ── */}
      <section className="py-24 px-6 bg-bg">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="section-label text-gold mb-4">{'// FUNDADOR'}</div>
            <h2 className="display-heading text-5xl sm:text-7xl text-text">
              LA PERSONA
              <br />
              <span className="gold-text">DETRÁS</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-[auto_1fr] gap-px bg-border max-w-3xl">
            {/* Avatar */}
            <div className="bg-surface p-8 flex flex-col items-center justify-start gap-4 min-w-[180px]">
              <div className="w-20 h-20 rounded-full border border-gold/40 flex items-center justify-center bg-bg shadow-gold">
                <span className="display-heading text-3xl text-gold">AM</span>
              </div>
              <div className="text-center">
                <div className="display-heading text-xl text-text">Alonso Moyano</div>
                <div className="section-label text-gold text-xs mt-1">FUNDADOR & QUANT LEAD</div>
              </div>
              <div className="flex flex-col gap-1.5 mt-2">
                {['Crypto Quant', 'Systems Builder', 'LATAM Trader'].map(t => (
                  <span key={t} className="terminal-text text-xs text-gold border border-gold/20 px-2 py-0.5 text-center">{t}</span>
                ))}
              </div>
            </div>

            {/* Bio */}
            <div className="bg-bg p-8 flex flex-col gap-5 justify-center">
              <p className="terminal-text text-text-dim leading-relaxed">
                Trader cuantitativo independiente especializado en Futuros Binance (BTC/ETH/SOL/BNB/XAU).
                Construyó desde cero el SIGMA ENGINE: un sistema de backtesting, optimización
                Bayesiana con Optuna y paper trading en vivo que corre 24/7 en un VPS dedicado.
              </p>
              <p className="terminal-text text-text-dim leading-relaxed">
                El motor implementa 70+ estrategias con walk-forward out-of-sample testing,
                robustness gates, Kelly sizing adaptativo y un dashboard de monitoreo en tiempo real.
                Cada champion en producción pasó múltiples capas de validación antes de activarse.
              </p>
              <p className="terminal-text text-text-dim leading-relaxed">
                SQuant Desk nació de la convicción de que los mejores sistemas cuantitativos
                no deberían estar reservados para fondos con equipos de 40 personas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STACK TECNOLÓGICO ── */}
      <section className="py-24 px-6 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="section-label text-gold mb-4">{'// TECNOLOGÍA'}</div>
            <h2 className="display-heading text-5xl sm:text-7xl text-text">
              EL STACK
              <br />
              <span className="gold-text">DETRÁS</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {tecnologias.map((t) => (
              <div key={t.label} className="bg-bg p-6 flex flex-col gap-3">
                <div className="section-label text-gold text-xs">{t.label}</div>
                <p className="terminal-text text-sm text-text-dim leading-relaxed">{t.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALORES ── */}
      <section className="py-24 px-6 bg-bg">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="section-label text-gold mb-4">{'// VALORES'}</div>
            <h2 className="display-heading text-5xl sm:text-7xl text-text">
              LO QUE NOS
              <br />
              <span className="gold-text">DEFINE</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {valores.map((v) => (
              <div key={v.tag} className="bg-surface p-6 flex flex-col gap-4 group hover:bg-surface/80 transition-colors">
                <span className="terminal-text text-xs text-gold border border-gold/20 px-2 py-0.5 self-start">
                  {v.tag}
                </span>
                <h3 className="display-heading text-2xl text-text group-hover:text-gold transition-colors">
                  {v.name}
                </h3>
                <p className="terminal-text text-sm text-text-dim leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 bg-surface border-t border-border">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-8">
          <div className="section-label text-gold">{'// ÚNETE A LA PLATAFORMA'}</div>
          <h2 className="display-heading text-5xl sm:text-7xl text-text">
            OPERA CON
            <br />
            <span className="gold-text">SISTEMA</span>
            <br />
            REAL
          </h2>
          <p className="terminal-text text-text-dim leading-relaxed">
            Accede a los modelos, el paper trading y la infraestructura completa del SIGMA ENGINE.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/registro" className="bg-gold text-bg section-label px-8 py-3 hover:bg-gold-glow transition-colors duration-200">
              CREAR CUENTA GRATIS
            </Link>
            <Link href="/#modelos" className="border border-border text-text-dim section-label px-8 py-3 hover:border-gold hover:text-gold transition-colors duration-200">
              VER MODELOS
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}
