import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { verifyEngineMonitorSession } from '@/lib/engineMonitorAuth'
import { getPlanInfo, stripActionableFields } from '@/lib/plan'

const VPS = process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'

function makeClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

interface RawChampion {
  slot?: string; sym?: string; tf?: string; strategy?: string; direction?: string; grade?: string
  metrics_oos?: { cagr?: number; wr?: number; dd?: number; pf?: number; trades?: number }
  wft?: { verdict?: string; oos_win_rate?: number; n_windows?: number }
  mc?: { confidence?: number; cagr_p05?: number; cagr_p50?: number; cagr_p95?: number; dd_p95?: number }
  bayesian?: { edge_confirmed?: boolean; n_trades?: number; live_wr?: number }
  red_flags?: string[]
  risk_pct?: number | null
  saved_at?: string | null
}

// El motor (/api/v2/champions) guarda backtest, walk-forward y Monte Carlo
// anidados (metrics_oos/wft/mc/bayesian). La UI de /modelos espera los mismos
// datos en campos planos -- se aplanan aqui en vez de tocar el motor.
function normalizeChampion(raw: RawChampion) {
  const mc = raw.mc ?? {}
  const conf = mc.confidence
  return {
    slot: raw.slot, sym: raw.sym, tf: raw.tf, strategy: raw.strategy,
    direction: raw.direction, grade: raw.grade,
    cagr: raw.metrics_oos?.cagr, wr: raw.metrics_oos?.wr, dd: raw.metrics_oos?.dd,
    trades: raw.metrics_oos?.trades,
    wft_verdict: raw.wft?.verdict, val_wft: raw.wft?.oos_win_rate, wft_windows: raw.wft?.n_windows,
    val_mc: conf, mc_confidence: conf, mc_cagr_p05: mc.cagr_p05, mc_dd_p95: mc.dd_p95,
    val_confidence: conf == null ? undefined : conf >= 90 ? 'ALTA' : conf >= 70 ? 'MEDIA' : 'BAJA',
    eff_risk_pct: raw.risk_pct ?? undefined,
    n_live_trades: raw.bayesian?.n_trades, live_wr: raw.bayesian?.live_wr,
    robustness_gates: raw.red_flags,
    saved_at: raw.saved_at,
  }
}

export async function GET() {
  const { data: { user } } = await makeClient().auth.getUser()
  const engineCookie = cookies().get('sigma_engine_session')?.value
  if (!user && !verifyEngineMonitorSession(engineCookie)) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  // Primary: /api/v2/champions — full champion list with all metrics
  // Fallback: /api/public top_models — always available
  try {
    const r1 = await fetch(`${VPS}/api/v2/champions`, {
      signal: AbortSignal.timeout(6000),
    })
    if (r1.ok) {
      const data = await r1.json()
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>)?.champions)
          ? (data as Record<string, unknown>).champions as RawChampion[]
          : Object.values(data as Record<string, unknown>) as RawChampion[]
      if (list.length > 0) {
        return NextResponse.json(list.map(normalizeChampion), {
          headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=30' },
        })
      }
    }
  } catch { /* fall through */ }

  // Fallback: public endpoint top_models — a diferencia del path normalizado,
  // viene crudo del motor (incluye price/sl/tp y sizing) → filtrar para no-PRO
  try {
    const r2 = await fetch(`${VPS}/api/public`, {
      signal: AbortSignal.timeout(8000),
    })
    if (r2.ok) {
      const d = await r2.json()
      let list = d?.top_models ?? []
      const { isPro } = await getPlanInfo()
      if (!isPro) list = stripActionableFields(list)
      return NextResponse.json(list, {
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=30' },
      })
    }
  } catch { /* fall through */ }

  return NextResponse.json([], { status: 200 })
}
