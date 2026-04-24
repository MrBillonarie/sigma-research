'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { C } from '@/app/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Kline { open: number; high: number; low: number; close: number }
type PoolApiData = Record<string, unknown>

interface PoolResult {
  name: string
  feeTierDisplay: string
  poolUrl: string
  aprPct: number
  tvlUSD: number
  apiFailed: boolean
  obRange: { lowerTick: number; upperTick: number; rangeWidthPct: number }
  kelly: { pct: number; usd: number }
  il: { ilPct: number; netYieldPct: number; breakEvenDays: number }
  score: number
  signal: { label: 'ENTRAR' | 'ESPERAR' | 'SALIR'; color: string }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MONO = "var(--font-dm-mono,'DM Mono',monospace)"
const SANS = "'Space Grotesk',system-ui,sans-serif"

const PLATFORMS = [
  { id: 'ibkr',            isCLP: false },
  { id: 'binance_spot',    isCLP: false },
  { id: 'binance_futures', isCLP: false },
  { id: 'fintual',         isCLP: true  },
  { id: 'santander',       isCLP: true  },
  { id: 'cash',            isCLP: false },
] as const
const TRM = 950

interface PoolConfig {
  name: string
  proxyKey: string
  fallbackApr: number
  fallbackFeeTier: number
  fallbackTvl: number
  fallbackVol24h: number
  url: string
}
const POOL_CONFIGS: PoolConfig[] = [
  {
    name: 'BTC/USDT',  proxyKey: 'btc',
    fallbackApr: 22, fallbackFeeTier: 0.0025, fallbackTvl: 5_000_000, fallbackVol24h: 300_000,
    url: 'https://pancakeswap.finance/add/0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c/0x55d398326f99059fF775485246999027B3197955/500',
  },
  {
    name: 'BNB/USDT',  proxyKey: 'bnb',
    fallbackApr: 35, fallbackFeeTier: 0.0005, fallbackTvl: 8_000_000, fallbackVol24h: 550_000,
    url: 'https://pancakeswap.finance/add/BNB/0x55d398326f99059fF775485246999027B3197955/500',
  },
  {
    name: 'USDC/USDT', proxyKey: 'usdc',
    fallbackApr: 8,  fallbackFeeTier: 0.0001, fallbackTvl: 12_000_000, fallbackVol24h: 250_000,
    url: 'https://pancakeswap.finance/add/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d/0x55d398326f99059fF775485246999027B3197955/100',
  },
]

const KELLY_BASE: Record<string, number> = {
  'BTC/USDT': 0.35, 'BNB/USDT': 0.25, 'USDC/USDT': 0.15,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const usd     = (n: number) => '$' + Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
const pct     = (n: number, d = 1) => isNaN(n) ? '—' : n.toFixed(d) + '%'
const pad2    = (n: number) => String(n).padStart(2, '0')
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`

function extractPoolFields(raw: PoolApiData, cfg: PoolConfig): { vol24h: number; feeTierDec: number; tvl: number } {
  const d = (raw.data as PoolApiData) ?? raw
  const vol24h     = Number(d.volumeUSD24h ?? d.volumeUSD ?? 0)
  const rawFt      = Number(d.feeTier ?? 2500)
  const feeTierDec = rawFt >= 1 ? rawFt / 1_000_000 : rawFt
  const tvl        = Number(d.tvlUSD ?? d.totalValueLockedUSD ?? 0)
  if (vol24h > 0 && feeTierDec > 0 && tvl > 0) return { vol24h, feeTierDec, tvl }
  return { vol24h: cfg.fallbackVol24h, feeTierDec: cfg.fallbackFeeTier, tvl: cfg.fallbackTvl }
}

// ─── Quant engines ────────────────────────────────────────────────────────────
function wilderSmooth(data: number[], period: number): number[] {
  if (data.length < period) return []
  const r: number[] = [data.slice(0, period).reduce((a, b) => a + b, 0)]
  for (let i = period; i < data.length; i++)
    r.push(r[r.length - 1] - r[r.length - 1] / period + data[i])
  return r
}

function calcADX(klines: Kline[], period = 14): number {
  if (klines.length < period + 2) return 20
  const trs: number[] = [], pDMs: number[] = [], mDMs: number[] = []
  for (let i = 1; i < klines.length; i++) {
    const c = klines[i], p = klines[i - 1]
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)))
    const up = c.high - p.high, dn = p.low - c.low
    pDMs.push(up > dn && up > 0 ? up : 0)
    mDMs.push(dn > up && dn > 0 ? dn : 0)
  }
  const sTR = wilderSmooth(trs, period), sP = wilderSmooth(pDMs, period), sM = wilderSmooth(mDMs, period)
  const dxs: number[] = []
  for (let i = 0; i < sTR.length; i++) {
    if (sTR[i] === 0) continue
    const pDI = sP[i] / sTR[i] * 100, mDI = sM[i] / sTR[i] * 100, sum = pDI + mDI
    if (sum === 0) continue
    dxs.push(Math.abs(pDI - mDI) / sum * 100)
  }
  if (!dxs.length) return 20
  const sl = dxs.slice(-period)
  return sl.reduce((a, b) => a + b, 0) / sl.length
}

function calcBBWidth(klines: Kline[], period = 20): number {
  if (klines.length < period) return 0.05
  const cls = klines.slice(-period).map(k => k.close)
  const mean = cls.reduce((a, b) => a + b, 0) / period
  const std  = Math.sqrt(cls.reduce((s, c) => s + (c - mean) ** 2, 0) / period)
  return mean > 0 ? (4 * std) / mean : 0.05
}

function calcATR(klines: Kline[], period = 14): number {
  if (klines.length < 2) return 0
  const trs: number[] = []
  for (let i = 1; i < klines.length; i++) {
    const c = klines[i], p = klines[i - 1]
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)))
  }
  const sl = trs.slice(-period)
  return sl.reduce((a, b) => a + b, 0) / sl.length
}

function detectBTCRegime(klines: Kline[]): { regime: 'TRENDING' | 'LATERAL' | 'VOLATILE'; adx: number; bbWidth: number } {
  const adx = calcADX(klines), bbWidth = calcBBWidth(klines)
  const regime: 'TRENDING' | 'LATERAL' | 'VOLATILE' =
    adx < 25 && bbWidth < 0.04 ? 'LATERAL' : adx > 35 ? 'TRENDING' : 'VOLATILE'
  return { regime, adx, bbWidth }
}

// FIX 2 — Per-pool range with different ATR multipliers
function calcPoolRange(
  poolName: string,
  btcPrice: number,
  bnbPrice: number,
  btcAtr: number,
): { lowerTick: number; upperTick: number; rangeWidthPct: number } {
  if (poolName === 'USDC/USDT') {
    return { lowerTick: 0.997, upperTick: 1.003, rangeWidthPct: 0.6 }
  }
  if (poolName === 'BNB/USDT') {
    const ref = bnbPrice > 0 ? bnbPrice : 600
    const atr = ref * 0.04
    const lo  = ref - atr * 1.2
    const hi  = ref + atr * 1.8
    return { lowerTick: lo, upperTick: hi, rangeWidthPct: ref > 0 ? (hi - lo) / ref * 100 : 10 }
  }
  // BTC/USDT
  const lo = btcPrice - btcAtr * 1.5
  const hi = btcPrice + btcAtr * 2.0
  return { lowerTick: lo, upperTick: hi, rangeWidthPct: btcPrice > 0 ? (hi - lo) / btcPrice * 100 : 10 }
}

function kellySize(totalUSD: number, regime: 'TRENDING' | 'LATERAL' | 'VOLATILE', poolName: string) {
  const base = KELLY_BASE[poolName] ?? 0
  const mul  = regime === 'LATERAL' ? 1 : regime === 'VOLATILE' ? 0.5 : 0
  const p    = Math.min(base * mul, 0.5)
  return { pct: p, usd: totalUSD * p }
}

function calcILConcentrated(currentPrice: number, lowerPrice: number, upperPrice: number): number {
  if (currentPrice <= 0 || lowerPrice <= 0 || upperPrice <= lowerPrice) return 0

  if (currentPrice >= lowerPrice && currentPrice <= upperPrice) {
    const k  = Math.sqrt(currentPrice) / Math.sqrt(upperPrice)
    return Math.abs(2 * Math.sqrt(k) / (1 + k) - 1) * 100
  }
  if (currentPrice < lowerPrice) {
    const ratio = currentPrice / lowerPrice
    return Math.abs(2 * Math.sqrt(ratio) / (1 + ratio) - 1) * 100
  }
  const ratio = upperPrice / currentPrice
  return Math.abs(2 * Math.sqrt(ratio) / (1 + ratio) - 1) * 100
}

function projectIL(currentPrice: number, lowerTick: number, upperTick: number, aprPct: number, days = 30) {
  const ilPct          = calcILConcentrated(currentPrice, lowerTick, upperTick)
  const dailyFeeReturn = aprPct / 365
  const netYieldPct    = aprPct * days / 365 - ilPct
  const breakEvenDays  = ilPct > 0 && dailyFeeReturn > 0 ? Math.ceil(ilPct / dailyFeeReturn) : 1
  return { ilPct, netYieldPct, breakEvenDays }
}

// FIX 3 — Score differentiates by APR, TVL, and range quality
function scorePool(
  regime: string,
  rangeWidthPct: number,
  netYieldPct: number,
  apr: number,
  tvl: number,
): number {
  let s = 0

  if (regime === 'LATERAL')  s += 35
  if (regime === 'VOLATILE') s += 15

  if (apr > 30)       s += 25
  else if (apr > 15)  s += 18
  else if (apr > 5)   s += 10
  else                s += 3

  if (netYieldPct > 3)      s += 20
  else if (netYieldPct > 1) s += 12
  else if (netYieldPct > 0) s += 6
  else                       s -= 10

  if (rangeWidthPct >= 3 && rangeWidthPct <= 8) s += 12
  else if (rangeWidthPct <= 15)                  s += 7
  else                                            s += 3

  if (tvl > 10_000_000)     s += 8
  else if (tvl > 3_000_000) s += 5
  else                       s += 2

  return Math.min(100, Math.max(0, s))
}

function getSignal(score: number): { label: 'ENTRAR' | 'ESPERAR' | 'SALIR'; color: string } {
  if (score >= 60) return { label: 'ENTRAR', color: '#22c55e' }
  if (score >= 35) return { label: 'ESPERAR', color: C.gold }
  return { label: 'SALIR', color: '#ef4444' }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LpSignalPage() {
  const [btcPrice,       setBtcPrice]       = useState(0)
  const [priceChange,    setPriceChange]    = useState(0)
  const [bnbPrice,       setBnbPrice]       = useState(0)       // FIX 2
  const [klines,         setKlines]         = useState<Kline[]>([])
  const [poolsData,      setPoolsData]      = useState<(PoolApiData | null)[]>([null, null, null])
  const [totalUSD,       setTotalUSD]       = useState(0)
  const [capitalInput,   setCapitalInput]   = useState('')      // FIX 1
  const [editingCapital, setEditingCapital] = useState(false)   // FIX 1
  const [portfolioEmpty, setPortfolioEmpty] = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [apiError,       setApiError]       = useState(false)
  const [lastUpdate,     setLastUpdate]     = useState<Date | null>(null)

  const prevRef     = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // FIX 1 — Portfolio: sigma_lp_capital first, then other keys
  useEffect(() => {
    let total = 0

    try {
      const lpCap = localStorage.getItem('sigma_lp_capital')
      if (lpCap) { const n = Number(lpCap); if (n > 0) total = n }
    } catch {}

    if (total === 0) {
      try {
        const raw1 = localStorage.getItem('sigma_portfolio')
        if (raw1) {
          const arr = JSON.parse(raw1)
          if (Array.isArray(arr))
            total = arr.reduce((s: number, i: Record<string, unknown>) => s + (Number(i.usd) || Number(i.value) || 0), 0)
          else if (arr && typeof arr === 'object' && (arr as Record<string, unknown>).total)
            total = Number((arr as Record<string, unknown>).total)
          if (total === 0 && arr && typeof arr === 'object' && !Array.isArray(arr))
            total = PLATFORMS.reduce((sum, pl) => { const v = (arr as Record<string, number>)[pl.id] ?? 0; return sum + (pl.isCLP ? v / TRM : v) }, 0)
        }
      } catch {}
    }

    if (total === 0) {
      try {
        const raw2 = localStorage.getItem('sigma_macro_portfolio')
        if (raw2) {
          const arr = JSON.parse(raw2)
          if (Array.isArray(arr))
            total = arr.reduce((s: number, i: Record<string, unknown>) => s + (Number(i.usd) || Number(i.value) || 0), 0)
        }
      } catch {}
    }

    if (total === 0) {
      try {
        const raw3 = localStorage.getItem('sigma_positions')
        if (raw3) {
          const arr = JSON.parse(raw3)
          if (Array.isArray(arr))
            total = arr.reduce((s: number, i: Record<string, unknown>) => s + (Number(i.usd) || Number(i.notional) || 0), 0)
        }
      } catch {}
    }

    setTotalUSD(total)
    setCapitalInput(total > 0 ? String(total) : '')
    if (total === 0) setPortfolioEmpty(true)
  }, [])

  // FIX 1 — Handle manual capital entry
  function handleCapitalChange(val: string) {
    setCapitalInput(val)
    const n = parseFloat(val)
    if (!isNaN(n) && n > 0) {
      setTotalUSD(n)
      setPortfolioEmpty(false)
      try { localStorage.setItem('sigma_lp_capital', String(n)) } catch {}
    } else {
      setTotalUSD(0)
      setPortfolioEmpty(true)
    }
  }

  // BTC WebSocket
  useEffect(() => {
    let ws: WebSocket
    function connect() {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@miniTicker')
      ws.onmessage = (e: MessageEvent) => {
        const d = JSON.parse(e.data as string) as { c: string }
        const p = parseFloat(d.c)
        if (prevRef.current > 0) setPriceChange(((p - prevRef.current) / prevRef.current) * 100)
        prevRef.current = p
        setBtcPrice(p)
      }
      ws.onclose = () => setTimeout(connect, 5000)
    }
    connect()
    return () => ws?.close()
  }, [])

  // Klines + BNB price + PancakeSwap proxy
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=50')
      if (res.ok) {
        const raw = await res.json() as [number, string, string, string, string, ...unknown[]][]
        setKlines(raw.map(r => ({ open: parseFloat(r[1]), high: parseFloat(r[2]), low: parseFloat(r[3]), close: parseFloat(r[4]) })))
      }
    } catch {}

    // FIX 2 — Fetch BNB spot price
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
      if (res.ok) {
        const d = await res.json() as { price: string }
        const p = parseFloat(d.price)
        if (p > 0) setBnbPrice(p)
      }
    } catch {}

    const results = await Promise.all(
      POOL_CONFIGS.map(async (cfg): Promise<PoolApiData | null> => {
        try {
          const res = await fetch(`/api/pancakeswap/pools?pool=${cfg.proxyKey}`)
          if (!res.ok) return null
          const json = await res.json() as PoolApiData
          if ((json as Record<string, unknown>).error) return null
          return json
        } catch { return null }
      })
    )
    setApiError(results.every(r => r === null))
    setPoolsData(results)
    setLoading(false)
    setLastUpdate(new Date())
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 5 * 60 * 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])

  // ─── Engine ──────────────────────────────────────────────────────────────────
  const engine = useMemo(() => {
    const { regime, adx, bbWidth } = klines.length > 15
      ? detectBTCRegime(klines)
      : { regime: 'VOLATILE' as const, adx: 20, bbWidth: 0.05 }

    const price  = btcPrice || 84_000
    const btcAtr = calcATR(klines)

    const pools: PoolResult[] = POOL_CONFIGS.map((cfg, i) => {
      const apiPool   = poolsData[i]
      const apiFailed = !apiPool

      const { vol24h, feeTierDec, tvl: tvlUSD } = apiPool
        ? extractPoolFields(apiPool, cfg)
        : { vol24h: cfg.fallbackVol24h, feeTierDec: cfg.fallbackFeeTier, tvl: cfg.fallbackTvl }

      const aprPct         = tvlUSD > 0 ? Math.min(Math.max((vol24h * feeTierDec * 365) / tvlUSD * 100, 0.1), 500) : cfg.fallbackApr
      const feeTierDisplay = (feeTierDec * 100).toFixed(2) + '%'
      const kelly          = kellySize(totalUSD, regime, cfg.name)

      // FIX 2 — Per-pool range and correct current price for IL
      const obRange     = calcPoolRange(cfg.name, price, bnbPrice, btcAtr)
      const poolPrice   = cfg.name === 'BNB/USDT' ? (bnbPrice || 600) : cfg.name === 'USDC/USDT' ? 1.0 : price

      // FIX 3 — Updated scorePool with apr and tvl
      const il    = projectIL(poolPrice, obRange.lowerTick, obRange.upperTick, aprPct, 30)
      const score = scorePool(regime, obRange.rangeWidthPct, il.netYieldPct, aprPct, tvlUSD)

      return { name: cfg.name, feeTierDisplay, poolUrl: cfg.url, aprPct, tvlUSD, apiFailed, obRange, kelly, il, score, signal: getSignal(score) }
    })

    const best = [...pools].sort((a, b) => b.score - a.score)[0]
    const summary = regime === 'TRENDING'
      ? `Régimen TRENDING detectado (ADX=${adx.toFixed(1)}, BB Width=${(bbWidth * 100).toFixed(1)}%). El mercado está en tendencia — los pools LP no son eficientes ahora. Capital sugerido: $0 en todos los pools. Espera régimen LATERAL o VOLATILE antes de desplegar liquidez.`
      : `Régimen ${regime} detectado (ADX=${adx.toFixed(1)}, BB Width=${(bbWidth * 100).toFixed(1)}%). El pool más eficiente es ${best?.name ?? '—'} con score ${best?.score ?? 0}/100. Capital total disponible: ${usd(totalUSD)}. Asignación recomendada: ${usd(best?.kelly.usd ?? 0)} (${((best?.kelly.pct ?? 0) * 100).toFixed(0)}%) en ${best?.name ?? '—'}.`

    return { regime, adx, bbWidth, pools, summary }
  }, [klines, btcPrice, bnbPrice, poolsData, totalUSD])

  const regimeColor = engine.regime === 'LATERAL' ? C.green : engine.regime === 'TRENDING' ? C.red : C.yellow

  const inputStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: 11, background: C.bg,
    border: `1px solid ${C.gold}44`, color: C.text,
    padding: '5px 8px', width: '100%', boxSizing: 'border-box',
    outline: 'none', marginTop: 2,
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100%' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* ── HEADER ──────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 6 }}>
            {'// LP SIGNAL PANEL · PANCAKESWAP V3 BSC'}
          </div>
          <h1 style={{ fontFamily: SANS, fontSize: 'clamp(32px,4vw,56px)', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', margin: '0 0 6px' }}>
            <span style={{ color: C.text }}>LP </span><span style={{ color: C.gold }}>SIGNAL</span><span style={{ color: C.text }}> PANEL</span>
          </h1>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.dimText, letterSpacing: '0.08em' }}>
            Señales cuantitativas en tiempo real · sin inputs manuales
          </div>
        </div>

        {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.border, marginBottom: 24 }}>

          <TopCell label="BTC PRICE LIVE">
            <div style={{ fontFamily: SANS, fontSize: 26, fontWeight: 700, color: C.gold, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {btcPrice > 0 ? usd(btcPrice) : <LoadPulse w={120} h={26} />}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: priceChange >= 0 ? C.green : C.red, marginTop: 4 }}>
              {btcPrice > 0 ? (priceChange >= 0 ? '+' : '') + priceChange.toFixed(4) + '%' : '...'}
            </div>
          </TopCell>

          <TopCell label="RÉGIMEN BTC 4H">
            {loading
              ? <LoadPulse w={100} h={28} />
              : <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, color: regimeColor }}>{engine.regime}</div>
            }
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.dimText, marginTop: 4 }}>
              ADX {engine.adx.toFixed(1)} · BB {(engine.bbWidth * 100).toFixed(1)}%
              {bnbPrice > 0 && <span style={{ marginLeft: 8 }}>BNB {usd(bnbPrice)}</span>}
            </div>
          </TopCell>

          {/* FIX 1 — Capital input */}
          <TopCell label="PORTAFOLIO">
            {(portfolioEmpty || editingCapital) ? (
              <div>
                <input
                  type="number"
                  placeholder="Ingresa tu capital total ($)"
                  value={capitalInput}
                  onChange={e => handleCapitalChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && totalUSD > 0) setEditingCapital(false) }}
                  style={inputStyle}
                  autoFocus={editingCapital}
                />
                {editingCapital && totalUSD > 0 && (
                  <button onClick={() => setEditingCapital(false)} style={{
                    fontFamily: MONO, fontSize: 9, background: C.gold + '20',
                    border: `1px solid ${C.gold}44`, color: C.gold,
                    padding: '3px 8px', cursor: 'pointer', marginTop: 4,
                  }}>✓ OK</button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, color: C.gold, lineHeight: 1 }}>
                  {usd(totalUSD)}
                </div>
                <button onClick={() => setEditingCapital(true)} style={{
                  background: 'transparent', border: 'none',
                  color: C.dimText, cursor: 'pointer', fontSize: 13, padding: 2,
                  lineHeight: 1, marginTop: 2,
                }}>✎</button>
              </div>
            )}
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.dimText, marginTop: 4 }}>base Kelly</div>
          </TopCell>

          <TopCell label="ACTUALIZACIÓN">
            <div style={{ fontFamily: MONO, fontSize: 16, color: C.text, lineHeight: 1 }}>
              {lastUpdate ? fmtTime(lastUpdate) : <LoadPulse w={80} h={20} />}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: apiError ? C.red : C.green, marginTop: 4, letterSpacing: '0.1em' }}>
              {apiError ? '⚠ API ERROR' : '● API OK'}
            </div>
          </TopCell>
        </div>

        {/* ── POOL CARDS ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="animate-pulse" style={{ background: C.surface, border: `1px solid ${C.border}`, height: 400 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
            {engine.pools.map(p => <PoolCard key={p.name} pool={p} />)}
          </div>
        )}

        {/* ── RESUMEN EJECUTIVO ────────────────────────────────────────────────── */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 22px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.dimText, marginBottom: 14 }}>
            {'// RESUMEN EJECUTIVO'}
          </div>
          <p style={{ fontFamily: MONO, fontSize: 12, color: C.text, lineHeight: 1.9, margin: 0 }}>
            {engine.summary}
          </p>
        </div>

      </div>
    </div>
  )
}

// ─── Pool Card ────────────────────────────────────────────────────────────────
function PoolCard({ pool }: { pool: PoolResult }) {
  const { signal, score, il } = pool
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderTop: `2px solid ${signal.color}`, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, color: C.text }}>{pool.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.dimText, marginTop: 2, letterSpacing: '0.1em' }}>
            FEE {pool.feeTierDisplay}
            {pool.apiFailed && <span style={{ color: C.yellow, marginLeft: 8 }}>FALLBACK</span>}
          </div>
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
          color: signal.color, background: signal.color + '18',
          border: `1px solid ${signal.color}44`, padding: '5px 12px',
        }}>
          {signal.label}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.15em', color: C.dimText }}>SCORE</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.gold }}>{score}/100</span>
        </div>
        <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
          <div style={{ width: `${score}%`, height: '100%', background: C.gold, borderRadius: 2, transition: 'width 0.5s' }} />
        </div>
      </div>

      <PRow label="RANGO"
        value={`${usd(pool.obRange.lowerTick)} → ${usd(pool.obRange.upperTick)}`}
        sub={`ancho: ${pool.obRange.rangeWidthPct.toFixed(1)}%`}
      />
      <PRow label="CAPITAL SUGERIDO"
        value={pool.kelly.usd > 0 ? usd(pool.kelly.usd) : '—'}
        sub={`${(pool.kelly.pct * 100).toFixed(0)}% portafolio`}
        valueColor={C.gold}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Metric label="APR"    value={pct(pool.aprPct)}    color={C.green} />
        <Metric label="IL 30D" value={pct(il.ilPct, 2)}   color={il.ilPct > 5 ? C.red : C.yellow} />
        <Metric label="NET"    value={pct(il.netYieldPct)} color={il.netYieldPct >= 0 ? C.green : C.red} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <PRow label="BREAK-EVEN"
          value={il.breakEvenDays < 9999 ? `${il.breakEvenDays}d` : '—'}
          valueColor={il.breakEvenDays < 30 ? C.green : C.yellow}
        />
        {pool.tvlUSD > 0 && <PRow label="TVL" value={usd(pool.tvlUSD)} />}
      </div>

      <a href={pool.poolUrl} target="_blank" rel="noopener noreferrer" style={{
        display: 'block', textAlign: 'center', textDecoration: 'none',
        fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em',
        color: C.gold, background: C.gold + '14',
        border: `1px solid ${C.gold}44`, padding: '8px', marginTop: 2,
      }}>
        Ver en PancakeSwap ↗
      </a>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TopCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, padding: '16px 18px' }}>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function PRow({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dimText, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 12, color: valueColor ?? C.text }}>
        {value}
        {sub && <span style={{ fontSize: 9, color: C.dimText, marginLeft: 6 }}>{sub}</span>}
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, padding: '8px 6px', textAlign: 'center' }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: C.dimText, letterSpacing: '0.15em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function LoadPulse({ w, h }: { w: number; h: number }) {
  return <div className="animate-pulse" style={{ width: w, height: h, background: C.border, borderRadius: 2 }} />
}
