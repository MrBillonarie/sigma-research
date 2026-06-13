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

const SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT']
const SYM_LABEL: Record<string, string> = { BTCUSDT:'BTC', ETHUSDT:'ETH', SOLUSDT:'SOL', BNBUSDT:'BNB' }
const FALLBACK = [
  { sym: 'BTC', price: '—', change: '…', up: true  },
  { sym: 'ETH', price: '—', change: '…', up: true  },
  { sym: 'SOL', price: '—', change: '…', up: false },
  { sym: 'BNB', price: '—', change: '…', up: true  },
]

interface Ticker { sym: string; price: string; change: string; up: boolean }

export default function HeroAnimation() {
  const [drawn,   setDrawn]   = useState(false)
  const [visible, setVisible] = useState(false)
  const [tick,    setTick]    = useState(0)
  const [tickers, setTickers] = useState<Ticker[]>(FALLBACK)
  const svgRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 100)
    const t2 = setTimeout(() => setDrawn(true), 200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Fetch precios en vivo desde Binance (público, sin API key)
  useEffect(() => {
    async function fetchPrices() {
      try {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(SYMBOLS)}`
        const res  = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as Array<{ symbol: string; lastPrice: string; priceChangePercent: string }>
        const mapped = data.map(d => {
          const pct = parseFloat(d.priceChangePercent)
          const px  = parseFloat(d.lastPrice)
          return {
            sym:    SYM_LABEL[d.symbol] ?? d.symbol,
            price:  px >= 1000 ? px.toLocaleString('en-US', { maximumFractionDigits: 0 }) : px.toFixed(2),
            change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
            up:     pct >= 0,
          }
        })
        setTickers(mapped)
      } catch { /* silently keep fallback */ }
    }
    fetchPrices()
    const id = setInterval(fetchPrices, 30_000)
    return () => clearInterval(id)
  }, [])

  // Pulso de ticker cada 3s
  useEffect(() => {
    const id = setInterval(() => setTick(n => (n + 1) % tickers.length), 3000)
    return () => clearInterval(id)
  }, [tickers.length])

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
        {tickers.map((t, i) => (
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
