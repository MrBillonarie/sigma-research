import { NextResponse } from 'next/server'

export const revalidate = 14400 // 4 horas

interface DlPool {
  project: string
  symbol: string
  chain: string
  apy: number | null
  tvlUsd: number | null
}

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
}

// Mapea cada liveKey a sus selectores en DeFi Llama
const POOL_SELECTORS: Record<string, { project: string; tokens: string[]; chain?: string }> = {
  'staking:eth':        { project: 'lido',               tokens: ['STETH'],         chain: 'Ethereum' },
  'staking:sol':        { project: 'marinade-finance',   tokens: ['SOL']                               },
  'staking:cake':       { project: 'pancakeswap',        tokens: ['CAKE'],          chain: 'BSC'       },
  'defi:aave:usdc':     { project: 'aave-v3',            tokens: ['USDC']                              },
  'defi:venus:bnb':     { project: 'venus',              tokens: ['BNB'],           chain: 'BSC'       },
  'defi:compound:usdt': { project: 'compound-v3',        tokens: ['USDT']                              },
  'defi:beefy:bnb':     { project: 'beefy',              tokens: ['BNB'],           chain: 'BSC'       },
  'defi:yearn:usdc':    { project: 'yearn-finance',      tokens: ['USDC']                              },
  'lp:bnb-usdt:pcake':  { project: 'pancakeswap-amm-v3', tokens: ['BNB', 'USDT'],  chain: 'BSC'       },
  'lp:eth-usdc:uni':    { project: 'uniswap-v3',         tokens: ['ETH', 'USDC'],  chain: 'Ethereum'  },
  'lp:usdt-usdc:pcake': { project: 'pancakeswap-amm-v3', tokens: ['USDT', 'USDC'], chain: 'BSC'       },
  'lp:wbtc-eth:uni':    { project: 'uniswap-v3',         tokens: ['WBTC', 'ETH'],  chain: 'Ethereum'  },
  'div:gmx':            { project: 'gmx',                tokens: ['GMX']                               },
  'div:velo':           { project: 'velodrome-v2',       tokens: ['VELO']                              },
}

function pickBestPool(pools: DlPool[], key: string): number | null {
  const sel = POOL_SELECTORS[key]
  if (!sel) return null
  const matches = pools.filter(p => {
    const sym = p.symbol.toUpperCase()
    const matchTokens = sel.tokens.every(t => sym.includes(t.toUpperCase()))
    const matchChain = sel.chain ? p.chain.toLowerCase() === sel.chain.toLowerCase() : true
    const validApy = p.apy != null && p.apy > 0 && p.apy < 300
    return p.project === sel.project && matchTokens && matchChain && validApy
  })
  if (!matches.length) return null
  matches.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))
  return +(matches[0].apy!).toFixed(2)
}

async function fetchDlPools(): Promise<DlPool[]> {
  const res = await fetch('https://yields.llama.fi/pools', {
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`DeFi Llama error: ${res.status}`)
  const json = await res.json()
  return (json.data ?? []) as DlPool[]
}

async function fetchDividendYield(ticker: string): Promise<number | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail`
    const res = await fetch(url, {
      headers: YAHOO_HEADERS,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const raw = json?.quoteSummary?.result?.[0]?.summaryDetail?.dividendYield?.raw
    if (raw == null) return null
    return +(raw * 100).toFixed(2)
  } catch {
    return null
  }
}

export async function GET() {
  const [dlResult, vymResult, schdResult] = await Promise.allSettled([
    fetchDlPools(),
    fetchDividendYield('VYM'),
    fetchDividendYield('SCHD'),
  ])

  const pools = dlResult.status === 'fulfilled' ? dlResult.value : []

  const rates: Record<string, number | null> = {}
  for (const key of Object.keys(POOL_SELECTORS)) {
    rates[key] = pickBestPool(pools, key)
  }
  rates['tradfi:vym']  = vymResult.status  === 'fulfilled' ? vymResult.value  : null
  rates['tradfi:schd'] = schdResult.status === 'fulfilled' ? schdResult.value : null

  return NextResponse.json({
    ok: true,
    rates,
    fetchedAt: new Date().toISOString(),
    dlOk: dlResult.status === 'fulfilled',
  })
}
