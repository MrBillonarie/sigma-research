export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// ─── Supabase-based rate limiting (escala entre instancias serverless) ─────────
const _rlFallback = new Map<string, { count: number; reset: number }>()

async function checkLoginRateLimit(ip: string): Promise<boolean> {
  const MAX       = 5
  const WINDOW_MS = 15 * 60_000
  const key       = `rl:admin_login:${ip}`
  const resetAt   = new Date(Date.now() + WINDOW_MS).toISOString()

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

    if (!data || new Date(data.reset_at) < new Date()) {
      await sb.from('rate_limits').upsert({ id: key, count: 1, reset_at: resetAt }, { onConflict: 'id' })
      return true
    }
    if (data.count >= MAX) return false
    await sb.from('rate_limits').update({ count: data.count + 1 }).eq('id', key)
    return true
  } catch {
    const now   = Date.now()
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

async function resetLoginRateLimit(ip: string): Promise<void> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    await sb.from('rate_limits').delete().eq('id', `rl:admin_login:${ip}`)
  } catch {
    _rlFallback.delete(ip)
  }
}

// Comparación en tiempo constante — previene timing attacks
function safeCompare(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8')
    const bb = Buffer.from(b, 'utf8')
    if (ba.length !== bb.length) return false
    return crypto.timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

// Genera token de sesión firmado con HMAC — nunca expone ADMIN_SECRET en la cookie
export function createSessionCookie(secret: string): string {
  const id      = crypto.randomBytes(16).toString('hex')
  const expires = Date.now() + 8 * 60 * 60_000
  const payload = `${id}:${expires}`
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

// ─── POST /api/admin/login ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (!await checkLoginRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera 15 minutos.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    )
  }

  const { email, password } = await req.json().catch(() => ({ email: '', password: '' }))

  const validEmail = process.env.ADMIN_EMAIL    ?? ''
  const validPwd   = process.env.ADMIN_PASSWORD ?? ''
  const secret     = process.env.ADMIN_SECRET   ?? ''

  if (!secret || !email || !password) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  const emailOk = safeCompare(email,    validEmail)
  const pwdOk   = safeCompare(password, validPwd)

  if (!emailOk || !pwdOk) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  await resetLoginRateLimit(ip)

  // Token HMAC-firmado — no expone el secret y tiene expiración server-side
  const sessionToken = createSessionCookie(secret)

  const res = NextResponse.json({ ok: true })
  res.cookies.set('sigma_admin_session', sessionToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
    maxAge:   8 * 60 * 60,
  })
  return res
}

// ─── DELETE /api/admin/login ──────────────────────────────────────────────────
export async function DELETE(_req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('sigma_admin')
  res.cookies.delete('sigma_admin_session')
  return res
}
