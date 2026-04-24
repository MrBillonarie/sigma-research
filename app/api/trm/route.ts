export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
}

async function fetchYahoo(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/USDCLP=X?range=1d&interval=5m&includePrePost=false',
      { headers: YAHOO_HEADERS, next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice as number
    return price > 100 ? price : null
  } catch {
    return null
  }
}

async function fetchStooq(): Promise<number | null> {
  try {
    const res = await fetch('https://stooq.com/q/l/?s=usdclp&f=sd2t2ohlcv&h&e=csv', { next: { revalidate: 0 } })
    if (!res.ok) return null
    const lines = (await res.text()).trim().split('\n')
    if (lines.length < 2) return null
    const close = parseFloat(lines[1].split(',')[6])
    return close > 100 ? close : null
  } catch {
    return null
  }
}

export async function GET() {
  const rate = await fetchYahoo() ?? await fetchStooq()
  if (!rate) return NextResponse.json({ error: 'unavailable' }, { status: 502 })
  return NextResponse.json(
    { clpPerUsd: Math.round(rate) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
