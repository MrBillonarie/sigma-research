'use client'

const models = [
  {
    id: 'regime',
    tag: 'HMM-01',
    name: 'REGIME DETECTOR',
    type: 'Hidden Markov Model',
    accuracy: '91.2%',
    metric: 'Accuracy',
    description:
      'Clasificación de régimen de mercado (Bull/Bear/Sideways) usando cadenas de Markov ocultas sobre retornos, volatilidad y breadth.',
    features: ['3 estados latentes', 'Viterbi decoding', 'Online learning', 'Lookback: 252 días'],
    status: 'PRODUCCIÓN',
    statusColor: 'text-emerald-400',
    langs: ['Python', 'NumPy', 'hmmlearn'],
  },
  {
    id: 'vol',
    tag: 'GARCH-02',
    name: 'VOL FORECASTER',
    type: 'GARCH(1,1) + LSTM',
    accuracy: '0.031',
    metric: 'MAE 30D',
    description:
      'Predicción de volatilidad realizada a 1-30 días. Ensemble de GARCH clásico y LSTM sobre superficie de volatilidad implícita.',
    features: ['GARCH(1,1) base', 'LSTM stacking', 'Vol surface inputs', 'HAR-RV component'],
    status: 'PRODUCCIÓN',
    statusColor: 'text-emerald-400',
    langs: ['Python', 'PyTorch', 'arch'],
  },
  {
    id: 'momentum',
    tag: 'XGB-03',
    name: 'MOMENTUM SCORE',
    type: 'XGBoost + Factor Model',
    accuracy: '2.41',
    metric: 'Sharpe OOS',
    description:
      'Score de momentum de 0-100 para acciones individuales. Combina momentum de precio, earnings revision y factor técnico adaptativo.',
    features: ['52 features técnicos', 'Factor neutralización', 'Cross-sectional', 'Rebalanceo semanal'],
    status: 'BETA',
    statusColor: 'text-yellow-400',
    langs: ['Python', 'XGBoost', 'pandas'],
  },
  {
    id: 'sentiment',
    tag: 'NLP-04',
    name: 'SENTIMENT ALPHA',
    type: 'FinBERT + Aggregator',
    accuracy: '73.8%',
    metric: 'F1-Score',
    description:
      'Análisis de sentimiento financiero sobre earnings calls, 10-K/Q filings y noticias de mercado con FinBERT fine-tuneado.',
    features: ['FinBERT base', 'SEC filings parser', '2,400 tickers', 'Daily inference'],
    status: 'BETA',
    statusColor: 'text-yellow-400',
    langs: ['Python', 'HuggingFace', 'CUDA'],
  },
  {
    id: 'pairs',
    tag: 'STAT-05',
    name: 'PAIRS TRADING',
    type: 'Cointegración + Kalman',
    accuracy: '1.87',
    metric: 'Sharpe OOS',
    description:
      'Detector de pares cointegrados con filtro Kalman para hedge ratio dinámico. Cubre el universo S&P 500 + Russell 1000.',
    features: ['Engle-Granger test', 'Kalman hedge ratio', '1,500 pares activos', 'Coste de fricción real'],
    status: 'PRODUCCIÓN',
    statusColor: 'text-emerald-400',
    langs: ['Python', 'statsmodels', 'pykalman'],
  },
  {
    id: 'macro',
    tag: 'VAR-06',
    name: 'MACRO REGIME',
    type: 'VAR + PCA Factor',
    accuracy: '84.1%',
    metric: 'Directional Acc.',
    description:
      'Modelo macro de rotación sectorial basado en factores PCA de variables macroeconómicas: curva yield, ISM, CPI sorpresa, DXY.',
    features: ['18 variables macro', 'PCA 6 factores', 'Rotación sectorial', 'Horizonte 3M'],
    status: 'PRODUCCIÓN',
    statusColor: 'text-emerald-400',
    langs: ['Python', 'scikit-learn', 'FRED API'],
  },
]

export default function Models() {
  return (
    <section id="modelos" className="bg-bg py-16 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="section-label text-gold mb-3">{'// MODELOS CUANTITATIVOS'}</div>
            <h2 className="display-heading text-4xl sm:text-5xl lg:text-7xl text-text">
              MOTOR
              <br />
              <span className="gold-text">ANALÍTICO</span>
            </h2>
          </div>
          <div className="terminal-text text-text-dim max-w-sm text-sm leading-relaxed">
            Stack de ML/estadística para generación de señales, gestión de riesgo y análisis macro.
            Todos los modelos son backtested con walk-forward out-of-sample.
          </div>
        </div>

        {/* Models grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {models.map((m) => (
            <div key={m.id} className="bg-surface p-5 flex flex-col gap-3 hover:bg-surface/80 transition-colors group">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <span className="terminal-text text-xs text-gold border border-gold/20 px-2 py-0.5">{m.tag}</span>
                <span className={`terminal-text text-xs ${m.statusColor}`}>{m.status}</span>
              </div>

              {/* Name */}
              <div>
                <div className="display-heading text-3xl text-text group-hover:text-gold transition-colors">{m.name}</div>
                <div className="terminal-text text-xs text-text-dim mt-1">{m.type}</div>
              </div>

              {/* Metric */}
              <div className="flex items-baseline gap-2">
                <span className="display-heading text-5xl gold-text num tabular-nums">{m.accuracy}</span>
                <span className="section-label text-text-dim">{m.metric}</span>
              </div>

              {/* Description */}
              <p className="terminal-text text-sm text-text-dim leading-relaxed">{m.description}</p>

              {/* Features */}
              <ul className="grid grid-cols-2 gap-1.5">
                {m.features.map((f) => (
                  <li key={f} className="terminal-text text-xs text-text flex items-start gap-1.5">
                    <span className="text-gold flex-shrink-0 mt-0.5">·</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Tech stack */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                {m.langs.map((l) => (
                  <span key={l} className="terminal-text text-xs text-text-dim border border-border px-2 py-0.5">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div className="mt-px grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
          {[
            { label: 'Modelos en producción', value: '4' },
            { label: 'Features totales', value: '200+' },
            { label: 'Años de datos históricos', value: '25+' },
            { label: 'Universo cubierto', value: '3,500 tickers' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface p-5">
              <div className="display-heading text-4xl text-gold num tabular-nums">{value}</div>
              <div className="section-label text-text-dim mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
