export const revalidate = 300  // C: cache 5 min — antes era 0 (sin cache)

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { processAsset, computeFlowSignals, computeFlowScore } from '@/lib/signalEngine'
import { computeAllocation, computeMetrics }                  from '@/lib/allocator'
import type { ProfileType, Profile, SignalsResponse }          from '@/types/decision-engine'

// ─── Perfiles ─────────────────────────────────────────────────────────────────
const PROFILES: Record<ProfileType, Profile> = {
  retail: {
    type: 'retail', label: 'Retail',
    maxCrypto: 5, maxEquity: 70, minFixedIncome: 20,
    riskTolerance: 35, benchmarkReturn: 6,
    description: 'Perfil conservador con énfasis en preservación del capital.',
    horizonte: 'largo plazo (3-5 años)',
  },
  trader: {
    type: 'trader', label: 'Trader Activo',
    maxCrypto: 30, maxEquity: 90, minFixedIncome: 5,
    riskTolerance: 75, benchmarkReturn: 15,
    description: 'Perfil agresivo con tolerancia a alta volatilidad y rotación activa.',
    horizonte: 'corto-medio plazo (3-12 meses)',
  },
  institucional: {
    type: 'institucional', label: 'Institucional',
    maxCrypto: 10, maxEquity: 60, minFixedIncome: 30,
    riskTolerance: 50, benchmarkReturn: 8,
    description: 'Perfil equilibrado con enfoque en rentabilidad ajustada al riesgo.',
    horizonte: 'medio plazo (1-3 años)',
  },
}

// ─── A: Crypto con datos reales de Binance ────────────────────────────────────
const CRYPTO_TICKERS = [
  { id: 'btc', name: 'Bitcoin',  ticker: 'BTC', symbol: 'BTCUSDT' },
  { id: 'eth', name: 'Ethereum', ticker: 'ETH', symbol: 'ETHUSDT' },
  { id: 'sol', name: 'Solana',   ticker: 'SOL', symbol: 'SOLUSDT' },
  { id: 'bnb', name: 'BNB',      ticker: 'BNB', symbol: 'BNBUSDT' },
]

async function fetchBinanceReturns(symbol: string): Promise<{ r1m: number; r3m: number; r1y: number }> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=365`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return { r1m: 0, r3m: 0, r1y: 0 }
    const data: [number, string, string, string, string, ...unknown[]][] = await res.json()
    if (data.length < 30) return { r1m: 0, r3m: 0, r1y: 0 }
    const closes = data.map(k => parseFloat(k[4]))
    const cur = closes[closes.length - 1]
    const p30  = closes[Math.max(0, closes.length - 30)]
    const p90  = closes[Math.max(0, closes.length - 90)]
    const p365 = closes[0]
    return {
      r1m: p30  > 0 ? ((cur - p30)  / p30)  * 100 : 0,
      r3m: p90  > 0 ? ((cur - p90)  / p90)  * 100 : 0,
      r1y: p365 > 0 ? ((cur - p365) / p365) * 100 : 0,
    }
  } catch {
    return { r1m: 0, r3m: 0, r1y: 0 }
  }
}

// ─── B: Renta fija con datos reales de Yahoo Finance ─────────────────────────
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
}

async function fetchYahooReturns(ticker: string): Promise<{ r1m: number; r3m: number; r1y: number }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1y&interval=1d`
    const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 300 } })
    if (!res.ok) return { r1m: 0, r3m: 0, r1y: 0 }
    const json = await res.json()
    const raw: (number | null)[] = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
    const closes = raw.filter((c): c is number => c != null && !isNaN(c))
    if (closes.length < 30) return { r1m: 0, r3m: 0, r1y: 0 }
    const cur  = closes[closes.length - 1]
    const p30  = closes[Math.max(0, closes.length - 22)]   // ~1 mes bursátil
    const p90  = closes[Math.max(0, closes.length - 63)]   // ~3 meses bursátiles
    const p365 = closes[0]
    return {
      r1m: p30  > 0 ? ((cur - p30)  / p30)  * 100 : 0,
      r3m: p90  > 0 ? ((cur - p90)  / p90)  * 100 : 0,
      r1y: p365 > 0 ? ((cur - p365) / p365) * 100 : 0,
    }
  } catch {
    return { r1m: 0, r3m: 0, r1y: 0 }
  }
}

