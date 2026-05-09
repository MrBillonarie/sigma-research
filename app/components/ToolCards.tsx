'use client'

const GOLD   = '#d4af37'
const GREEN  = '#34d399'
const BLUE   = '#60a5fa'
const PURPLE = '#a78bfa'
const ORANGE = '#fb923c'
const RED    = '#f87171'

interface Tool {
  tag:   string
  name:  string
  desc:  string
  href?: string
  color: string
  badge: string
  icon:  React.ReactNode
  preview: React.ReactNode
}

// ── Mini SVG previews ─────────────────────────────────────────────────────────
function EquityLine({ color }: { color: string }) {
  return (
    <svg width="100%" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`eq-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0,32 C15,28 20,20 35,18 C50,16 55,22 70,14 C85,6 95,10 120,4" fill="none" stroke={color} strokeWidth="2" />
      <path d="M0,32 C15,28 20,20 35,18 C50,16 55,22 70,14 C85,6 95,10 120,4 L120,40 L0,40 Z" fill={`url(#eq-${color})`} />
      <circle cx="120" cy="4" r="3" fill={color} />
    </svg>
  )
}

function MonteCarloPaths() {
  const paths = [
    'M0,20 C20,18 40,8  60,6  C80,4  100,10 120,2',
    'M0,20 C20,22 40,16 60,12 C80,8  100,14 120,6',
    'M0,20 C20,24 40,28 60,22 C80,16 100,18 120,12',
    'M0,20 C20,26 40,32 60,28 C80,24 100,30 120,24',
    'M0,20 C20,28 40,36 60,34 C80,32 100,36 120,38',
  ]
  const colors = [GREEN, GOLD, BLUE, ORANGE, RED]
  return (
    <svg width="100%" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={colors[i]} strokeWidth="1.2" opacity={0.7 - i * 0.1} />
      ))}
    </svg>
  )
}

function FireGrowth() {
  return (
    <svg width="100%" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
      <defs>
        <linearGradient id="fire-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ORANGE} stopOpacity="0.3" />
          <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Progress bar at top */}
      <rect x="0" y="0" width="120" height="3" fill="#1a1d2e" rx="1" />
      <rect x="0" y="0" width="78" height="3" fill={GOLD} rx="1" />
      {/* Exponential curve */}
      <path d="M0,38 C30,36 60,30 80,20 C95,12 110,6 120,2" fill="none" stroke={ORANGE} strokeWidth="2" />
      <path d="M0,38 C30,36 60,30 80,20 C95,12 110,6 120,2 L120,40 L0,40 Z" fill="url(#fire-g)" />
      <circle cx="120" cy="2" r="3" fill={ORANGE} />
    </svg>
  )
}

function BarChart({ color }: { color: string }) {
  const bars = [8, 14, 10, 18, 12, 20, 16, 24, 18, 28]
  const max  = 28
  return (
    <svg width="100%" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
      {bars.map((h, i) => (
        <rect key={i} x={i * 13 + 2} y={40 - (h / max) * 36} width={9} height={(h / max) * 36}
          fill={color} opacity={0.4 + (i / bars.length) * 0.6} rx="1" />
      ))}
    </svg>
  )
}

function WavySignals() {
  return (
    <svg width="100%" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
      <path d="M0,20 C10,10 20,30 30,20 C40,10 50,30 60,20 C70,10 80,30 90,20 C100,10 110,30 120,20"
        fill="none" stroke={PURPLE} strokeWidth="1.5" opacity="0.5" />
      <path d="M0,20 C10,12 20,28 30,20 C40,12 50,28 60,20 C70,12 80,28 90,20 C100,12 110,28 120,20"
        fill="none" stroke={BLUE} strokeWidth="2" />
      {/* Signal markers */}
      {[30, 60, 90].map(x => (
        <g key={x}>
          <circle cx={x} cy={20} r="4" fill={GOLD} opacity="0.9" />
          <line x1={x} y1="12" x2={x} y2="4" stroke={GREEN} strokeWidth="1.5" />
          <polygon points={`${x-4},4 ${x+4},4 ${x},0`} fill={GREEN} />
        </g>
      ))}
    </svg>
  )
}

function PoolRange() {
  return (
    <svg width="100%" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
      {/* Price range bar */}
      <rect x="20" y="17" width="80" height="6" fill="#1a1d2e" rx="3" />
      <rect x="35" y="17" width="50" height="6" fill={GREEN} opacity="0.4" rx="3" />
      <line x1="60" y1="10" x2="60" y2="30" stroke={GOLD} strokeWidth="2" />
      <circle cx="60" cy="20" r="5" fill={GOLD} />
      {/* Labels */}
      <text x="20" y="38" fontSize="7" fill="#7a7f9a" fontFamily="monospace">MIN</text>
      <text x="95" y="38" fontSize="7" fill="#7a7f9a" fontFamily="monospace">MAX</text>
      <text x="48" y="8" fontSize="7" fill={GOLD} fontFamily="monospace">CURRENT</text>
    </svg>
  )
}

