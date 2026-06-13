import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VPS = process.env.VPS_URL ?? 'http://localhost:8080'

const FALLBACK = {
  regime: 'UNKNOWN',
  equity: 11319,
  equity_initial: 10000,
  open_trades: [] as unknown[],
  promoted_today: 0,
  last_decision_at: null as string | null,
  backtests: 16_767_345,
  coverage_active: 18,
  wr: 68,
}

export async function GET() {
  try {
    const [engineRes, publicRes] = await Promise.all([
      fetch(`${VPS}/api/v2/engine_status`, { cache: 'no-store', signal: AbortSignal.timeout(4000) }),
      fetch(`${VPS}/api/public`,           { cache: 'no-store', signal: AbortSignal.timeout(4000) }),
    ])

    const engine = engineRes.ok ? await engineRes.json() : null
    const pub    = publicRes.ok  ? await publicRes.json()  : null

    return NextResponse.json({
      regime:           pub?.regime                                    ?? FALLBACK.regime,
      equity:           engine?.fire?.current_equity                   ?? FALLBACK.equity,
      equity_initial:   engine?.fire?.starting_equity                  ?? FALLBACK.equity_initial,
      open_trades:      pub?.open_trades                               ?? FALLBACK.open_trades,
      promoted_today:   engine?.decision_activity_24h?.champion_promoted ?? FALLBACK.promoted_today,
      last_decision_at: engine?.last_decision_at                       ?? FALLBACK.last_decision_at,
      backtests:        engine?.backtests_total                        ?? FALLBACK.backtests,
      coverage_active:  engine?.coverage?.active                       ?? FALLBACK.coverage_active,
      wr:               engine?.portfolio?.wr                          ?? FALLBACK.wr,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(FALLBACK)
  }
}
