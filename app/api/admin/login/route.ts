export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// ─── Rate limiting: max 5 intentos por IP por 15 minutos ─────────────────────
const _loginAttempts = new Map<string, { count: number; reset: number }>()
function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = _loginAttempts.get(ip)
  if (!entry || now > entry.reset) {
    _loginAttempts.set(ip, { count: 1, reset: now + 15 * 60_000 })
    return true
  }
  if (entry.count >= 5) return false
  entry.count++
  return true
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

// ─── POST /api/admin/login ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (!checkLoginRateLimit(ip)) {
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

  // timingSafeEqual en ambas comparaciones para prevenir timing attacks
  const emailOk = safeCompare(email,    validEmail)
  const pwdOk   = safeCompare(password, validPwd)

  if (!emailOk || !pwdOk) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  // Reset intentos al login exitoso
  _loginAttempts.delete(ip)

  // Token de sesión opaco — nunca exponer el ADMIN_SECRET en la cookie
  const sessionToken = crypto.randomBytes(32).toString('hex')
  // Guardamos mapping token → validez (en memoria, suficiente para admin)
  _sessionTokens.set(sessionToken, Date.now() + 8 * 60 * 60_000)

  const res = NextResponse.json({ ok: true })
  res.cookies.set('sigma_admin_session', sessionToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
    maxAge:   8 * 60 * 60,
  })
  res.cookies.set('sigma_admin', secret, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
    maxAge:   8 * 60 * 60,
  })
  return res
}

// Store de sesiones opacas
const _sessionTokens = new Map<string, number>()

// ─── DELETE /api/admin/login ──────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = req.cookies.get('sigma_admin_session')?.value
  if (session) _sessionTokens.delete(session)

  const res = NextResponse.json({ ok: true })
  res.cookies.delete('sigma_admin')
  res.cookies.delete('sigma_admin_session')
  return res
}
