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

interface EquityPoint { eq: number; date: string }

// Endpoint angosto a propósito: el motor expone /api/trades con posiciones
// abiertas, SL/TP y señales — datos que no deben llegar al navegador de
// cualquier usuario logueado. Acá se calcula server-side y solo se devuelve
// el % de retorno agregado (mes actual + acumulado), nada operacional.
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
    const portfolio = data.portfolio ?? {}
    const initial: number = portfolio.initial ?? 10000
    const history: EquityPoint[] = portfolio.equity_history ?? []

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    let monthStartEq = initial
    for (const pt of history) {
      if (pt.date < monthStart) monthStartEq = pt.eq
      else break
    }
    const latestEq = history.length > 0 ? history[history.length - 1].eq : (portfolio.equity ?? monthStartEq)

    const monthlyReturnPct     = monthStartEq > 0 ? ((latestEq - monthStartEq) / monthStartEq) * 100 : 0
    const cumulativeReturnPct: number = portfolio.return_pct ?? 0
    const daysActive: number = portfolio.days_active ?? 0

    return NextResponse.json(
      { monthlyReturnPct, cumulativeReturnPct, daysActive },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' } }
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 503 })
  }
}
