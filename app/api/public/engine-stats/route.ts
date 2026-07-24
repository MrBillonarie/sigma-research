import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VPS = process.env.VPS_URL ?? ''

const FALLBACK = {
  total:          16_386_795,
  rate_hr:        124_075,
  timeframes:     7,
  by_tf:          { '4h': 3_472_285, '1h': 5_672_653, '15m': 5_696_032, '5m': 1_279_475, '1d': 194_571, '2h': 71_282, '1m': 498 } as Record<string, number>,
  assets:         5,
  live:           false,
  regime:         'BEAR',
  equity:         550.51,
  equity_initial: 550.51,
  return_pct:     0,
  profit_factor:  0,
  max_dd_pct:     0,
  win_rate:       0,
  total_trades:   0,
  genetic_strategies_count: 13,
  genetic_combos_hr:        0,
  cpcv_backtests_total:     19_782,
  cpcv_models_evaluated:    355,
  computed_at:    '',
}

// Microcache en memoria (PERF-8): evita pegarle al VPS en cada visita al landing.
let _cache: { data: Record<string, unknown>; ts: number } | null = null
const TTL_MS = 20_000
const CACHE_HEADER = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }

export async function GET() {
  if (_cache && Date.now() - _cache.ts < TTL_MS) {
    return NextResponse.json(_cache.data, { headers: CACHE_HEADER })
  }
  if (!VPS) return NextResponse.json({ ...FALLBACK, live: false })
  try {
    // 2026-07-23: reemplaza /api/performance (utils/performance_tracker.py) --
    // ese script mezclaba TODO trade_state.json['history'] sin filtrar por
    // mode, así que "portfolio_wr"/"profit_factor" incluían trades PAPER bajo
    // nombres de variable que decían "live" (live_wr, live_n...) sin serlo.
    // Confirmado con datos reales: portfolio_wr=37.7% ahí vs 71.2% real
    // (LIVE+MANUAL únicamente). /api/public ya calcula esto correcto server-side
    // (ver web_server.py) -- una sola fuente de verdad para "qué tan real es esto".
    const [statsRes, pubRes, signalsRes] = await Promise.all([
      fetch(`${VPS}/api/stats`,   { cache: 'no-store', signal: AbortSignal.timeout(3000) }),
      fetch(`${VPS}/api/public`,  { cache: 'no-store', signal: AbortSignal.timeout(3000) }),
      fetch(`${VPS}/api/signals`, { cache: 'no-store', signal: AbortSignal.timeout(3000) }),
    ])

    const stats   = statsRes.ok   ? await statsRes.json()   : null
    const pub     = pubRes.ok     ? await pubRes.json()     : null
    const signals = signalsRes.ok ? await signalsRes.json() : null

    const byTf = stats?.by_tf ?? {}
    const tfs  = Object.keys(byTf).length
    const p    = pub?.portfolio ?? {}

    const result = {
      total:          stats?.total                                       ?? FALLBACK.total,
      rate_hr:        ((stats?.rate_hr ?? 0) + (stats?.optuna_rate_hr ?? 0)) || FALLBACK.rate_hr,
      timeframes:     tfs > 0 ? tfs : 7,
      by_tf:          byTf,
      assets:         5,
      live:           !!(stats || pub || signals),
      regime:         signals?.regime        ?? FALLBACK.regime,
      equity:         p.equity               ?? FALLBACK.equity,
      equity_initial: p.initial_capital      ?? FALLBACK.equity_initial,
      return_pct:     p.real_return_pct      ?? FALLBACK.return_pct,
      profit_factor:  p.pf                   ?? FALLBACK.profit_factor,
      max_dd_pct:     p.max_dd_pct           ?? FALLBACK.max_dd_pct,
      win_rate:       p.wr                   ?? FALLBACK.win_rate,
      total_trades:   p.real_n_trades        ?? FALLBACK.total_trades,
      genetic_strategies_count: stats?.genetic_strategies_count ?? FALLBACK.genetic_strategies_count,
      genetic_combos_hr:        stats?.genetic_combos_hr        ?? FALLBACK.genetic_combos_hr,
      cpcv_backtests_total:     stats?.cpcv_backtests_total     ?? FALLBACK.cpcv_backtests_total,
      cpcv_models_evaluated:    stats?.cpcv_models_evaluated    ?? FALLBACK.cpcv_models_evaluated,
      computed_at:    new Date().toISOString(),
    }
    _cache = { data: result, ts: Date.now() }
    return NextResponse.json(result, { headers: CACHE_HEADER })
  } catch {
    if (_cache) return NextResponse.json(_cache.data, { headers: CACHE_HEADER })
    return NextResponse.json(FALLBACK)
  }
}
