'use client'
import { useEffect, useState, useRef } from 'react'

// ── Equity curve generada una vez (determinística para evitar hidratación mismatch)
const POINTS = [
  [0,300],[40,280],[80,295],[120,260],[160,240],[200,255],[240,220],
  [280,200],[320,215],[360,185],[400,170],[440,155],[480,168],[520,140],
  [560,120],[600,130],[640,105],[680,90],[720,100],[760,78],[800,60],
]

function pointsToPath(pts: number[][]): string {
  if (!pts.length) return ''
  const [sx, sy] = pts[0]
  let d = `M ${sx} ${sy}`
  for (let i = 1; i < pts.length; i++) {
    const [cx, cy] = pts[i - 1]
    const [nx, ny] = pts[i]
    const mx = (cx + nx) / 2
    d += ` C ${mx} ${cy} ${mx} ${ny} ${nx} ${ny}`
  }
  return d
}

const PATH_D    = pointsToPath(POINTS)
const LAST_PT   = POINTS[POINTS.length - 1]
const FILL_PATH = PATH_D + ` L ${LAST_PT[0]} 380 L 0 380 Z`

const TICKERS = [
  { sym: 'BTC', price: '84,210', change: '+2.4%', up: true  },
  { sym: 'ETH', price: '3,182',  change: '+1.8%', up: true  },
  { sym: 'SOL', price: '147.5',  change: '-0.6%', up: false },
  { sym: 'SPX', price: '5,621',  change: '+0.9%', up: true  },
  { sym: 'DXY', price: '104.2',  change: '-0.3%', up: false },
  { sym: 'BNB', price: '594.0',  change: '+1.1%', up: true  },
]

export default function HeroAnimation() {
  const [drawn,   setDrawn]   = useState(false)
  const [visible, setVisible] = useState(false)
  const [tick,    setTick]    = useState(0)
  const svgRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    // Arranca la animación tras montaje
    const t1 = setTimeout(() => setVisible(true), 100)
    const t2 = setTimeout(() => setDrawn(true), 200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Pulso de ticker cada 3s
  useEffect(() => {
    const id = setInterval(() => setTick(n => (n + 1) % TICKERS.length), 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>

      {/* ── Equity curve ────────────────────────────────────────────────────── */}
      <div
        className="absolute right-0 top-0 h-full transition-opacity duration-1000"
        style={{ opacity: visible ? 1 : 0, width: '55%' }}
      >
        <svg viewBox="0 0 800 380" preserveAspectRatio="xMidYMid meet"
          className="w-full h-full" fill="none"
        >
          <defs>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#d4af37" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0"    />
            </linearGradient>
            <linearGradient id="eqLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#d4af37" stopOpacity="0"   />
              <stop offset="40%"  stopColor="#d4af37" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="1"   />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Fill */}
          <path d={FILL_PATH} fill="url(#eqFill)" />

          {/* Line */}
          <path
            ref={svgRef}
            d={PATH_D}
            stroke="url(#eqLine)"
            strokeWidth="2"
            filter="url(#glow)"
            style={{
              strokeDasharray: 1400,
              strokeDashoffset: drawn ? 0 : 1400,
              transition: 'stroke-dashoffset 2.4s cubic-bezier(0.4,0,0.2,1)',
            }}
          />

          {/* Live dot at end of curve */}
          {drawn && (
            <>
              <circle cx={LAST_PT[0]} cy={LAST_PT[1]} r="5" fill="#d4af37" filter="url(#glow)" />
              <circle cx={LAST_PT[0]} cy={LAST_PT[1]} r="5" fill="#d4af37"
                style={{ animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }}
                opacity="0.6"
              />
            </>
          )}
        </svg>
      </div>

      {/* ── Ticker strip (bottom of hero) ───────────────────────────────────── */}
      <div
        className="absolute bottom-8 left-0 right-0 flex items-center gap-6 px-8 transition-opacity duration-700"
        style={{ opacity: drawn ? 0.6 : 0 }}
      >
        {TICKERS.map((t, i) => (
          <div
            key={t.sym}
            className="flex items-center gap-2 transition-all duration-500"
            style={{ opacity: Math.abs(i - tick) < 3 ? 1 : 0.3 }}
          >
            <span className="terminal-text text-[10px] text-text-dim tracking-widest">{t.sym}</span>
            <span className="terminal-text text-[11px] text-text num tabular-nums">{t.price}</span>
            <span className={`terminal-text text-[10px] num ${t.up ? 'text-emerald-400' : 'text-red-400'}`}>
              {t.change}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes ping {
          0%   { transform: scale(1);   opacity: 0.6; }
          75%  { transform: scale(2.5); opacity: 0;   }
          100% { transform: scale(2.5); opacity: 0;   }
        }
      `}</style>
    </div>
  )
}
