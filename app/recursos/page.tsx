import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recursos — Sigma Research',
  description: 'Herramientas cuantitativas institucionales para inversores independientes en LATAM.',
}

const tools = [
  {
    tag: 'T-01',
    name: 'SIGMA TERMINAL',
    desc: 'Dashboard de trading en vivo. Portafolio multi-broker, balances Binance Spot & Futures, P&L consolidado y posiciones abiertas en tiempo real.',
    detail: 'Conecta tus cuentas de Binance Spot y Futures vía API de solo lectura. Visualiza tu P&L consolidado, posiciones abiertas, historial de operaciones y distribución de capital en un solo panel.',
    href: '/login',
    cta: 'ACCEDER AL TERMINAL',
  },
  {
    tag: 'T-02',
    name: 'MODELOS ML',
    desc: 'Señales cuantitativas de régimen de mercado, volatilidad, momentum y análisis macro. Validadas con walk-forward out-of-sample.',
    detail: 'Incluye el Regime Detector (HMM), Vol Forecaster (GARCH), Momentum Score Top 20 S&P 500 y el Macro Regime basado en factores PCA. Todas las señales publicadas con métricas OOS completas.',
    href: '/login',
    cta: 'VER MODELOS',
  },
  {
    tag: 'T-03',
    name: 'MONTE CARLO',
    desc: '10.000 simulaciones de portafolio con ajuste por inflación CLP/USD, retiro dinámico y percentiles de probabilidad de ruina.',
    detail: 'Configura tu portafolio inicial, tasa de retorno esperada, volatilidad histórica y horizonte temporal. Obtén percentiles P10/P50/P90 y la probabilidad de alcanzar tu objetivo FIRE.',
    href: '/login',
    cta: 'SIMULAR PORTAFOLIO',
  },
  {
    tag: 'T-04',
    name: 'REPORTE MENSUAL',
    desc: 'Análisis de rendimiento, Sharpe, Sortino, max drawdown y comparación contra benchmarks. Exportable en PDF incluido en plan PRO.',
    detail: 'Cada primer miércoles del mes: análisis macro completo, señales activas PRO.MACD, equity curves actualizadas, rotación sectorial PCA y el modelo cuantitativo del mes en profundidad.',
    href: '/reportes',
    cta: 'VER REPORTES',
  },
  {
    tag: 'T-05',
    name: 'SIMULADOR FIRE',
    desc: 'Proyección de independencia financiera con horizonte personalizable. Calcula tu número FIRE y el tiempo estimado para alcanzarlo.',
    detail: 'Basado en la regla del 4%, ajustable por inflación y tasa de retiro dinámico. Calcula el capital necesario para tu estilo de vida objetivo y grafica el camino mensual para alcanzarlo.',
    href: '/login',
    cta: 'CALCULAR MI FIRE',
  },
  {
    tag: 'T-06',
    name: 'SEÑALES LP',
    desc: 'Motor cuantitativo automático para PancakeSwap v3. Rangos óptimos, Kelly sizing, Monte Carlo de impermanent loss y APR estimado.',
    detail: 'Calcula el rango de liquidez óptimo para pares BNB/USDT, ETH/USDC y más. Incluye simulación de impermanent loss bajo distintos escenarios de precio y estimación de APR ajustado por riesgo.',
    href: '/login',
    cta: 'VER SEÑALES LP',
  },
]

export default function RecursosPage() {
  return (
    <main className="bg-bg min-h-screen">

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 bg-grid-pattern bg-grid relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="section-label text-gold mb-6">{'// SIGMA RESEARCH · HERRAMIENTAS'}</div>
          <h1 className="display-heading text-6xl sm:text-8xl lg:text-[9rem] text-text leading-none mb-8">
            TODOS LOS
            <br />
            <span className="gold-text">RECURSOS</span>
          </h1>
          <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-xl">
            Infraestructura cuantitativa institucional para inversores independientes.
            Modelos validados, datos reales, sin conflictos de interés.
          </p>
        </div>
      </section>

      {/* Tools grid */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-px bg-border">
          {tools.map((t) => (
            <div key={t.tag} className="bg-surface p-8 flex flex-col md:flex-row gap-8">
              {/* Left: tag + name + desc */}
              <div className="flex flex-col gap-3 md:w-1/3">
                <span className="terminal-text text-xs text-gold border border-gold/20 px-2 py-0.5 self-start">
                  {t.tag}
                </span>
                <h2 className="display-heading text-3xl text-text">{t.name}</h2>
                <p className="terminal-text text-sm text-text-dim leading-relaxed">{t.desc}</p>
              </div>

              {/* Right: detail + cta */}
              <div className="flex flex-col gap-6 md:w-2/3 md:border-l md:border-border md:pl-8">
                <p className="terminal-text text-sm text-text-dim leading-relaxed">{t.detail}</p>
                <Link
                  href={t.href}
                  className="self-start section-label text-sm px-6 py-2.5 border border-gold text-gold hover:bg-gold hover:text-bg transition-all duration-200"
                >
                  {t.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
          <div className="section-label text-gold">{'// EMPIEZA HOY'}</div>
          <h2 className="display-heading text-4xl sm:text-6xl text-text">
            ACCESO
            <br />
            <span className="gold-text">INMEDIATO</span>
          </h2>
          <p className="terminal-text text-text-dim text-sm leading-relaxed">
            Crea tu cuenta gratuita en segundos. Sin tarjeta de crédito.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/registro"
              className="bg-gold text-bg section-label px-8 py-3 hover:bg-gold-glow transition-colors duration-200"
            >
              CREAR CUENTA GRATIS
            </Link>
            <Link
              href="/reportes"
              className="border border-border text-text-dim section-label px-8 py-3 hover:border-gold hover:text-gold transition-colors duration-200"
            >
              VER REPORTES
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}
