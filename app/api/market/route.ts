export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

type Ticker = { price: number; change24h: number; marketOpen: boolean }

// ─── Yahoo Finance ────────────────────────────────────────────────────────────
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
}

async function fetchYahoo(symbol: string): Promise<Ticker | null> {
  try {
    // Try v8 endpoint first
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=false`
    const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 0 } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const meta = json?.chart?.result?.[0]?.meta
    if (!meta?.regularMarketPrice) return null

    const price     = meta.regularMarketPrice as number
    const prevClose = (meta.chartPreviousClose ?? meta.previousClose ?? price) as number
    const change24h = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0
    const marketOpen = meta.marketState === 'REGULAR'

    return { price, change24h, marketOpen }
  } catch {
    return null
  }
}

// ─── Stooq fallback (no auth required) ───────────────────────────────────────
async function fetchStooq(symbol: string): Promise<Ticker | null> {
  try {
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return null
    const text = await res.text()
    const lines = text.trim().split('\n')
    if (lines.length < 2) return null
    const cols   = lines[1].split(',')
    const open   = parseFloat(cols[3])
    const close  = parseFloat(cols[6])
    if (!close || isNaN(close) || close <= 0) return null
    const change24h = open > 0 ? ((close - open) / open) * 100 : 0
    // Stooq doesn't expose market state reliably — mark closed outside NYSE hours
    const utcH = new Date().getUTCHours()
    const marketOpen = utcH >= 13 && utcH < 21   // NYSE: 09:30–16:00 ET ≈ 13:30–20:00 UTC
    return { price: close, change24h, marketOpen }
  } catch {
    return null
  }
}

// ─── SPX: Yahoo first, Stooq fallback ────────────────────────────────────────
async function fetchSPX(): Promise<Ticker | null> {
  const yahoo = await fetchYahoo('^GSPC')
  if (yahoo) return yahoo
  return await fetchStooq('^spx')
}

// ─── XAU: spot XAUUSD from Yahoo, Stooq fallback ────────────────────────────
async function fetchXAU(): Promise<Ticker | null> {
  const yahoo = await fetchYahoo('XAUUSD=X')   // spot gold forex pair
  if (yahoo) return yahoo
  return await fetchStooq('xauusd')
}

export async function GET() {
  const [spx, xau] = await Promise.all([fetchSPX(), fetchXAU()])
  return NextResponse.json(
    { spx, xau },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