const TOOLS: Tool[] = [
  {
    tag: 'T-01', name: 'SIGMA TERMINAL', color: GOLD, badge: 'LIVE', href: '/registro',
    desc: 'Dashboard de trading en vivo. Portafolio multi-broker, balances Binance Spot & Futures, P&L consolidado.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    preview: <EquityLine color={GOLD} />,
  },
  {
    tag: 'T-02', name: 'MODELOS ML', color: BLUE, badge: 'PRO', href: '/registro',
    desc: 'Señales cuantitativas de régimen de mercado, volatilidad y momentum. Validadas con walk-forward out-of-sample.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z" />
        <line x1="12" y1="12" x2="12" y2="12.01" strokeWidth="2" />
      </svg>
    ),
    preview: <WavySignals />,
  },
  {
    tag: 'T-03', name: 'MONTE CARLO', color: PURPLE, badge: 'PRO', href: '/registro',
    desc: '10.000 simulaciones de portafolio con ajuste por inflación CLP/USD, retiro dinámico y percentiles de ruina.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="1.5" strokeLinecap="round">
        <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 4-4" />
      </svg>
    ),
    preview: <MonteCarloPaths />,
  },
  {
    tag: 'T-04', name: 'REPORTE MENSUAL', color: GREEN, badge: 'PRO', href: '/registro',
    desc: 'Análisis de rendimiento, Sharpe, Sortino, max drawdown y comparación vs benchmarks. Exportable en PDF.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.5" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
    preview: <BarChart color={GREEN} />,
  },
  {
    tag: 'T-05', name: 'SIMULADOR FIRE', color: ORANGE, badge: 'FREE', href: '/registro',
    desc: 'Proyección de independencia financiera con horizonte personalizable. Calcula tu número FIRE y años estimados.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    ),
    preview: <FireGrowth />,
  },
  {
    tag: 'T-06', name: 'SEÑALES LP', color: '#22d3ee', badge: 'PRO', href: '/registro',
    desc: 'Motor cuantitativo para PancakeSwap v3. Rangos óptimos, Kelly sizing, Monte Carlo de impermanent loss.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
    preview: <PoolRange />,
  },
]

export default function ToolCards() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
      {TOOLS.map((t) => (
        <div
          key={t.tag}
          className="bg-surface flex flex-col gap-0 group relative overflow-hidden"
          style={{ transition: 'transform 0.2s' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'}
        >
          {/* Accent line top */}
          <div className="h-0.5 w-0 group-hover:w-full transition-all duration-500" style={{ background: `linear-gradient(90deg, ${t.color}, transparent)` }} />

          <div className="p-6 flex flex-col gap-4 flex-1">
            {/* Header row */}
            <div className="flex items-start justify-between">
              <div className="p-2 border" style={{ borderColor: `${t.color}30`, background: `${t.color}08` }}>
                {t.icon}
              </div>
              <div className="flex items-center gap-2">
                <span className="terminal-text text-[10px] text-gold border border-gold/20 px-2 py-0.5">{t.tag}</span>
                <span
                  className="terminal-text text-[9px] px-2 py-0.5 border"
                  style={{
                    color:   t.badge === 'FREE' ? '#34d399' : t.badge === 'LIVE' ? '#f97316' : t.color,
                    borderColor: t.badge === 'FREE' ? 'rgba(52,211,153,0.3)' : t.badge === 'LIVE' ? 'rgba(249,115,22,0.3)' : `${t.color}40`,
                    background:  t.badge === 'FREE' ? 'rgba(52,211,153,0.08)' : t.badge === 'LIVE' ? 'rgba(249,115,22,0.08)' : `${t.color}08`,
                  }}
                >
                  {t.badge === 'LIVE' ? '● LIVE' : t.badge}
                </span>
              </div>
            </div>

            {/* Name */}
            <h3 className="display-heading text-2xl transition-colors duration-200" style={{ color: '#e8e9f0' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = t.color}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#e8e9f0'}
            >
              {t.name}
            </h3>

            {/* Desc */}
            <p className="terminal-text text-sm text-text-dim leading-relaxed flex-1">{t.desc}</p>

            {/* Mini preview */}
            <div className="opacity-40 group-hover:opacity-100 transition-opacity duration-300 -mx-1">
              {t.preview}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
