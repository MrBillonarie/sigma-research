'use client'
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { C } from '@/app/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Kline { open: number; high: number; low: number; close: number }

interface PoolApiResponse {
  apr: number; feeTier: number; tvl: number; volume24h: number; price: number
}

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

interface MCResult {
  p5: number; p50: number; p95: number; pctInRange: number; paths: number[][]
}
interface PoolMCData { d7: MCResult; d30: MCResult; d90: MCResult }

// ─── Constants ────────────────────────────────────────────────────────────────
const MONO = "var(--font-dm-mono,'DM Mono',monospace)"
const SANS = "'Space Grotesk',system-ui,sans-serif"

interface PoolConfig {
  name: string; proxyKey: string
  fallbackApr: number; fallbackFeeTier: number; fallbackTvl: number; fallbackVol24h: number
  url: string
}
const POOL_CONFIGS: PoolConfig[] = [
  { name: 'BTC/USDT', proxyKey: 'btc', fallbackApr: 22, fallbackFeeTier: 0.0025, fallbackTvl: 5_000_000, fallbackVol24h: 300_000,
    url: 'https://pancakeswap.finance/add/0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c/0x55d398326f99059fF775485246999027B3197955/500' },
  { name: 'BNB/USDT', proxyKey: 'bnb', fallbackApr: 35, fallbackFeeTier: 0.0005, fallbackTvl: 8_000_000, fallbackVol24h: 550_000,
    url: 'https://pancakeswap.finance/add/BNB/0x55d398326f99059fF775485246999027B3197955/500' },
  { name: 'USDC/USDT', proxyKey: 'usdc', fallbackApr: 8, fallbackFeeTier: 0.0001, fallbackTvl: 12_000_000, fallbackVol24h: 250_000,
    url: 'https://pancakeswap.finance/add/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d/0x55d398326f99059fF775485246999027B3197955/100' },
]
const KELLY_BASE: Record<string, number> = { 'BTC/USDT': 0.35, 'BNB/USDT': 0.25, 'USDC/USDT': 0.15 }
const SIGMAS: Record<string, number>     = { 'BTC/USDT': 0.035, 'BNB/USDT': 0.040, 'USDC/USDT': 0.0005 }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const usd     = (n: number) => '$' + Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
const pct     = (n: number, d = 1) => isNaN(n) ? '—' : n.toFixed(d) + '%'
const pad2    = (n: number) => String(n).padStart(2, '0')
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`

// ─── Analytics engines ────────────────────────────────────────────────────────
function calcPInRange(currentPrice: number, lower: number, upper: number, sigma: number, days: number): number {
  if (sigma === 0 || currentPrice <= 0) return 100
  const sigmaT = sigma * Math.sqrt(days)
  const zLower = Math.log(lower / currentPrice) / sigmaT
  const zUpper = Math.log(upper / currentPrice) / sigmaT
  const normCDF = (z: number) => 0.5 * (1 + Math.sign(z) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI)))
  return Math.max(0, Math.min(100, (normCDF(zUpper) - normCDF(zLower)) * 100))
}

function calcDailyFee(capitalUSD: number, apr: number, pInRange: number): number {
  return capitalUSD * (apr / 100 / 365) * (pInRange / 100)
}

function calcDailyIL(sigma: number, rangeWidthPct: number): number {
  const gamma = 0.5 * sigma * sigma
  return gamma * (1 - rangeWidthPct / 100) * 100
}

function calcILConcentrated(
  currentPrice: number, lowerPrice: number, upperPrice: number,
  entryPrice = 0,
): number {
  if (currentPrice <= 0 || lowerPrice <= 0 || upperPrice <= lowerPrice) return 0
  const P0 = entryPrice > 0 ? entryPrice : currentPrice
  if (P0 <= 0) return 0
  const r = currentPrice / P0
  const u = Math.sqrt(r)
  const il_v2 = (u - 1) * (u - 1) / (1 + r)
  const sqrtLo = Math.sqrt(lowerPrice)
  const sqrtHi = Math.sqrt(upperPrice)
  const sqrtP0 = Math.sqrt(P0)
  const cf = sqrtHi - sqrtLo > 0 ? sqrtP0 / (sqrtHi - sqrtLo) : 1
  return il_v2 * cf * 100
}

function runMonteCarlo(
  currentPrice: number, lower: number, upper: number,
  sigma: number, capitalUSD: number, apr: number,
  days: number, simulations = 500,
): MCResult {
  function gaussianRandom(): number {
    let u1 = 0
    while (u1 === 0) u1 = Math.random()
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random())
  }
  const dailyFeeRate = (apr / 100) / 365
  const finalPnLs: number[] = []
  const allPaths: number[][] = []
  let inRangeCount = 0
  for (let s = 0; s < simulations; s++) {
    let price = currentPrice
    let fees = 0
    let alwaysIn = true
    const path: number[] = []
    for (let d = 0; d < days; d++) {
      price = price * Math.exp(sigma * gaussianRandom())
      const inRange = price >= lower && price <= upper
      if (inRange) { fees += capitalUSD * dailyFeeRate } else { alwaysIn = false }
      const ilPct = calcILConcentrated(price, lower, upper, currentPrice)
      path.push(fees - (ilPct / 100) * capitalUSD)
    }
    if (alwaysIn) inRangeCount++
    const finalIL = calcILConcentrated(price, lower, upper, currentPrice)
    finalPnLs.push(fees - (finalIL / 100) * capitalUSD)
    allPaths.push(path)
  }
  finalPnLs.sort((a, b) => a - b)
  return {
    p5:  finalPnLs[Math.floor(simulations * 0.05)],
    p50: finalPnLs[Math.floor(simulations * 0.50)],
    p95: finalPnLs[Math.floor(simulations * 0.95)],
    pctInRange: (inRangeCount / simulations) * 100,
    paths: allPaths.filter((_, i) => i % 50 === 0),  // 10 paths visibles
  }
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

function calcPoolRange(
  poolName: string, btcPrice: number, bnbPrice: number, btcAtr: number,
): { lowerTick: number; upperTick: number; rangeWidthPct: number } {
  if (poolName === 'USDC/USDT') return { lowerTick: 0.997, upperTick: 1.003, rangeWidthPct: 0.6 }
  if (poolName === 'BNB/USDT') {
    const ref = bnbPrice > 0 ? bnbPrice : 600
    const atr = ref * 0.04
    const lo = ref - atr * 1.2, hi = ref + atr * 1.8
    return { lowerTick: lo, upperTick: hi, rangeWidthPct: ref > 0 ? (hi - lo) / ref * 100 : 10 }
  }
  const lo = btcPrice - btcAtr * 1.5, hi = btcPrice + btcAtr * 2.0
  return { lowerTick: lo, upperTick: hi, rangeWidthPct: btcPrice > 0 ? (hi - lo) / btcPrice * 100 : 10 }
}

function kellySize(totalUSD: number, regime: 'TRENDING' | 'LATERAL' | 'VOLATILE', poolName: string) {
  const base = KELLY_BASE[poolName] ?? 0
  const mul  = regime === 'LATERAL' ? 1 : regime === 'VOLATILE' ? 0.5 : 0
  const p    = Math.min(base * mul, 0.5)
  return { pct: p, usd: totalUSD * p }
}

function projectIL(currentPrice: number, lowerTick: number, upperTick: number, aprPct: number, days = 30) {
  const ilAtLower      = calcILConcentrated(lowerTick, lowerTick, upperTick, currentPrice)
  const ilAtUpper      = calcILConcentrated(upperTick, lowerTick, upperTick, currentPrice)
  const ilPct          = Math.max(ilAtLower, ilAtUpper)
  const dailyFeeReturn = aprPct / 365
  const netYieldPct    = aprPct * days / 365 - ilPct
  const breakEvenDays  = ilPct > 0 && dailyFeeReturn > 0 ? Math.ceil(ilPct / dailyFeeReturn) : 1
  return { ilPct, netYieldPct, breakEvenDays }
}

function scorePool(regime: string, rangeWidthPct: number, netYieldPct: number, apr: number, tvl: number): number {
  let s = 0
  if (regime === 'LATERAL')  s += 35
  if (regime === 'VOLATILE') s += 15
  if (apr > 30) s += 25; else if (apr > 15) s += 18; else if (apr > 5) s += 10; else s += 3
  if (netYieldPct > 3) s += 20; else if (netYieldPct > 1) s += 12; else if (netYieldPct > 0) s += 6; else s -= 10
  if (rangeWidthPct >= 3 && rangeWidthPct <= 8) s += 12; else if (rangeWidthPct <= 15) s += 7; else s += 3
  if (tvl > 10_000_000) s += 8; else if (tvl > 3_000_000) s += 5; else s += 2
  return Math.min(100, Math.max(0, s))
}

function getSignal(score: number): { label: 'ENTRAR' | 'ESPERAR' | 'SALIR'; color: string } {
  if (score >= 60) return { label: 'ENTRAR', color: '#22c55e' }
  if (score >= 35) return { label: 'ESPERAR', color: C.gold }
  return { label: 'SALIR', color: '#ef4444' }
}

// ─── BTC Price Ticker (isolated — WS ticks don't re-render parent) ────────────
function BtcPriceTicker({ onPriceUpdate }: { onPriceUpdate: (p: number) => void }) {
  const [price,  setPrice]  = useState(0)
  const [change, setChange] = useState(0)
  const prevRef = useRef(0)
  useEffect(() => {
    let ws: WebSocket
    function connect() {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@miniTicker')
      ws.onmessage = (e: MessageEvent) => {
        const p = parseFloat((JSON.parse(e.data as string) as { c: string }).c)
        if (prevRef.current > 0) setChange(((p - prevRef.current) / prevRef.current) * 100)
        prevRef.current = p
        setPrice(p)
        onPriceUpdate(p)
      }
      ws.onclose = () => setTimeout(connect, 5000)
    }
    connect()
    return () => ws?.close()
  }, [onPriceUpdate])
  return (
    <TopCell label="BTC PRICE LIVE">
      <div style={{ fontFamily: SANS, fontSize: 26, fontWeight: 700, color: C.gold, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {price > 0 ? usd(price) : <LoadPulse w={120} h={26} />}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: change >= 0 ? C.green : C.red, marginTop: 4 }}>
        {price > 0 ? (change >= 0 ? '+' : '') + change.toFixed(4) + '%' : '...'}
      </div>
    </TopCell>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LpSignalPage() {
  const [snapshotBtcPrice, setSnapshotBtcPrice] = useState(0)
  const livePriceRef = useRef(0)

  const [capitalUSD, setCapitalUSD] = useState(0)

  // Read capital on mount: sigma_portfolio_total (Terminal) → sigma_lp_capital (manual fallback)
  useEffect(() => {
    try {
      const keys = ['sigma_portfolio_total', 'sigma_lp_capital']
      for (const key of keys) {
        const n = Number(localStorage.getItem(key))
        if (n > 0) { setCapitalUSD(n); return }
      }
    } catch {}
  }, [])

  const [bnbPrice,   setBnbPrice]   = useState(0)
  const [klines,     setKlines]     = useState<Kline[]>([])
  const [poolsData,  setPoolsData]  = useState<(PoolApiResponse | null)[]>([null, null, null])
  const [loading,    setLoading]    = useState(true)
  const [apiError,   setApiError]   = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [mcResults,  setMcResults]  = useState<(PoolMCData | null)[]>([null, null, null])
  const [mcLoading,  setMcLoading]  = useState(false)
  const [activeTabs, setActiveTabs] = useState<('7D' | '30D' | '90D')[]>(['30D', '30D', '30D'])
  const [mcTick,     setMcTick]     = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handlePriceUpdate = useCallback((p: number) => {
    livePriceRef.current = p
    setSnapshotBtcPrice(prev => prev === 0 ? p : prev)
  }, [])

  // 30s: promote live ref → snapshot state for engine/cards
  useEffect(() => {
    const id = setInterval(() => {
      if (livePriceRef.current > 0) setSnapshotBtcPrice(livePriceRef.current)
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  // 60s: tick that triggers MC re-simulation
  useEffect(() => {
    const id = setInterval(() => setMcTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=50')
      if (res.ok) {
        const raw = await res.json() as [number, string, string, string, string, ...unknown[]][]
        setKlines(raw.map(r => ({ open: parseFloat(r[1]), high: parseFloat(r[2]), low: parseFloat(r[3]), close: parseFloat(r[4]) })))
      }
    } catch {}
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
      if (res.ok) { const d = await res.json() as { price: string }; const p = parseFloat(d.price); if (p > 0) setBnbPrice(p) }
    } catch {}
    const results = await Promise.all(
      POOL_CONFIGS.map(async (cfg): Promise<PoolApiResponse | null> => {
        try {
          const res = await fetch(`/api/pancakeswap/pools?pool=${cfg.proxyKey}`)
          if (!res.ok) return null
          const json = await res.json() as PoolApiResponse
          if (json.apr === 0) return null
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

  // ─── Monte Carlo (60s cadence + on new pool data + on capital change) ──────
  useEffect(() => {
    if (!lastUpdate || snapshotBtcPrice === 0) return
    setMcLoading(true)
    // Usar $1000 como capital de demo cuando el usuario no ha ingresado capital real
    const vizCapital = capitalUSD > 0 ? capitalUSD : 1000
    const id = setTimeout(() => {
      const newResults = engine.pools.map(pool => {
        const sigma = SIGMAS[pool.name] ?? 0.035
        const px    = pool.name === 'BNB/USDT'  ? (bnbPrice || 600)
                    : pool.name === 'USDC/USDT' ? 1.0
                    : snapshotBtcPrice
        const baseKelly = KELLY_BASE[pool.name] ?? 0.15
        const cap   = pool.kelly.usd > 0 ? pool.kelly.usd : vizCapital * baseKelly
        const lo    = pool.obRange.lowerTick
        const hi    = pool.obRange.upperTick
        const apr   = pool.aprPct
        return {
          d7:  runMonteCarlo(px, lo, hi, sigma, cap, apr, 7),
          d30: runMonteCarlo(px, lo, hi, sigma, cap, apr, 30),
          d90: runMonteCarlo(px, lo, hi, sigma, cap, apr, 90),
        }
      })
      setMcResults(newResults)
      setMcLoading(false)
    }, 0)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcTick, lastUpdate, capitalUSD])

  // ─── Engine (30s cadence via snapshotBtcPrice) ───────────────────────────
  const engine = useMemo(() => {
    const { regime, adx, bbWidth } = klines.length > 15
      ? detectBTCRegime(klines)
      : { regime: 'VOLATILE' as const, adx: 20, bbWidth: 0.05 }
    const price  = snapshotBtcPrice || 84_000
    const btcAtr = calcATR(klines)
    const pools: PoolResult[] = POOL_CONFIGS.map((cfg, i) => {
      const apiPool    = poolsData[i]
      const apiFailed  = !apiPool
      const aprPct     = apiPool ? apiPool.apr      : cfg.fallbackApr
      const feeTierDec = apiPool ? apiPool.feeTier  : cfg.fallbackFeeTier
      const tvlUSD     = apiPool ? apiPool.tvl      : cfg.fallbackTvl
      const feeTierDisplay = (feeTierDec * 100).toFixed(2) + '%'
      const kelly          = kellySize(capitalUSD, regime, cfg.name)
      const obRange        = calcPoolRange(cfg.name, price, bnbPrice, btcAtr)
      const poolPrice      = cfg.name === 'BNB/USDT' ? (bnbPrice || 600) : cfg.name === 'USDC/USDT' ? 1.0 : price
      const il    = projectIL(poolPrice, obRange.lowerTick, obRange.upperTick, aprPct, 30)
      const score = scorePool(regime, obRange.rangeWidthPct, il.netYieldPct, aprPct, tvlUSD)
      return { name: cfg.name, feeTierDisplay, poolUrl: cfg.url, aprPct, tvlUSD, apiFailed, obRange, kelly, il, score, signal: getSignal(score) }
    })
    const best = [...pools].sort((a, b) => b.score - a.score)[0]
    const summary = regime === 'TRENDING'
      ? `Régimen TRENDING detectado (ADX=${adx.toFixed(1)}, BB Width=${(bbWidth * 100).toFixed(1)}%). El mercado está en tendencia — los pools LP no son eficientes ahora. Capital sugerido: $0 en todos los pools.`
      : `Régimen ${regime} detectado (ADX=${adx.toFixed(1)}, BB Width=${(bbWidth * 100).toFixed(1)}%). El pool más eficiente es ${best?.name ?? '—'} con score ${best?.score ?? 0}/100. Asignación recomendada: ${usd(best?.kelly.usd ?? 0)} (${((best?.kelly.pct ?? 0) * 100).toFixed(0)}%) en ${best?.name ?? '—'}.`
    return { regime, adx, bbWidth, pools, summary }
  }, [klines, snapshotBtcPrice, bnbPrice, poolsData, capitalUSD])

  const tabChangers = useMemo(() =>
    ([0, 1, 2] as const).map(idx => (tab: '7D' | '30D' | '90D') =>
      setActiveTabs(prev => prev.map((t, i) => i === idx ? tab : t))
    ), [])

  const regimeColor = engine.regime === 'LATERAL' ? C.green : engine.regime === 'TRENDING' ? C.red : C.yellow

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100%' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* ── HEADER ── */}
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

        {/* ── TOP BAR ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.border, marginBottom: 24 }}>
          <BtcPriceTicker onPriceUpdate={handlePriceUpdate} />
          <TopCell label="RÉGIMEN BTC 4H">
            {loading ? <LoadPulse w={100} h={28} /> : <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, color: regimeColor }}>{engine.regime}</div>}
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.dimText, marginTop: 4 }}>
              ADX {engine.adx.toFixed(1)} · BB {(engine.bbWidth * 100).toFixed(1)}%
              {bnbPrice > 0 && <span style={{ marginLeft: 8 }}>BNB {usd(bnbPrice)}</span>}
            </div>
          </TopCell>

          <TopCell label="PORTAFOLIO">
            {capitalUSD > 0 ? (
              <>
                <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, color: C.gold, lineHeight: 1 }}>
                  {usd(capitalUSD)}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.dimText, marginTop: 4 }}>base Kelly · desde Terminal</div>
              </>
            ) : (
              <a href="/terminal" style={{ fontFamily: MONO, fontSize: 10, color: C.gold, textDecoration: 'none', letterSpacing: '0.06em', lineHeight: 1.5 }}>
                Ve al Terminal para registrar tu patrimonio →
              </a>
            )}
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

        {/* BUG 2 fix: warning banner above pool cards when no capital */}
        {capitalUSD === 0 && (
          <div style={{
            background: C.gold, color: '#1a1200',
            padding: '10px 16px', marginBottom: 16,
            fontFamily: MONO, fontSize: 11, fontWeight: 700,
            width: '100%', boxSizing: 'border-box', letterSpacing: '0.05em',
          }}>
            ⚠️ Ve al Terminal a registrar tu patrimonio para ver proyecciones reales en $
          </div>
        )}

        {/* ── POOL CARDS + ANALYTICS ── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="animate-pulse" style={{ background: C.surface, border: `1px solid ${C.border}`, height: 400 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
            {engine.pools.map((p, i) => (
              <div key={p.name} style={{ display: 'flex', flexDirection: 'column' }}>
                <PoolCard pool={p} />
                <PoolAnalyticsPanel
                  pool={p}
                  mcData={mcResults[i] ?? null}
                  mcLoading={mcLoading}
                  sigma={SIGMAS[p.name] ?? 0.035}
                  currentPrice={p.name === 'BNB/USDT' ? (bnbPrice || 600) : p.name === 'USDC/USDT' ? 1.0 : (snapshotBtcPrice || 84000)}
                  activeTab={activeTabs[i] ?? '30D'}
                  onTabChange={tabChangers[i]}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── RESUMEN EJECUTIVO ── */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 22px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.dimText, marginBottom: 14 }}>
            {'// RESUMEN EJECUTIVO'}
          </div>
          <p style={{ fontFamily: MONO, fontSize: 12, color: C.text, lineHeight: 1.9, margin: 0 }}>{engine.summary}</p>
        </div>

      </div>
    </div>
  )
}

// ─── Pool Card ────────────────────────────────────────────────────────────────
const PoolCard = memo(function PoolCard({ pool }: { pool: PoolResult }) {
  const { signal, score, il } = pool
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: `2px solid ${signal.color}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, color: C.text }}>{pool.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.dimText, marginTop: 2, letterSpacing: '0.1em' }}>
            FEE {pool.feeTierDisplay}
            {pool.apiFailed && <span style={{ color: C.yellow, marginLeft: 8 }}>FALLBACK</span>}
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: signal.color, background: signal.color + '18', border: `1px solid ${signal.color}44`, padding: '5px 12px' }}>
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
      <PRow label="RANGO" value={`${usd(pool.obRange.lowerTick)} → ${usd(pool.obRange.upperTick)}`} sub={`ancho: ${pool.obRange.rangeWidthPct.toFixed(1)}%`} />
      <PRow label="CAPITAL SUGERIDO" value={pool.kelly.usd > 0 ? usd(pool.kelly.usd) : '—'} sub={`${(pool.kelly.pct * 100).toFixed(0)}% portafolio`} valueColor={C.gold} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <Metric label="APR"    value={pct(pool.aprPct)}    color={C.green} />
        <Metric label="IL 30D" value={pct(il.ilPct, 2)}   color={il.ilPct > 5 ? C.red : C.yellow} />
        <Metric label="NET"    value={pct(il.netYieldPct)} color={il.netYieldPct >= 0 ? C.green : C.red} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <PRow label="BREAK-EVEN" value={il.breakEvenDays < 9999 ? `${il.breakEvenDays}d` : '—'} valueColor={il.breakEvenDays < 30 ? C.green : C.yellow} />
        {pool.tvlUSD > 0 && <PRow label="TVL" value={usd(pool.tvlUSD)} />}
      </div>
      <a href={pool.poolUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: C.gold, background: C.gold + '14', border: `1px solid ${C.gold}44`, padding: '8px', marginTop: 2 }}>
        Ver en PancakeSwap ↗
      </a>
    </div>
  )
})

