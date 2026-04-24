const DEXSCREENER = 'https://api.dexscreener.com/latest/dex/pairs/bsc'

export const POOLS = {
  BTCB_USDT: {
    id: '0x46cf1cf8c69595804ba91dfdd8d6b960c9b0a7c4',
    token0: 'BTCB',
    token1: 'USDT',
    feeTier: 0.0005,
    binanceSymbol: 'BTCUSDT',
    label: 'BTCB/USDT',
  },
  BNB_USDC: {
    id: '0xf2688fb5b81049dfb7703ada5e770543770612c4',
    token0: 'WBNB',
    token1: 'USDC',
    feeTier: 0.0005,
    binanceSymbol: 'BNBUSDT',
    label: 'BNB/USDC',
  },
} as const

export type PoolKey = keyof typeof POOLS

export interface PoolData {
  id: string
  label: string
  feeTier: number
  currentPrice: number
  volumeUSD_24h: number
  feesUSD_24h: number
  tvlUSD: number
  priceHigh_7d: number
  priceLow_7d: number
  volumeAvg_7d: number
}

export async function fetchPoolData(poolKey: PoolKey): Promise<PoolData | null> {
  const cfg = POOLS[poolKey]
  try {
    const [dexRes, klinesRes] = await Promise.all([
      fetch(`${DEXSCREENER}/${cfg.id}`, { cache: 'no-store' }),
      fetch(
        `https://api.binance.com/api/v3/klines?symbol=${cfg.binanceSymbol}&interval=1d&limit=7`,
        { cache: 'no-store' }
      ),
    ])

    const dexData = await dexRes.json()
    console.log(`[pancakeswap] dexscreener raw (${poolKey}):`, JSON.stringify(dexData).slice(0, 400))
    const pair = dexData?.pairs?.[0]
    if (!pair) {
      console.warn(`[pancakeswap] no pair found for ${poolKey} (id: ${cfg.id})`)
      return null
    }

    const klinesRaw = await klinesRes.json()
    console.log(`[pancakeswap] binance klines raw (${poolKey}):`, JSON.stringify(klinesRaw).slice(0, 200))

    // Binance may return an error object instead of an array (rate limit, bad symbol, etc.)
    const klines: string[][] = Array.isArray(klinesRaw) ? klinesRaw : []
    const highs = klines.length ? klines.map((k) => parseFloat(k[2])) : [0]
    const lows  = klines.length ? klines.map((k) => parseFloat(k[3])) : [0]
    // Approximate USD volume: close price * base qty
    const vols  = klines.length ? klines.map((k) => parseFloat(k[4]) * parseFloat(k[5])) : [0]

    const volumeUSD_24h: number = Number(pair.volume?.h24 ?? 0)

    return {
      id:             cfg.id,
      label:          cfg.label,
      feeTier:        cfg.feeTier,
      currentPrice:   parseFloat(pair.priceUsd),
      volumeUSD_24h,
      feesUSD_24h:    volumeUSD_24h * cfg.feeTier,
      tvlUSD:         Number(pair.liquidity?.usd ?? 0),
      priceHigh_7d:   Math.max(...highs),
      priceLow_7d:    Math.min(...lows),
      volumeAvg_7d:   vols.reduce((s, v) => s + v, 0) / Math.max(vols.length, 1),
    }
  } catch (e) {
    console.error(`[pancakeswap] fetchPoolData(${poolKey}) error:`, e)
    return null
  }
}

// APR real de un pool de liquidez concentrada dado el capital a depositar
export function calcRealAPR(pool: PoolData, capital: number): number {
  // Eficiencia del rango ±8% (rango base para la estimación)
  const sqrtR      = Math.sqrt((pool.currentPrice * 1.08) / (pool.currentPrice * 0.92))
  const efficiency = sqrtR / (sqrtR - 1)
  const liqShare   = capital / Math.max(pool.tvlUSD, capital)
  const feesPerYear = pool.feesUSD_24h * 365 * liqShare * efficiency
  return (feesPerYear / capital) * 100
}
