export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const VPS  = process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'
const PASS = process.env.VPS_MOTOR_PASS ?? ''

function makeClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

async function getMotorAuthCookie(): Promise<string> {
  const res = await fetch(`${VPS}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `pwd=${PASS}`,
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  })
  const cookie = res.headers.get('set-cookie') ?? ''
  const match = cookie.match(/([^;]+)/)
  return match ? match[1] : ''
}

interface HistTrade { mode?: string; pnl_dollar?: number; closed_at?: string }
interface EquityPoint { eq: number; date: string }

// Endpoint angosto a propósito: el motor expone /api/trades con posiciones
// abiertas, SL/TP y señales — datos que no deben llegar al navegador de
// cualquier usuario logueado. Acá se calcula server-side y solo se devuelve
// el % de retorno agregado (mes actual + acumulado), nada operacional.
//
// 2026-07-23, dos vueltas de fix el mismo día:
// 1) diferenciar equity real (intento inicial) queda contaminado por
//    depósitos/retiros del usuario y por mark-to-market de otras posiciones
//    -- mostró +108% que en realidad eran ~$715 de depósitos manuales.
// 2) componer pnl_pct (fórmula backtest kelly%/sl_dist) de trades mode=LIVE
//    (segundo intento) excluía los trades mode=MANUAL -- que SÍ son reales,
//    se ejecutan en la misma cuenta master de Binance y los copytraders los
//    replican (ver close_trade() en web_server.py) -- y además pnl_pct para
//    MANUAL no es confiable: asume el kelly% de la fórmula, no el tamaño real
//    de la posición que el usuario puso a mano. Con eso el widget daba -6.8%
//    en un mes que en dólares reales fue positivo.
// Fix final: usar pnl_dollar (el dólar real ejecutado, no una fórmula) de
// TODOS los trades reales (LIVE + MANUAL, nunca PAPER) sobre el equity real
// al inicio del período -- retorno = PnL realizado / capital al inicio,
// el estándar de la industria, inmune a depósitos porque estos no son pnl
// de trade.
export async function GET() {
  const { data: { user } } = await makeClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  try {
    const sessionCookie = await getMotorAuthCookie()
    const res = await fetch(`${VPS}/api/trades`, {
      headers: sessionCookie ? { Cookie: sessionCookie } : {},
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`motor ${res.status}`)
    const data = await res.json()
    const portfolio: { initial?: number; days_active?: number; equity_history?: EquityPoint[] } = data.portfolio ?? {}
    const history: HistTrade[] = data.history ?? []
    const initial: number = portfolio.initial ?? 550.51
    const equityHistory: EquityPoint[] = portfolio.equity_history ?? []

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    let equityAtMonthStart = initial
    for (const pt of equityHistory) {
      if (pt.date < monthStart) equityAtMonthStart = pt.eq
      else break
    }

    const real = history.filter(t => (t.mode === 'LIVE' || t.mode === 'MANUAL') && typeof t.pnl_dollar === 'number')
    const monthPnl = real
      .filter(t => (t.closed_at ?? '') >= monthStart)
      .reduce((acc, t) => acc + (t.pnl_dollar as number), 0)
    const totalPnl = real.reduce((acc, t) => acc + (t.pnl_dollar as number), 0)

    const monthlyReturnPct    = equityAtMonthStart > 0 ? Math.round((monthPnl / equityAtMonthStart) * 10000) / 100 : 0
    const cumulativeReturnPct = initial > 0 ? Math.round((totalPnl / initial) * 10000) / 100 : 0
    const daysActive: number  = portfolio.days_active ?? 0

    return NextResponse.json(
      { monthlyReturnPct, cumulativeReturnPct, daysActive },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' } }
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 503 })
  }
}
