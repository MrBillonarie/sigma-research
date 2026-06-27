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
  equity:         11_422.53,
  equity_initial: 10_000,
  return_pct:     14.23,
  profit_factor:  1.935,
  max_dd_pct:     -8.74,
  win_rate:       59.1,
  total_trades:   22,
  computed_at:    '',
}

export async function GET() {
  if (!VPS) return NextResponse.json({ ...FALLBACK, live: false })
  try {
    const [statsRes, perfRes, signalsRes] = await Promise.all([
      fetch(`${VPS}/api/stats`,       { cache: 'no-store', signal: AbortSignal.timeout(3000) }),
      fetch(`${VPS}/api/performance`, { cache: 'no-store', signal: AbortSignal.timeout(3000) }),
      fetch(`${VPS}/api/signals`,     { cache: 'no-store', signal: AbortSignal.timeout(3000) }),
    ])

    const stats   = statsRes.ok   ? await statsRes.json()   : null
    const perf    = perfRes.ok    ? await perfRes.json()    : null
    const signals = signalsRes.ok ? await signalsRes.json() : null

    const byTf = stats?.by_tf ?? {}
    const tfs  = Object.keys(byTf).length
    const p    = perf?.portfolio ?? {}

    return NextResponse.json(
      {
        total:          stats?.total                                       ?? FALLBACK.total,
        rate_hr:        ((stats?.rate_hr ?? 0) + (stats?.optuna_rate_hr ?? 0)) || FALLBACK.rate_hr,
        timeframes:     tfs > 0 ? tfs : 7,
        by_tf:          byTf,
        assets:         5,
        live:           !!(stats || perf || signals),
        regime:         signals?.regime        ?? FALLBACK.regime,
        equity:         p.equity               ?? FALLBACK.equity,
        equity_initial: p.initial              ?? FALLBACK.equity_initial,
        return_pct:     p.return_pct           ?? FALLBACK.return_pct,
        profit_factor:  p.profit_factor        ?? FALLBACK.profit_factor,
        max_dd_pct:     p.max_dd_pct           ?? FALLBACK.max_dd_pct,
        win_rate:       p.portfolio_wr         ?? FALLBACK.win_rate,
        total_trades:   p.total_trades         ?? FALLBACK.total_trades,
        computed_at:    perf?.computed_at      ?? FALLBACK.computed_at,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    )
  } catch {
    return NextResponse.json(FALLBACK)
  }
}
