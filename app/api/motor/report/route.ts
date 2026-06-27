export const dynamic = 'force-dynamic'

import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateReport } from '@/lib/reportGen'
import type { Asset, Allocation, PortfolioMetrics, FlowSignal, Profile } from '@/types/decision-engine'

// ─── Rate limiting distribuido via Supabase (mismo patrón que motor/signals) ──
const _rlFallback = new Map<string, { count: number; reset: number }>()

async function checkRateLimit(ip: string): Promise<boolean> {
  const MAX = 10
  const WINDOW_MS = 60_000
  const key = `rl:report:${ip}`
  const now = Date.now()
  const resetAt = new Date(now + WINDOW_MS).toISOString()

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    const { data, error } = await sb
      .from('rate_limits')
      .select('count, reset_at')
      .eq('id', key)
      .maybeSingle()
    if (error) throw error

    if (!data || new Date(data.reset_at) < new Date(now)) {
      await sb.from('rate_limits').upsert({ id: key, count: 1, reset_at: resetAt }, { onConflict: 'id' })
      return true
    }
    if (data.count >= MAX) return false
    await sb.from('rate_limits').update({ count: data.count + 1 }).eq('id', key)
    return true
  } catch {
    const entry = _rlFallback.get(ip)
    if (!entry || now > entry.reset) {
      _rlFallback.set(ip, { count: 1, reset: now + WINDOW_MS })
      return true
    }
    if (entry.count >= MAX) return false
    entry.count++
    return true
  }
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET
  const providedCronSecret = req.headers.get('x-cron-secret') ?? ''
  if (cronSecret && providedCronSecret.length === cronSecret.length) {
    if (timingSafeEqual(Buffer.from(providedCronSecret), Buffer.from(cronSecret))) return true
  }
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return !!user
}

export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!await checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: 'Demasiadas solicitudes. Intenta en un minuto.' }, { status: 429 })
  }

  try {
    const body = await req.json() as {
      profile:     Profile
      assets:      Asset[]
      allocation:  Allocation
      metrics:     PortfolioMetrics
      flowSignals: FlowSignal[]
      flowScore:   number
    }

    const { profile, assets, allocation, metrics, flowSignals, flowScore } = body

    if (!profile || !assets?.length) {
      return NextResponse.json({ ok: false, error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const report = generateReport(profile, assets, allocation, metrics, flowSignals, flowScore)
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[motor/report]', err)
    return NextResponse.json({ ok: false, error: 'Error generando reporte' }, { status: 500 })
  }
}
