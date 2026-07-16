import Link from 'next/link'
import type { Metadata } from 'next'
import { HeroRecursos, ModuleCard } from './visuals'

export const metadata: Metadata = {
  title: 'Recursos',
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

      {/* Hero — título 3D extruido + suelo con fuga + brasas */}
      <HeroRecursos />

      {/* Vitrina 3D de módulos */}
      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-5">
          {tools.map((t) => (
            <ModuleCard key={t.tag} tool={t} />
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

      {/* Atribuciones de imágenes (CC BY-SA exige crédito público) */}
      <section className="py-6 px-6 border-t border-border">
        <p className="terminal-text text-text-dim text-center" style={{ fontSize: 10, opacity: 0.7 }}>
          Imagen del toro (indicador de régimen): &quot;Toro De Lidia En Colombia&quot; — Santiago Molina N.,{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Toro_De_Lidia_En_Colombia.JPG" target="_blank" rel="noopener noreferrer" className="underline">
            Wikimedia Commons
          </a>
          , CC BY-SA 3.0 (recorte y tratamiento de color).
        </p>
      </section>

    </main>
  )
}
