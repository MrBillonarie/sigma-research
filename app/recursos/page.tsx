import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recursos — SQuant Desk',
  description: 'Herramientas cuantitativas institucionales para inversores independientes en LATAM.',
}

const tools = [
  {
    tag: 'T-01',
    name: 'SIGMA ENGINE',
    desc: 'Motor de trading cuantitativo en vivo. 70+ estrategias sobre BTC/ETH/SOL/BNB/LTC/XAU con optimización Bayesiana, walk-forward testing y paper trading en tiempo real.',
    detail: 'El corazón del sistema. El motor corre 24/7 en un VPS dedicado evaluando señales en múltiples timeframes (5m, 15m, 1h, 4h, 1d). Cada champion pasó por Optuna Bayesian Search, Robustness Gate y Walk-Forward OOS testing antes de activarse.',
    href: '/sigma-live',
    cta: 'VER SEÑALES EN VIVO',
  },
  {
    tag: 'T-02',
    name: 'MODELOS ML',
    desc: 'Champions cuantitativos del motor SIGMA. Señales validadas por activo y timeframe con métricas reales: CAGR, Win Rate, Max DD, Sharpe. Grados A+/A/B/C.',
    detail: 'Cada modelo tiene su equity curve, métricas OOS y red flags visibles. Los grades van de A+ (mejor edge) a D (bloqueado). Solo los modelos A+/A entran a paper trading activo.',
    href: '/modelos',
    cta: 'VER MODELOS',
  },
  {
    tag: 'T-03',
    name: 'MOTOR DE DECISIÓN',
    desc: 'Rotación cross-market. Señales de BUY/SELL/HOLD sobre ETFs globales, fondos mutuos, crypto y renta fija. Ajustado por régimen de mercado (risk-on/risk-off).',
    detail: 'Cubre 200+ activos (S&P 500, Nasdaq, mercados emergentes, sectores, materias primas, cripto). Detecta régimen de mercado con EMA/RSI/TLT y ajusta señales según tu perfil: retail, trader activo o institucional.',
    href: '/motor-decision',
    cta: 'ABRIR MOTOR',
  },
  {
    tag: 'T-04',
    name: 'MONTE CARLO',
    desc: '10.000 simulaciones de portafolio con ajuste por inflación CLP/USD, retiro dinámico y percentiles de probabilidad de ruina.',
    detail: 'Configura tu portafolio inicial, tasa de retorno esperada, volatilidad histórica y horizonte temporal. Obtén percentiles P10/P50/P90 y la probabilidad de alcanzar tu objetivo FIRE.',
    href: '/montecarlo',
    cta: 'SIMULAR PORTAFOLIO',
  },
  {
    tag: 'T-05',
    name: 'SIMULADOR FIRE',
    desc: 'Proyección de independencia financiera con horizonte personalizable. Calcula tu número FIRE y el tiempo estimado para alcanzarlo.',
    detail: 'Basado en la regla del 4%, ajustable por inflación y tasa de retiro dinámico. Calcula el capital necesario para tu estilo de vida objetivo y grafica el camino mensual para alcanzarlo. Incluye challenges gamificados.',
    href: '/fire',
    cta: 'CALCULAR MI FIRE',
  },
  {
    tag: 'T-06',
    name: 'SIGMA TERMINAL',
    desc: 'Dashboard de portafolio en vivo. Balances Binance Spot & Futures, P&L consolidado, posiciones IBKR y journal de trades.',
    detail: 'Conecta tus cuentas de Binance vía API de solo lectura. Visualiza tu P&L consolidado, posiciones abiertas, historial de operaciones y distribución de capital en un solo panel. Sin permisos de trading.',
    href: '/home',
    cta: 'ABRIR TERMINAL',
  },
  {
    tag: 'T-07',
    name: 'SEÑALES LP DEFI',
    desc: 'Motor cuantitativo para PancakeSwap v3. Rangos óptimos, Kelly sizing, Monte Carlo de impermanent loss y APR estimado.',
    detail: 'Calcula el rango de liquidez óptimo para pares BNB/USDT, ETH/USDC y más. Incluye simulación de impermanent loss bajo distintos escenarios de precio y estimación de APR ajustado por riesgo.',
    href: '/lp-defi',
    cta: 'VER SEÑALES LP',
  },
  {
    tag: 'T-08',
    name: 'REPORTE MENSUAL',
    desc: 'Análisis de rendimiento, Sharpe, Sortino, max drawdown y comparación contra benchmarks. Exportable en PDF en plan PRO.',
    detail: 'Análisis macro completo, señales activas del SIGMA ENGINE, equity curves actualizadas, rotación sectorial y resumen de trades del período. Entregado automáticamente en tu panel.',
    href: '/mis-reportes',
    cta: 'VER REPORTES',
  },
]

export default function RecursosPage() {
  return (
    <main className="bg-bg min-h-screen">

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 bg-grid-pattern bg-grid relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="section-label text-gold mb-6">{'// SQUANT DESK · HERRAMIENTAS'}</div>
          <h1 className="display-heading text-6xl sm:text-8xl lg:text-[9rem] text-text leading-none mb-8">
            TODOS LOS
            <br />
            <span className="gold-text">RECURSOS</span>
          </h1>
          <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-xl">
            Infraestructura cuantitativa para inversores independientes en LATAM.
            Motor real, datos reales, sin conflictos de interés.
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
          <Link
            href="/registro"
            className="bg-gold text-bg section-label px-8 py-3 hover:bg-gold-glow transition-colors duration-200"
          >
            CREAR CUENTA GRATIS
          </Link>
        </div>
      </section>

    </main>
  )
}
