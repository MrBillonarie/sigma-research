export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

// Klines históricos para símbolos sin par en Binance (acciones M3 + commodities).
// Fuente: Yahoo Finance chart API, server-side (CORS bloquea el fetch directo
// desde el cliente). Whitelist cerrada para no exponer un proxy abierto.
const YAHOO_SYM: Record<string, string> = {
  AAPL: 'AAPL', NVDA: 'NVDA', TSLA: 'TSLA', JPM: 'JPM', XOM: 'XOM',
  XAU: 'GC=F',   // futuros oro COMEX — XAUUSD=X es poco confiable en Yahoo
  XAG: 'SI=F',   // futuros plata COMEX
  WTI: 'CL=F',   // futuros crudo NYMEX
  NG:  'NG=F',   // futuros gas natural NYMEX
  HG:  'HG=F',   // futuros cobre COMEX
  PL:  'PL=F',   // futuros platino NYMEX
  SPX: '^GSPC',  // S&P 500 index — referencia del M3 en el RightBar
  SPY: 'SPY', QQQ: 'QQQ', IWM: 'IWM', XLE: 'XLE', // ETFs del M4 — Índices
}

// tf de la UI → (interval, range) de Yahoo. Yahoo no tiene 4h: se agregan velas 1h.
const TF_CFG: Record<string, { interval: string; range: string; group?: number }> = {
  '15m': { interval: '15m', range: '5d'  },
  '1h':  { interval: '60m', range: '1mo' },
  '4h':  { interval: '60m', range: '3mo', group: 4 },
  '1d':  { interval: '1d',  range: '1y'  },
}

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
}

interface KlinesPayload {
  klines: { time: number; value: number }[]
  price: number | null
  change24h: number | null
  volume24h: number | null
}

const _cache = new Map<string, { at: number; data: KlinesPayload }>()
const CACHE_TTL_MS = 60 * 1000

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') ?? '').toUpperCase()
  const tf     = req.nextUrl.searchParams.get('tf') ?? '4h'

  const ySym = YAHOO_SYM[symbol]
  const cfg  = TF_CFG[tf]
  if (!ySym || !cfg) {
    return NextResponse.json({ error: 'Símbolo o timeframe no soportado.' }, { status: 400 })
  }

  const key = `${symbol}:${tf}`
  const hit = _cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.data, { headers: { 'Cache-Control': 'public, max-age=60' } })
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=${cfg.interval}&range=${cfg.range}&includePrePost=false`
    const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`Yahoo ${res.status}`)
    const json   = await res.json()
    const result = json?.chart?.result?.[0]
    const ts: number[]            = result?.timestamp ?? []
    const closes: (number|null)[] = result?.indicators?.quote?.[0]?.close ?? []
    const meta = result?.meta ?? {}

    let klines = ts
      .map((t, i) => ({ time: t, value: closes[i] }))
      .filter((k): k is { time: number; value: number } => k.value != null)

    if (cfg.group) {
      const grouped: { time: number; value: number }[] = []
      for (let i = 0; i < klines.length; i += cfg.group) {
        const chunk = klines.slice(i, i + cfg.group)
        grouped.push({ time: chunk[0].time, value: chunk[chunk.length - 1].value })
      }
      klines = grouped
    }
    klines = klines.slice(-150)

    const price     = (meta.regularMarketPrice ?? klines[klines.length - 1]?.value ?? null) as number | null
    const prevClose = (meta.chartPreviousClose ?? meta.previousClose ?? null) as number | null
    const change24h = price != null && prevClose ? ((price - prevClose) / prevClose) * 100 : null

    const data: KlinesPayload = { klines, price, change24h, volume24h: null }
    if (klines.length > 0) _cache.set(key, { at: Date.now(), data })

    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=60' } })
  } catch {
    return NextResponse.json({ klines: [], price: null, change24h: null, volume24h: null }, { status: 503 })
  }
}
