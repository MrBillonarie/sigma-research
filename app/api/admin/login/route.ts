export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { safeEqual } from '@/lib/crypto'
import { logAdminAction } from '@/lib/adminAudit'

function makeSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ─── Supabase-based rate limiting (escala entre instancias serverless) ─────────
const _rlFallback = new Map<string, { count: number; reset: number }>()

async function checkLoginRateLimit(ip: string): Promise<{ allowed: boolean; sb: ReturnType<typeof makeSb> }> {
  const MAX       = 5
  const WINDOW_MS = 15 * 60_000
  const key       = `rl:admin_login:${ip}`
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

async function resetLoginRateLimit(ip: string, sb: ReturnType<typeof makeSb>): Promise<void> {
  try {
    await sb.from('rate_limits').delete().eq('id', `rl:admin_login:${ip}`)
  } catch {
    _rlFallback.delete(ip)
  }
}

// Genera token de sesión firmado con HMAC — nunca expone ADMIN_SECRET en la cookie
function createSessionCookie(secret: string): string {
  const id      = crypto.randomBytes(16).toString('hex')
  const expires = Date.now() + 2 * 60 * 60_000  // 2 horas máximo
  const payload = `${id}:${expires}`
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

// ─── POST /api/admin/login ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const { allowed, sb } = await checkLoginRateLimit(ip)
  if (!allowed) {
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

  const emailOk = safeEqual(email,    validEmail)
  const pwdOk   = safeEqual(password, validPwd)

  if (!emailOk || !pwdOk) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  // Reusar el cliente ya creado en el rate limit check
  await resetLoginRateLimit(ip, sb)

  const sessionToken = createSessionCookie(secret)
  void logAdminAction('admin.login', undefined, { ip })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('sigma_admin_session', sessionToken, {
    httpOnly: true,
    secure:   true,
    sameSite: 'strict',
    path:     '/',
    maxAge:   2 * 60 * 60,
  })
  return res
}

// ─── GET /api/admin/login ─────────────────────────────────────────────────────
// Dice si la cookie de sesión sigue siendo válida. Existe porque el estado de
// login del admin vivía sólo en `sessionStorage`, que el servidor no puede ver
// ni invalidar: cuando la cookie expiraba (2 h) pero la marca del navegador
// seguía puesta, /admin creía estar logueado, redirigía al dashboard y se
// quedaba renderizando null — pantalla en negro sin formulario ni error.
// Con esto el servidor vuelve a ser la única fuente de verdad.
export async function GET() {
  const { cookies } = await import('next/headers')
  const { checkAdminSessionCookie } = await import('@/lib/adminAuth')
  const ok = checkAdminSessionCookie(cookies().get('sigma_admin_session')?.value)
  return NextResponse.json({ authenticated: ok })
}

// ─── DELETE /api/admin/login ──────────────────────────────────────────────────
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('sigma_admin')
  res.cookies.delete('sigma_admin_session')
  return res
}