// ─── Analytics Panel ─────────────────────────────────────────────────────────
const PoolAnalyticsPanel = memo(function PoolAnalyticsPanel({
  pool, mcData, mcLoading, sigma, currentPrice, activeTab, onTabChange,
}: {
  pool: PoolResult; mcData: PoolMCData | null; mcLoading: boolean
  sigma: number; currentPrice: number
  activeTab: '7D' | '30D' | '90D'; onTabChange: (t: '7D' | '30D' | '90D') => void
}) {
  const { obRange, aprPct, kelly, il } = pool
  const cap = kelly.usd

  const pIn7  = calcPInRange(currentPrice, obRange.lowerTick, obRange.upperTick, sigma, 7)
  const pIn30 = calcPInRange(currentPrice, obRange.lowerTick, obRange.upperTick, sigma, 30)
  const pIn90 = calcPInRange(currentPrice, obRange.lowerTick, obRange.upperTick, sigma, 90)
  const dailyFee = calcDailyFee(cap, aprPct, pIn30)
  const dailyIL  = calcDailyIL(sigma, obRange.rangeWidthPct)

  const periodData = mcData ? (activeTab === '7D' ? mcData.d7 : activeTab === '90D' ? mcData.d90 : mcData.d30) : null
  const periodDays = activeTab === '7D' ? 7 : activeTab === '90D' ? 90 : 30

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderTop: 'none', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ROW 1 — Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 3 }}>
        <AMetric label="Fee/día"      value={cap > 0 ? `$${dailyFee.toFixed(2)}` : '—'}   color={dailyFee > 0 ? C.green : C.dimText} />
        <AMetric label="IL/día"       value={`${dailyIL.toFixed(3)}%`}                    color={dailyIL > 0.1 ? C.red : C.yellow} />
        <AMetric label="Break-even"   value={il.breakEvenDays < 9999 ? `${il.breakEvenDays}d` : '—'} color={il.breakEvenDays < 30 ? C.green : C.yellow} />
        <AMetric label="P(rango) 7d"  value={`${pIn7.toFixed(0)}%`}  color={pIn7  > 60 ? C.green : pIn7  > 30 ? C.yellow : C.red} />
        <AMetric label="P(rango) 30d" value={`${pIn30.toFixed(0)}%`} color={pIn30 > 50 ? C.green : pIn30 > 25 ? C.yellow : C.red} />
        <AMetric label="P(rango) 90d" value={`${pIn90.toFixed(0)}%`} color={pIn90 > 40 ? C.green : pIn90 > 20 ? C.yellow : C.red} />
      </div>

      {/* ROW 2 — Period tabs */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {(['7D', '30D', '90D'] as const).map(tab => (
          <button key={tab} onClick={() => onTabChange(tab)} style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.15em',
            padding: '4px 10px', cursor: 'pointer', border: '1px solid',
            background: activeTab === tab ? C.gold : 'transparent',
            borderColor: activeTab === tab ? C.gold : C.border,
            color: activeTab === tab ? C.bg : C.dimText,
          }}>{tab}</button>
        ))}
        <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginLeft: 6, letterSpacing: '0.1em' }}>
          Monte Carlo · 500 sims
        </span>
      </div>

      {/* Loading */}
      {(mcLoading || !mcData) ? (
        <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: '0.15em' }}>
            {mcLoading ? 'CALCULANDO SIMULACIONES…' : 'ESPERANDO DATOS DE POOL…'}
          </span>
        </div>
      ) : periodData && (
        <>
          {/* ROW 3 — MC chart */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.2em', color: C.dimText, marginBottom: 4 }}>
              {`MONTE CARLO — 500 SIMULACIONES · ${activeTab}`}
            </div>
            <div style={{ border: `1px solid ${C.border}`, background: C.surface }}>
              <MCPathsChart result={periodData} days={periodDays} />
            </div>
          </div>

          {/* ROW 4 — Scenario comparison */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6 }}>ESCENARIOS COMPARADOS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
              {(['7D', '30D', '90D'] as const).map(period => {
                const d     = period === '7D' ? mcData.d7 : period === '30D' ? mcData.d30 : mcData.d90
                const pDays = period === '7D' ? 7 : period === '30D' ? 30 : 90
                const totalFee = cap * (aprPct / 100 / 365) * pDays * (d.pctInRange / 100)
                return (
                  <div key={period} style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: `2px solid ${period === activeTab ? C.gold : 'transparent'}`, padding: '8px 10px' }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: C.gold, letterSpacing: '0.2em', marginBottom: 6 }}>{period}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <SRow label="P95"       value={`$${d.p95.toFixed(0)}`}        color={d.p95 >= 0 ? C.green : C.red} />
                      <SRow label="P50"       value={`$${d.p50.toFixed(0)}`}        color={d.p50 >= 0 ? C.green : C.red} />
                      <SRow label="P5"        value={`$${d.p5.toFixed(0)}`}         color={d.p5  >= 0 ? C.green : C.red} />
                      <SRow label="P(rango)"  value={`${d.pctInRange.toFixed(0)}%`} color={d.pctInRange > 50 ? C.green : C.yellow} />
                      <SRow label="Fee total" value={`$${totalFee.toFixed(0)}`}     color={C.gold} />
                      <SRow label="IL máx"    value={`${il.ilPct.toFixed(1)}%`}     color={il.ilPct > 5 ? C.red : C.yellow} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ROW 5 — P&L accumulation */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.2em', color: C.dimText, marginBottom: 4 }}>
              P&L ACUMULADO ESPERADO (P50)
            </div>
            <div style={{ border: `1px solid ${C.border}`, background: C.surface }}>
              <PnLCurveChart result={periodData} days={periodDays} />
            </div>
          </div>
        </>
      )}
    </div>
  )
})

