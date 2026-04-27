export const revalidate = 0   // siempre fresco: mide outcomes en cada llamada

import { NextResponse }   from 'next/server'
import { createClient }   from '@supabase/supabase-js'

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept':     'application/json',
}

const CRYPTO_SYMBOL: Record<string, string> = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
}

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// ─── Precios actuales en batch (Yahoo Finance) ────────────────────────────────
async function fetchCurrentPrices(tickers: string[]): Promise<Map<string, number>> {
  if (!tickers.length) return new Map()
  try {
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${tickers.join(',')}`
    const res = await fetch(url, { headers: YAHOO_HEADERS })
    if (!res.ok) return new Map()
    const json   = await res.json()
    const result = new Map<string, number>()
    for (const q of json?.quoteResponse?.result ?? []) {
      const p = q.regularMarketPrice as number
      if (p > 0) result.set((q.symbol as string).toUpperCase(), p)
    }
    return result
  } catch { return new Map() }
}

// ─── Precio actual de crypto (Binance) ───────────────────────────────────────
async function fetchCryptoPrice(ticker: string): Promise<number> {
  const symbol = CRYPTO_SYMBOL[ticker.toUpperCase()]
  if (!symbol) return 0
  try {
    const res  = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`)
    if (!res.ok) return 0
    const json = await res.json()
    return parseFloat(json.price) || 0
  } catch { return 0 }
}

// ─── Helpers de stats ─────────────────────────────────────────────────────────
interface Row {
  signal:           string
  score:            number
  asset_class:      string
  conditions_met:   number | null
  conditions_total: number | null
  regime:           string | null
  outcome_return:   number
  outcome_correct:  boolean
  generated_at:     string
  ticker:           string
  name:             string
}

function stats(rows: Row[]) {
  if (!rows.length) return { total: 0, correct: 0, accuracy: 0, avgReturn: 0 }
  const correct   = rows.filter(r => r.outcome_correct).length
  const avgReturn = rows.reduce((s, r) => s + r.outcome_return, 0) / rows.length
  return {
    total:     rows.length,
    correct,
    accuracy:  Math.round((correct / rows.length) * 100),
    avgReturn: Math.round(avgReturn * 100) / 100,
  }
}

// ─── GET /api/motor/accuracy ──────────────────────────────────────────────────
// 1. Mide outcomes pendientes (señales > 22 días con price_at_signal, sin outcome)
// 2. Devuelve estadísticas de accuracy históricas
export async function GET() {
  const db      = sb()
  const cutoff  = new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString()

  // ── Paso 1: señales pendientes de medir ──────────────────────────────────
  const { data: pending } = await db
    .from('signal_history')
    .select('id, ticker, signal, asset_class, price_at_signal')
    .lt('generated_at', cutoff)
    .is('outcome_measured_at', null)
    .not('price_at_signal', 'is', null)
    .limit(200)

  if (pending?.length) {
    const etfRows    = pending.filter(r => r.asset_class !== 'crypto')
    const cryptoRows = pending.filter(r => r.asset_class === 'crypto')

    // Fetch precios actuales en paralelo
    const etfTickers   = [...new Set(etfRows.map(r => r.ticker.toUpperCase()))]
    const priceMap     = await fetchCurrentPrices(etfTickers)

    const cryptoUniq   = [...new Set(cryptoRows.map(r => r.ticker.toUpperCase()))]
    await Promise.all(cryptoUniq.map(async tk => {
      const p = await fetchCryptoPrice(tk)
      if (p > 0) priceMap.set(tk, p)
    }))

    // Calcular y guardar outcomes
    const now = new Date().toISOString()
    await Promise.all(
      pending
        .filter(r => priceMap.has(r.ticker.toUpperCase()))
        .map(r => {
          const priceNow       = priceMap.get(r.ticker.toUpperCase())!
          const outcome_return = ((priceNow - r.price_at_signal) / r.price_at_signal) * 100
          const outcome_correct = r.signal === 'comprar' ? outcome_return > 0 : outcome_return < 0
          return db.from('signal_history').update({
            outcome_return:      Math.round(outcome_return * 100) / 100,
            outcome_correct,
            outcome_measured_at: now,
          }).eq('id', r.id)
        })
    )
  }

  // ── Paso 2: leer todas las señales medidas ────────────────────────────────
  const { data: measured } = await db
    .from('signal_history')
    .select('ticker, name, signal, score, asset_class, conditions_met, conditions_total, regime, outcome_return, outcome_correct, generated_at')
    .not('outcome_measured_at', 'is', null)
    .order('generated_at', { ascending: false })
    .limit(1000)

  const rows = (measured ?? []) as Row[]

  if (!rows.length) {
    return NextResponse.json({
      hasData:   false,
      measured:  0,
      pending:   pending?.length ?? 0,
      message:   'Las señales se acumulan. Vuelve en 22+ días para los primeros resultados.',
    })
  }

  // ── Paso 3: calcular estadísticas ─────────────────────────────────────────

  // Global
  const overall = stats(rows)

  // Por clase de activo
  const classes = ['fondos', 'etfs', 'renta_fija', 'crypto']
  const byClass = Object.fromEntries(
    classes.map(cls => [cls, stats(rows.filter(r => r.asset_class === cls))])
  )

  // Por tipo de señal
  const bySignal = {
    comprar: stats(rows.filter(r => r.signal === 'comprar')),
    reducir: stats(rows.filter(r => r.signal === 'reducir')),
  }

  // Por bucket de score (¿scores más altos = más accuracy?)
  const byScore = [
    { label: '< 55',  rows: rows.filter(r => r.score < 55)  },
    { label: '55–65', rows: rows.filter(r => r.score >= 55 && r.score < 65) },
    { label: '65–75', rows: rows.filter(r => r.score >= 65 && r.score < 75) },
    { label: '75+',   rows: rows.filter(r => r.score >= 75)  },
  ].map(b => ({ label: b.label, ...stats(b.rows) }))

  // Por condiciones cumplidas (¿más condiciones = mejor señal?)
  const condBuckets: Record<string, Row[]> = {}
  rows.forEach(r => {
    if (r.conditions_met == null || r.conditions_total == null) return
    const key = `${r.conditions_met}/${r.conditions_total}`
    if (!condBuckets[key]) condBuckets[key] = []
    condBuckets[key].push(r)
  })
  const byConditions = Object.entries(condBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, rs]) => ({ label, ...stats(rs) }))

  // Por régimen de mercado
  const regimes = ['risk-on', 'risk-off', 'neutral']
  const byRegime = Object.fromEntries(
    regimes.map(r => [r, stats(rows.filter(row => row.regime === r))])
  )

  // Señales recientes con outcome (para la tabla de la UI)
  const recent = rows.slice(0, 30).map(r => ({
    ticker:         r.ticker,
    name:           r.name,
    signal:         r.signal,
    score:          r.score,
    assetClass:     r.asset_class,
    conditionsMet:  r.conditions_met,
    conditionsTotal:r.conditions_total,
    regime:         r.regime,
    outcomeReturn:  r.outcome_return,
    correct:        r.outcome_correct,
    generatedAt:    r.generated_at,
  }))

  return NextResponse.json({
    hasData:      true,
    measured:     rows.length,
    pendingCount: pending?.length ?? 0,
    overall,
    byClass,
    bySignal,
    byScore,
    byConditions,
    byRegime,
    recent,
  })
}
