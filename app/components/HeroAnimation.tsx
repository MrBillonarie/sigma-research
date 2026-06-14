'use client'
import { useEffect, useState } from 'react'

// Equity curve — deterministic points (no hydration mismatch)
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

const SYMBOLS   = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
const SYM_LABEL: Record<string, string> = { BTCUSDT: 'BTC', ETHUSDT: 'ETH', SOLUSDT: 'SOL', BNBUSDT: 'BNB' }
const FALLBACK  = [
  { sym: 'BTC', price: '—', change: '…', up: true  },
  { sym: 'ETH', price: '—', change: '…', up: true  },
  { sym: 'SOL', price: '—', change: '…', up: false },
  { sym: 'BNB', price: '—', change: '…', up: true  },
]

interface Ticker { sym: string; price: string; change: string; up: boolean }

export default function HeroAnimation() {
  const [drawn,    setDrawn]    = useState(false)
  const [visible,  setVisible]  = useState(false)
  const [scanning, setScanning] = useState(false)
  const [tick,     setTick]     = useState(0)
  const [tickers,  setTickers]  = useState<Ticker[]>(FALLBACK)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true),  100)
    const t2 = setTimeout(() => setDrawn(true),    200)
    // Scanner starts after the draw animation completes (2.4s draw + 400ms buffer)
    const t3 = setTimeout(() => setScanning(true), 2800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  // Live prices from Binance public API
  useEffect(() => {
    async function fetchPrices() {
      try {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(SYMBOLS)}`
        const res  = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as Array<{ symbol: string; lastPrice: string; priceChangePercent: string }>
        setTickers(data.map(d => {
          const pct = parseFloat(d.priceChangePercent)
          const px  = parseFloat(d.lastPrice)
          return {
            sym:    SYM_LABEL[d.symbol] ?? d.symbol,
            price:  px >= 1000 ? px.toLocaleString('en-US', { maximumFractionDigits: 0 }) : px.toFixed(2),
            change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
            up:     pct >= 0,
          }
        }))
      } catch { /* keep fallback */ }
    }
    fetchPrices()
    const id = setInterval(fetchPrices, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(n => (n + 1) % tickers.length), 3000)
    return () => clearInterval(id)
  }, [tickers.length])

  // Shared draw animation — all 3 plasma layers use this
  const drawStyle = {
    strokeDasharray:  1400,
    strokeDashoffset: drawn ? 0 : 1400,
    transition:       'stroke-dashoffset 2.4s cubic-bezier(0.4,0,0.2,1)',
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>

      {/* ── Chart ─────────────────────────────────────────────────────────── */}
      <div
        className="absolute right-0 top-0 h-full transition-opacity duration-1000"
        style={{ opacity: visible ? 1 : 0, width: '55%' }}
      >
        <svg viewBox="0 0 800 380" preserveAspectRatio="xMidYMid meet" className="w-full h-full" fill="none">
          <defs>
            {/* Area fill gradient */}
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#d4af37" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0"    />
            </linearGradient>

            {/* Line gradient — fades in from left */}
            <linearGradient id="eqLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#d4af37" stopOpacity="0"   />
              <stop offset="35%"  stopColor="#d4af37" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="1"   />
            </linearGradient>

            {/* ── A: Plasma filters ───────────────────────────────────────── */}

            {/* Outer aura — wide, soft blur */}
            <filter id="aura" x="-15%" y="-600%" width="130%" height="1300%">
              <feGaussianBlur stdDeviation="9" />
            </filter>

            {/* Body glow — medium blur */}
            <filter id="glow" x="-20%" y="-300%" width="140%" height="700%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* ── E: Scanner dot halo ─────────────────────────────────────── */}
            {/* Wide golden halo around the scanner head */}
            <filter id="scanHalo" x="-800%" y="-800%" width="1700%" height="1700%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feColorMatrix
                type="matrix"
                values="1 0 0 0 0.95  0 0.9 0 0 0.75  0 0 0 0 0.2  0 0 0 1 0"
                in="blur" result="colored"
              />
              <feMerge>
                <feMergeNode in="colored" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Area fill */}
          <path d={FILL_PATH} fill="url(#eqFill)" />

          {/* ══ A: PLASMA LINE — 3 layers ════════════════════════════════════ */}

          {/* Layer 1 — wide aura (blurred, dim, gold) */}
          <path
            d={PATH_D} fill="none"
            stroke="#d4af37" strokeWidth="14" strokeOpacity="0.28"
            strokeLinejoin="round" filter="url(#aura)"
            style={drawStyle}
          />

          {/* Layer 2 — body (gradient L→R, medium glow) */}
          <path
            d={PATH_D} fill="none"
            stroke="url(#eqLine)" strokeWidth="2.2"
            strokeLinejoin="round" filter="url(#glow)"
            style={drawStyle}
          />

          {/* Layer 3 — hot core (near-white, razor thin, no filter for crispness) */}
          <path
            d={PATH_D} fill="none"
            stroke="rgba(255,252,215,0.80)" strokeWidth="0.75"
            strokeLinejoin="round"
            style={drawStyle}
          />

          {/* ══ E: SCANNER DOT — comet traveling the curve ═══════════════════ */}
          {scanning && (
            <>
              {/* Comet tail — 3 fading circles lagging behind the head */}
              {([
                { begin: '0.18s', r: 3.5, opacity: 0.40, color: '#f2c94c' },
                { begin: '0.35s', r: 2.5, opacity: 0.20, color: '#d4af37' },
                { begin: '0.58s', r: 1.8, opacity: 0.09, color: '#d4af37' },
              ] as Array<{ begin: string; r: number; opacity: number; color: string }>).map((dot, i) => (
                <circle key={i} r={dot.r} fill={dot.color} fillOpacity={dot.opacity}>
                  <animateMotion
                    dur="5s"
                    begin={dot.begin}
                    repeatCount="indefinite"
                    path={PATH_D}
                  />
                </circle>
              ))}

              {/* Scanner head — bright white with golden halo */}
              <circle r="4" fill="white" fillOpacity="0.95" filter="url(#scanHalo)">
                <animateMotion
                  dur="5s"
                  begin="0s"
                  repeatCount="indefinite"
                  path={PATH_D}
                />
              </circle>
            </>
          )}

          {/* Live endpoint dot (static, pings at the end of the curve) */}
          {drawn && (
            <>
              <circle cx={LAST_PT[0]} cy={LAST_PT[1]} r="5"  fill="#d4af37" filter="url(#glow)" />
              <circle cx={LAST_PT[0]} cy={LAST_PT[1]} r="5"  fill="#d4af37" opacity="0.6"
                style={{ animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }}
              />
            </>
          )}
        </svg>
      </div>

      {/* ── Live ticker strip ─────────────────────────────────────────────── */}
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
