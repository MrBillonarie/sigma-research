'use client'
import { useState } from 'react'

const products = [
  {
    id: 'terminal',
    tag: '01 / TERMINAL',
    name: 'SIGMA\nTERMINAL',
    tagline: 'Data feed institucional en tiempo real',
    description:
      'Feed de datos Level-2, order book profundidad completa, heatmaps de flujo de opciones, y screeners cuantitativos para equity, futuros y cripto.',
    features: [
      'Level-2 order book en tiempo real',
      'Options flow con dark pool detection',
      'Screener multi-factor cuantitativo',
      'Alertas por señal estadística',
      'Exportación a CSV / JSON / Webhook',
    ],
    badge: 'LIVE',
    color: 'emerald',
    preview: [
      '> SIGMA.scan(market="SPX", z_score > 2.0)',
      '  Encontrados: 14 outliers',
      '  NVDA  +3.2σ  Vol: 4.2M  ▲',
      '  META  +2.8σ  Vol: 2.1M  ▲',
      '  TSLA  -2.1σ  Vol: 8.7M  ▼',
      '> _',
    ],
  },
  {
    id: 'macd',
    tag: '02 / ALGORITMO',
    name: 'PRO\nMACD',
    tagline: 'Sistema MACD adaptativo con ML',
    description:
      'MACD adaptativo que ajusta sus parámetros dinámicamente según volatilidad del régimen. Backtested sobre 15 años, señales con probabilidad bayesiana.',
    features: [
      'MACD adaptativo multi-timeframe',
      'Calibración bayesiana de parámetros',
      'Detección de régimen con HMM',
      'Backtest integrado con slippage real',
      'Alertas TradingView / Telegram',
    ],
    badge: 'PRO',
    color: 'gold',
    preview: [
      '> PRO.MACD.signal("NVDA", tf="1D")',
      '  Régimen: BULL (conf: 87.3%)',
      '  MACD: 12.4 | Signal: 10.1',
      '  Histograma: +2.3 ↑↑',
      '  Señal: LONG 🟢 (prob: 0.74)',
      '> _',
    ],
  },
  {
    id: 'fire',
    tag: '03 / PLANIFICACIÓN',
    name: 'SIGMA\nFIRE',
    tagline: 'Calculadora FIRE con simulación Monte Carlo',
    description:
      'Motor de planificación FIRE con 50,000 simulaciones Monte Carlo. Considera inflación variable, secuencia de retornos, y optimización fiscal.',
    features: [
      'Monte Carlo 50,000 iteraciones',
      'Secuencia de riesgo de retornos',
      'Optimización de la Tasa Segura de Retiro',
      'Proyección de gastos con inflación real',
      'Comparador de portafolios',
    ],
    badge: 'FIRE',
    color: 'orange',
    preview: [
      '> FIRE.simulate(capital=500000,',
      '    gasto=2000, retorno=0.07)',
      '  Simulaciones: 50,000',
      '  FIRE a los: 38.2 años',
      '  Éxito (30yr): 94.3%',
      '> _',
    ],
  },
  {
    id: 'hud',
    tag: '04 / DASHBOARD',
    name: 'SIGMA\nHUD',
    tagline: 'Portfolio HUD con risk analytics',
    description:
      'Panel de control unificado para gestión de portafolio. Risk attribution, correlation matrix en vivo, VaR/CVaR y rebalanceo automático.',
    features: [
      'Risk attribution por activo/sector',
      'Correlation matrix dinámica',
      'VaR / CVaR / Expected Shortfall',
      'Rebalanceo automático por umbrales',
      'P&L real-time con benchmarking',
    ],
    badge: 'HUD',
    color: 'blue',
    preview: [
      '> HUD.portfolio.risk_report()',
      '  VaR (95%, 1D): -$1,240',
      '  CVaR (95%, 1D): -$1,890',
      '  Sharpe (YTD): 2.41',
      '  Max DD: -4.2% [Apr-24]',
      '> _',
    ],
  },
]

const colorMap: Record<string, string> = {
  emerald: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5',
  gold: 'text-gold border-gold/30 bg-gold/5',
  orange: 'text-orange-400 border-orange-400/30 bg-orange-400/5',
  blue: 'text-blue-400 border-blue-400/30 bg-blue-400/5',
}

const badgeBg: Record<string, string> = {
  emerald: 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20',
  gold: 'bg-gold/10 text-gold border border-gold/20',
  orange: 'bg-orange-400/10 text-orange-400 border border-orange-400/20',
  blue: 'bg-blue-400/10 text-blue-400 border border-blue-400/20',
}

export default function Products() {
  const [active, setActive] = useState(0)
  const p = products[active]

  return (
    <section id="productos" className="bg-bg py-16 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="section-label text-gold mb-3">{'// SUITE DE PRODUCTOS'}</div>
          <h2 className="display-heading text-4xl sm:text-5xl lg:text-7xl text-text">
            HERRAMIENTAS
            <br />
            <span className="gold-text">INSTITUCIONALES</span>
          </h2>
        </div>

        {/* Tab selector */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border mb-px">
          {products.map((prod, i) => (
            <button
              key={prod.id}
              onClick={() => setActive(i)}
              className={`p-4 text-left transition-all duration-200 ${
                active === i ? 'bg-surface' : 'bg-bg hover:bg-surface/50'
              }`}
            >
              <div className="section-label text-text-dim mb-1">{prod.tag}</div>
              <div className={`display-heading text-2xl whitespace-pre-line ${active === i ? 'text-gold' : 'text-text'}`}>
                {prod.name}
              </div>
            </button>
          ))}
        </div>

        {/* Content panel */}
        <div className="grid lg:grid-cols-2 gap-px bg-border">
          {/* Left: description */}
          <div className="bg-surface p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className={`terminal-text text-xs px-2 py-1 ${badgeBg[p.color]}`}>
                {p.badge}
              </span>
              <span className="section-label text-text-dim">{p.tagline}</span>
            </div>

            <p className="terminal-text text-text-dim leading-relaxed mb-8">{p.description}</p>

            <ul className="space-y-3 mb-8">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-3 terminal-text text-sm text-text">
                  <span className="text-gold mt-0.5 flex-shrink-0">▸</span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="flex gap-4">
              <a
                href="#cta"
                className={`px-6 py-3 display-heading text-lg tracking-widest transition-all duration-200 border ${colorMap[p.color]}`}
              >
                SOLICITAR ACCESO
              </a>
            </div>
          </div>

          {/* Right: terminal preview */}
          <div className="bg-bg p-6 lg:p-8 font-mono">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-3 h-3 rounded-full bg-red-500/60" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <span className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-4 terminal-text text-text-dim text-xs">sigma-research/{p.id}</span>
            </div>
            <div className="space-y-2">
              {p.preview.map((line, i) => (
                <div
                  key={i}
                  className={`terminal-text text-sm ${
                    line.startsWith('>') ? 'text-gold' : 'text-text-dim pl-2'
                  }`}
                >
                  {line}
                  {i === p.preview.length - 1 && (
                    <span className="inline-block w-2 h-3.5 bg-gold ml-0.5 animate-blink" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
