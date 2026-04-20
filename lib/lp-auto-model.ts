import { fetchPoolData, calcRealAPR, type PoolData } from './pancakeswap'
import { getBtcPrice } from './binance-rest'
import { detectRegime, type RegimeResult } from './regime-detector'

export interface AutoModelResult {
  shouldSignal:  boolean
  hyp:           'ranging' | 'compression' | 'none'
  hypText:       string
  pool:          string
  feeTier:       number
  refPrice:      number
  rangeLowPct:   number
  rangeHighPct:  number
  tickLower:     number
  tickUpper:     number
  kellyPct:      number
  volDailyM:     number
  daysProjected: number
  aprEstimated:  number
  regimeScore:   number
  atr24hPct:     number
  rawPoolData:   PoolData
  regime:        RegimeResult
}

export async function runAutoModel(): Promise<AutoModelResult> {
  // 1. Precio BTC y régimen en paralelo con datos de pools
  const [btcPrice, [poolBTC, poolBNB]] = await Promise.all([
    getBtcPrice(),
    Promise.all([fetchPoolData('BTCB_USDT'), fetchPoolData('BNB_USDC')]),
  ])

  // 2. Régimen (necesita btcPrice ya resuelto)
  const regime = await detectRegime(btcPrice)

  // 3. Elegir pool con mayor volumen 24h
  const selectedPool =
    poolBTC && poolBNB
      ? poolBTC.volumeUSD_24h >= poolBNB.volumeUSD_24h
        ? poolBTC
        : poolBNB
      : poolBTC ?? poolBNB

  if (!selectedPool) {
    return {
      shouldSignal: false,
      hyp: 'none',
      hypText: 'Error obteniendo datos de PancakeSwap / DexScreener.',
      pool: 'N/A',
      feeTier: 0.0005,
      refPrice: btcPrice,
      rangeLowPct: 0, rangeHighPct: 0,
      tickLower: 0, tickUpper: 0,
      kellyPct: 0, volDailyM: 0, daysProjected: 0,
      aprEstimated: 0, regimeScore: 0, atr24hPct: 0,
      rawPoolData: null as unknown as PoolData,
      regime,
    }
  }

  // 4. Rango óptimo según régimen (basado en ATR 24h)
  const atr = regime.atr24hPct
  let rangeLowPct:   number
  let rangeHighPct:  number
  let kellyPct:      number
  let daysProjected: number

  if (regime.regime === 'ranging') {
    rangeLowPct   = Math.max(3, Math.min(10, atr * 2.0))
    rangeHighPct  = Math.max(3, Math.min(10, atr * 2.5))
    kellyPct      = Math.min(20, 8 + (regime.score - 65) * 0.4)
    daysProjected = 14
  } else {
    // compression — rango más amplio para sobrevivir impulso
    rangeLowPct   = Math.max(5, atr * 3.0)
    rangeHighPct  = Math.max(5, atr * 3.0)
    kellyPct      = 5
    daysProjected = 7
  }

  const tickLower = btcPrice * (1 - rangeLowPct / 100)
  const tickUpper = btcPrice * (1 + rangeHighPct / 100)

  // 5. APR real del pool
  const aprEstimated = calcRealAPR(selectedPool, 1000)

  // 6. Decisión: señalar solo si régimen favorable + APR > 15% + TVL > $500k
  const shouldSignal =
    (regime.regime === 'ranging' || regime.regime === 'compression') &&
    aprEstimated > 15 &&
    selectedPool.tvlUSD > 500_000

  const tvlM  = (selectedPool.tvlUSD / 1e6).toFixed(1)
  const volM  = (selectedPool.volumeUSD_24h / 1e6).toFixed(1)

  const hypText =
    regime.regime === 'ranging'
      ? `${regime.description} Pool ${selectedPool.label}: TVL $${tvlM}M, Vol 24h $${volM}M. APR estimado ${aprEstimated.toFixed(0)}%.`
      : `${regime.description} Señal en modo espera. APR pool: ${aprEstimated.toFixed(0)}%.`

  return {
    shouldSignal,
    hyp: regime.regime === 'trending' ? 'none' : regime.regime,
    hypText,
    pool: selectedPool.label,
    feeTier: selectedPool.feeTier,
    refPrice: btcPrice,
    rangeLowPct,
    rangeHighPct,
    tickLower,
    tickUpper,
    kellyPct,
    volDailyM:    selectedPool.volumeUSD_24h / 1e6,
    daysProjected,
    aprEstimated,
    regimeScore:  regime.score,
    atr24hPct:    regime.atr24hPct,
    rawPoolData:  selectedPool,
    regime,
  }
}
