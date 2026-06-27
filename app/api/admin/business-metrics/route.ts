import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/adminAuth'

const PRO_PRICE  = 29
const MS_WEEK    = 7  * 24 * 3600 * 1000
const MS_14D     = 14 * 24 * 3600 * 1000
const MS_7D      = 7  * 24 * 3600 * 1000
const MS_48H     = 48 * 3600 * 1000

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const client = sb()
  const now    = Date.now()

  // ── Usuarios ────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: authData } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 }) as any
  const users: Array<{
    id: string; email: string; created_at: string
    email_confirmed_at: string | null; last_sign_in_at: string | null
    app_metadata: { plan?: string }
  }> = authData?.users ?? []

  const proUsers  = users.filter(u => u.app_metadata?.plan === 'pro')
  const freeUsers = users.filter(u => (u.app_metadata?.plan ?? 'free') !== 'pro')

  // ── MRR ─────────────────────────────────────────────────────────────────────
  const mrr = proUsers.length * PRO_PRICE

  // ── Crecimiento semanal ──────────────────────────────────────────────────────
  const thisWeek = users.filter(u => now - new Date(u.created_at).getTime() < MS_WEEK).length
  const lastWeek = users.filter(u => {
    const age = now - new Date(u.created_at).getTime()
    return age >= MS_WEEK && age < 2 * MS_WEEK
  }).length
  const weeklyGrowthPct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null

  // ── Proyección a 100 usuarios ────────────────────────────────────────────────
  const avgPerWeek   = thisWeek || lastWeek || 1
  const remaining    = Math.max(0, 100 - users.length)
  const weeksToGoal  = remaining > 0 ? Math.ceil(remaining / avgPerWeek) : 0

  // ── Tasa de conversión ───────────────────────────────────────────────────────
  const confirmedUsers   = users.filter(u => !!u.email_confirmed_at)
  const conversionRate   = confirmedUsers.length > 0
    ? Math.round((proUsers.length / confirmedUsers.length) * 1000) / 10
    : 0

  // ── Alertas ──────────────────────────────────────────────────────────────────
  // PRO sin actividad en 14+ días → riesgo de churn
  const churnRisk = proUsers
    .filter(u => {
      if (!u.last_sign_in_at) return true
      return now - new Date(u.last_sign_in_at).getTime() > MS_14D
    })
    .map(u => ({ id: u.id, email: u.email, lastSeen: u.last_sign_in_at }))

  // Free con email confirmado y 7+ días sin convertir → oportunidad de campaña
  const convOpportunity = freeUsers
    .filter(u => u.email_confirmed_at && now - new Date(u.created_at).getTime() > MS_7D)
    .map(u => ({ id: u.id, email: u.email, registeredAt: u.created_at }))

  // Tickets pendientes > 48h sin respuesta
  const { data: tickets } = await client
    .from('contact_submissions')
    .select('id, nombre, created_at')
    .eq('status', 'pendiente')

  const urgentTickets = (tickets ?? [])
    .filter(t => now - new Date(t.created_at).getTime() > MS_48H)
    .map(t => ({ id: t.id, nombre: t.nombre, since: t.created_at }))

  return NextResponse.json({
    mrr,
    mrrGoal:        100 * PRO_PRICE,
    totalUsers:     users.length,
    proCount:       proUsers.length,
    freeCount:      freeUsers.length,
    confirmedCount: confirmedUsers.length,
    thisWeek,
    lastWeek,
    weeklyGrowthPct,
    weeksToGoal,
    conversionRate,
    alerts: {
      churnRisk,
      convOpportunity,
      urgentTickets,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
