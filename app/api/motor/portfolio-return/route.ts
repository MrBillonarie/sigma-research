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

interface HistTrade { mode?: string; pnl_pct?: number; closed_at?: string }

// Endpoint angosto a propósito: el motor expone /api/trades con posiciones
// abiertas, SL/TP y señales — datos que no deben llegar al navegador de
// cualquier usuario logueado. Acá se calcula server-side y solo se devuelve
// el % de retorno agregado (mes actual + acumulado), nada operacional.
//
// 2026-07-23: el retorno se calcula componiendo pnl_pct (fórmula backtest,
// mismo campo que usa el resto de SIGMA para WR/PF) de cada trade LIVE
// cerrado -- NO diferenciando equity real, que queda contaminado por
// depósitos/retiros de capital del usuario y por el mark-to-market de otras
// posiciones abiertas al momento del snapshot. Ver conversación 2026-07-23:
// el widget mostró +108% que en realidad era ~$715 de depósitos manuales
// sobre una cuenta de ~$550, con trading real levemente negativo ese mes.
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
    const portfolio: { days_active?: number } = data.portfolio ?? {}
    const history: HistTrade[] = data.history ?? []

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const liveClosed  = history.filter(t => t.mode === 'LIVE' && typeof t.pnl_pct === 'number')
    const monthClosed = liveClosed.filter(t => (t.closed_at ?? '') >= monthStart)

    const compoundPct = (trades: HistTrade[]) =>
      (trades.reduce((acc, t) => acc * (1 + (t.pnl_pct as number) / 100), 1) - 1) * 100

    const monthlyReturnPct    = Math.round(compoundPct(monthClosed) * 100) / 100
    const cumulativeReturnPct = Math.round(compoundPct(liveClosed) * 100) / 100
    const daysActive: number  = portfolio.days_active ?? 0

    return NextResponse.json(
      { monthlyReturnPct, cumulativeReturnPct, daysActive },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' } }
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 503 })
  }
}