// ─── SVG Charts ───────────────────────────────────────────────────────────────
// Floor ±50 en bounds previene colapso de rango cuando todas las trayectorias convergen
function MCPathsChart({ result, days }: { result: MCResult; days: number }) {
  const { paths, p5, p50, p95 } = result
  if (!paths.length) return null
  const W = 500, H = 120, PR = 36

  const allValues = paths.flat()
  const rawMin = Math.min(...allValues, -50)
  const rawMax = Math.max(...allValues, 50)
  const pad  = (rawMax - rawMin) * 0.08
  const yMin = rawMin - pad
  const yMax = rawMax + pad

  const toX    = (d: number) => (d / Math.max(days - 1, 1)) * (W - PR)
  const toY    = (v: number) => { const r = yMax - yMin; return r === 0 ? H / 2 : H - ((v - yMin) / r) * H }
  const clampY = (y: number) => Math.max(-4, Math.min(H + 4, y))

  const medianPath = paths.reduce((best, path) => {
    const last = path[path.length - 1] ?? 0
    const bestLast = best[best.length - 1] ?? 0
    return Math.abs(last - p50) < Math.abs(bestLast - p50) ? path : best
  }, paths[0])

  const bands = [
    { val: p95, label: 'P95', color: '#22c55e' },
    { val: p50, label: 'P50', color: C.gold },
    { val: p5,  label: 'P5',  color: '#f87171' },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="120" preserveAspectRatio="none" style={{ display: 'block' }}>
      {bands.map(({ val, label, color }) => {
        const y = clampY(toY(val))
        return (
          <g key={label}>
            <line x1={0} y1={y} x2={W - PR} y2={y} stroke={color} strokeWidth={0.5} strokeDasharray="3,3" opacity={0.5} />
            <text x={W - PR + 3} y={y + 3} fontSize={8} fill={color} fontFamily="monospace">{label}</text>
          </g>
        )
      })}
      <line x1={0} y1={clampY(toY(0))} x2={W - PR} y2={clampY(toY(0))} stroke="#ffffff20" strokeWidth={1} strokeDasharray="4,4" />
      {paths.map((path, i) => {
        if (path === medianPath) return null
        const finalVal = path[path.length - 1] ?? 0
        const color = finalVal > 0 ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'
        const pts = path.map((v, d) => `${toX(d).toFixed(1)},${clampY(toY(v)).toFixed(1)}`).join(' ')
        return <polyline key={i} points={pts} fill="none" stroke={color} strokeWidth={0.7} />
      })}
      <polyline
        points={medianPath.map((v, d) => `${toX(d).toFixed(1)},${clampY(toY(v)).toFixed(1)}`).join(' ')}
        fill="none" stroke={C.gold} strokeWidth={2}
      />
    </svg>
  )
}

