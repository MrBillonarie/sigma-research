export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const VPS = process.env.VPS_URL ?? ''

function makeClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

interface RawMotorTrade {
  sym: string; tf: string; direction: 'long' | 'short'; strategy: string; grade: string
  entry: number; exit_price?: number; sl: number; tp: number
  opened_at: string; closed_at?: string; status: string; pnl_pct: number
}

function mapTrade(t: Record<string, unknown>): RawMotorTrade {
  return {
    sym: String(t.sym ?? ''), tf: String(t.tf ?? ''),
    direction: t.direction === 'short' ? 'short' : 'long',
    strategy: String(t.strategy ?? ''), grade: String(t.grade ?? ''),
    entry: Number(t.entry ?? 0), exit_price: t.exit_price != null ? Number(t.exit_price) : undefined,
    sl: Number(t.sl ?? 0), tp: Number(t.tp ?? 0),
    opened_at: String(t.opened_at ?? ''), closed_at: t.closed_at != null ? String(t.closed_at) : undefined,
    status: String(t.status ?? ''), pnl_pct: Number(t.pnl_pct ?? 0),
  }
}

// Mismo endpoint público que ya usa la landing para la equity curve — acá
// solo se gatea detrás de login y se recorta a los campos que el Journal
// necesita para reconstruir el historial escalado al capital del usuario.
export async function GET() {
  const { data: { user } } = await makeClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  if (!VPS) return NextResponse.json({ closed: [], open: [] })

  try {
    const res = await fetch(`${VPS}/api/public`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`motor ${res.status}`)
    const data = await res.json()

    const history: Record<string, unknown>[] = Array.isArray(data?.history) ? data.history : []
    const openTrades: Record<string, unknown>[] = Array.isArray(data?.open_trades) ? data.open_trades : []

    // La simulación arranca cuando el usuario creó su perfil — no se le
    // atribuyen operaciones del motor anteriores a su propia existencia en
    // el sistema. Un usuario nuevo parte en limpio y ve el journal llenarse
    // en vivo desde ahí, no un historial retroactivo que nunca corrió con su capital.
    const signupAt = new Date(user.created_at).getTime()
    const sinceSignup = (t: RawMotorTrade) => new Date(t.opened_at).getTime() >= signupAt

    const closed = history
      .map(mapTrade)
      .filter(t => t.closed_at)
      .filter(sinceSignup)
      .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime())
    const open = openTrades.map(mapTrade).filter(sinceSignup)

    return NextResponse.json({ closed, open }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 503 })
  }
}