// Instrumentos de renta fija: TLT + LQD vía Yahoo; BTP y PDBC con fallback estático
const RF_BASE = [
  { id: 'tbond-10y', name: 'T-Bond USA 10 años',   ticker: 'TLT',  yahooTicker: 'TLT',  r1m: 0.8,  r3m: -1.4, r1y: 4.4 },
  { id: 'corp-ig',   name: 'Corporativo IG Global', ticker: 'LQD',  yahooTicker: 'LQD',  r1m: 0.5,  r3m:  1.6, r1y: 6.1 },
  { id: 'btp-5y',    name: 'BTP Chile 5 años',      ticker: 'BTP5', yahooTicker: null,   r1m: 0.4,  r3m:  1.2, r1y: 5.2 },
  { id: 'bcch-pdr',  name: 'Pagaré BCCh 90d',       ticker: 'PDBC', yahooTicker: null,   r1m: 0.38, r3m:  1.1, r1y: 4.6 },
]

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const profileType = (searchParams.get('profile') ?? 'retail') as ProfileType
  const profile     = PROFILES[profileType] ?? PROFILES.retail

  const db = sb()

  // Fondos, ETFs, crypto y RF en paralelo
  const [fondosRes, etfsRes, ...cryptoResults] = await Promise.all([
    db.from('fondos_mutuos')
      .select('id, nombre, categoria, rent_1m, rent_3m, rent_12m')
      .eq('activo', true)
      .not('rent_12m', 'is', null)
      .order('rent_12m', { ascending: false })
      .limit(80),
    db.from('etfs')
      .select('ticker, nombre, exposicion, sector, rent_1m, rent_3m, rent_12m')
      .not('rent_12m', 'is', null)
      .order('rent_12m', { ascending: false })
      .limit(40),
    // A: fetch crypto returns live from Binance
    ...CRYPTO_TICKERS.map(c => fetchBinanceReturns(c.symbol)),
  ])

  // B: fetch RF returns live from Yahoo (only for those with yahooTicker)
  const rfReturns = await Promise.all(
    RF_BASE.map(r => r.yahooTicker ? fetchYahooReturns(r.yahooTicker) : Promise.resolve(null))
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFondos = (fondosRes.data ?? []).map((f: any) => ({
    id: f.id, name: f.nombre, assetClass: 'fondos' as const,
    category: f.categoria ?? 'General',
    r1m: Number(f.rent_1m  ?? 0),
    r3m: Number(f.rent_3m  ?? 0),
    r1y: Number(f.rent_12m ?? 0),
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawEtfs = (etfsRes.data ?? []).map((e: any) => ({
    id: e.ticker, name: e.nombre, ticker: e.ticker, assetClass: 'etfs' as const,
    category: e.exposicion ?? e.sector ?? 'Global',
    r1m: Number(e.rent_1m  ?? 0),
    r3m: Number(e.rent_3m  ?? 0),
    r1y: Number(e.rent_12m ?? 0),
  }))

  // Merge Binance live data into crypto (fallback to 0 if fetch failed)
  const rawCrypto = CRYPTO_TICKERS.map((c, i) => {
    const live = cryptoResults[i] as { r1m: number; r3m: number; r1y: number }
    const hasLive = live.r1m !== 0 || live.r3m !== 0 || live.r1y !== 0
    return {
      id: c.id, name: c.name, ticker: c.ticker, assetClass: 'crypto' as const,
      r1m: hasLive ? live.r1m : 0,
      r3m: hasLive ? live.r3m : 0,
      r1y: hasLive ? live.r1y : 0,
    }
  })

  // Merge Yahoo live data into RF (use live if available, else fallback)
  const rawRF = RF_BASE.map((r, i) => {
    const live = rfReturns[i]
    const hasLive = live && (live.r1m !== 0 || live.r3m !== 0 || live.r1y !== 0)
    return {
      id: r.id, name: r.name, ticker: r.ticker, assetClass: 'renta_fija' as const,
      r1m: hasLive ? live!.r1m : r.r1m,
      r3m: hasLive ? live!.r3m : r.r3m,
      r1y: hasLive ? live!.r1y : r.r1y,
    }
  })

  const allAssets = [...rawFondos, ...rawEtfs, ...rawCrypto, ...rawRF].map(processAsset)

  const allocation  = computeAllocation(allAssets, profile)
  const metrics     = computeMetrics(allocation, allAssets)
  const flowSignals = computeFlowSignals(allAssets)
  const flowScore   = computeFlowScore(allAssets)

  const body: SignalsResponse = {
    ok: true, profile, signals: allAssets,
    allocation, metrics, flowSignals, flowScore,
    totalAssets: allAssets.length,
    buyCount:    allAssets.filter(a => a.signal === 'comprar').length,
    sellCount:   allAssets.filter(a => a.signal === 'reducir').length,
    holdCount:   allAssets.filter(a => a.signal === 'mantener' || a.signal === 'neutral').length,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(body)
}