function PnLCurveChart({ result, days }: { result: MCResult; days: number }) {
  const { paths, p50 } = result
  if (!paths.length) return null
  const W = 500, H = 80

  const medianPath = paths.reduce((best, path) => {
    const last = path[path.length - 1] ?? 0
    const bestLast = best[best.length - 1] ?? 0
    return Math.abs(last - p50) < Math.abs(bestLast - p50) ? path : best
  }, paths[0])

  const vals = [...medianPath, 0]
  const rawMin = Math.min(...vals, -50)
  const rawMax = Math.max(...vals, 50)
  const rng = Math.max(rawMax - rawMin, 1)
  const pad = rng * 0.1
  const yMin = rawMin - pad, yMax = rawMax + pad

  const toX = (d: number) => (d / Math.max(days - 1, 1)) * W
  const toY = (v: number) => { const r = yMax - yMin; return r === 0 ? H / 2 : H - ((v - yMin) / r) * H }

  const zeroY = Math.max(0, Math.min(H, toY(0)))
  const pts = medianPath.map((v, d) => `${toX(d).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="80" preserveAspectRatio="none" style={{ display: 'block' }}>
      <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="#333" strokeWidth={0.5} strokeDasharray="4,4" />
      <polyline points={pts} fill="none" stroke={C.gold} strokeWidth={2} />
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TopCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, padding: '16px 18px' }}>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 6 }}>{label}</div>
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

function AMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '5px 6px', textAlign: 'center' }}>
      <div style={{ fontFamily: MONO, fontSize: 7, color: C.muted, letterSpacing: '0.1em', marginBottom: 2, textTransform: 'uppercase', lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function SRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontFamily: MONO, fontSize: 8, color: C.dimText, letterSpacing: '0.1em' }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 10, color }}>{value}</span>
    </div>
  )
}

function LoadPulse({ w, h }: { w: number; h: number }) {
  return <div className="animate-pulse" style={{ width: w, height: h, background: C.border, borderRadius: 2 }} />
}
