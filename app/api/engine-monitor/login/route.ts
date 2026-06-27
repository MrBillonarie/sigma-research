export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { safeEqual } from '@/lib/crypto'

function makeSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ─── Rate limiting (mismo patrón que admin/login) ──────────────────────────────
const _rlFallback = new Map<string, { count: number; reset: number }>()

async function checkLoginRateLimit(ip: string): Promise<{ allowed: boolean; sb: ReturnType<typeof makeSb> }> {
  const MAX       = 5
  const WINDOW_MS = 15 * 60_000
  const key       = `rl:engine_monitor_login:${ip}`
  const resetAt   = new Date(Date.now() + WINDOW_MS).toISOString()
  const sb        = makeSb()

  try {
    const { data, error } = await sb
      .from('rate_limits')
      .select('count, reset_at')
      .eq('id', key)
      .maybeSingle()

    if (error) throw error

    if (!data || new Date(data.reset_at) < new Date()) {
      await sb.from('rate_limits').upsert({ id: key, count: 1, reset_at: resetAt }, { onConflict: 'id' })
      return { allowed: true, sb }
    }
    if (data.count >= MAX) return { allowed: false, sb }
    await sb.from('rate_limits').update({ count: data.count + 1 }).eq('id', key)
    return { allowed: true, sb }
  } catch {
    const now   = Date.now()
    const entry = _rlFallback.get(ip)
    if (!entry || now > entry.reset) {
      _rlFallback.set(ip, { count: 1, reset: now + WINDOW_MS })
      return { allowed: true, sb }
    }
    if (entry.count >= MAX) return { allowed: false, sb }
    entry.count++
    return { allowed: true, sb }
  }
}

// Token de sesión firmado — sin maxAge en la cookie (muere al cerrar el navegador),
// con expiración de respaldo embebida en el payload por si el navegador la conserva.
function createSessionToken(secret: string): string {
  const id      = crypto.randomBytes(16).toString('hex')
  const expires = Date.now() + 8 * 60 * 60_000 // 8h de respaldo
  const payload = `${id}:${expires}`
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const { allowed } = await checkLoginRateLimit(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera 15 minutos.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    )
  }

  const { password } = await req.json().catch(() => ({ password: '' }))

  const validPwd = process.env.ENGINE_MONITOR_PASSWORD ?? ''
  const secret   = process.env.ENGINE_MONITOR_SECRET   ?? ''

  if (!secret || !validPwd || !password || !safeEqual(password, validPwd)) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('sigma_engine_session', createSessionToken(secret), {
    httpOnly: true,
    secure:   true,
    sameSite: 'strict',
    path:     '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('sigma_engine_session')
  return res
}
