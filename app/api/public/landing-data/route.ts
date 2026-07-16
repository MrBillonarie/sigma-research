import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VPS = process.env.VPS_URL ?? ''

const FALLBACK = {
  regime:           'UNKNOWN',
  equity:           11319,
  equity_initial:   10000,
  last_decision_at: null as string | null,
  snapshot_trigger: null as string | null,
  bayesian_confirmed: 1,
  bayesian_watching:  2,
  coverage_active:  18,
  coverage_target:  40,
  wr:               68,
  promoted_today:   0,
}

// Microcache en memoria (PERF-8): el landing tolera datos de ~15s. Evita pegarle
// al VPS en cada visita; persiste entre requests en el proceso Node del server.
let _cache: { data: Record<string, unknown>; ts: number } | null = null
const TTL_MS = 15_000
const CACHE_HEADER = { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' }

export async function GET() {
  if (_cache && Date.now() - _cache.ts < TTL_MS) {
    return NextResponse.json(_cache.data, { headers: CACHE_HEADER })
  }
  if (!VPS) return NextResponse.json(FALLBACK)
  try {
    const [engineRes, publicRes] = await Promise.all([
      fetch(`${VPS}/api/v2/engine_status`, { cache: 'no-store', signal: AbortSignal.timeout(4000) }),
      fetch(`${VPS}/api/public`,           { cache: 'no-store', signal: AbortSignal.timeout(4000) }),
    ])

    const engine = engineRes.ok ? await engineRes.json() : null
    const pub    = publicRes.ok  ? await publicRes.json()  : null

    const result = {
      regime:             pub?.regime                                      ?? FALLBACK.regime,
      equity:             engine?.fire?.current_equity                     ?? FALLBACK.equity,
      equity_initial:     engine?.fire?.starting_equity                    ?? FALLBACK.equity_initial,
      last_decision_at:   engine?.last_decision_at                         ?? FALLBACK.last_decision_at,
      snapshot_trigger:   engine?.snapshot_trigger                         ?? FALLBACK.snapshot_trigger,
      bayesian_confirmed: engine?.bayesian?.edge_confirmed                 ?? FALLBACK.bayesian_confirmed,
      bayesian_watching:  engine?.bayesian?.watching                       ?? FALLBACK.bayesian_watching,
      coverage_active:    engine?.coverage?.active                         ?? FALLBACK.coverage_active,
      coverage_target:    engine?.coverage?.target                         ?? FALLBACK.coverage_target,
      wr:                 engine?.portfolio?.wr                            ?? FALLBACK.wr,
      promoted_today:     engine?.decision_activity_24h?.champion_promoted ?? FALLBACK.promoted_today,
    }
    _cache = { data: result, ts: Date.now() }
    return NextResponse.json(result, { headers: CACHE_HEADER })
  } catch {
    // ante fallo del VPS, servir la última cache buena si existe
    if (_cache) return NextResponse.json(_cache.data, { headers: CACHE_HEADER })
    return NextResponse.json(FALLBACK)
  }
}
