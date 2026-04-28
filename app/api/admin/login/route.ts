export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

// ─── POST /api/admin/login ────────────────────────────────────────────────────
// Valida credenciales desde variables de entorno (nunca hardcodeadas).
// En éxito establece cookie httpOnly — el cliente no necesita manejar el secret.
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({ email: '', password: '' }))

  const validEmail = process.env.ADMIN_EMAIL    ?? ''
  const validPwd   = process.env.ADMIN_PASSWORD ?? ''
  const secret     = process.env.ADMIN_SECRET   ?? ''

  if (!secret || !email || !password) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  if (email !== validEmail || password !== validPwd) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('sigma_admin', secret, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
    maxAge:   8 * 60 * 60, // 8 horas
  })
  return res
}

// ─── DELETE /api/admin/login ──────────────────────────────────────────────────
// Cierra sesión eliminando la cookie.
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('sigma_admin')
  return res
}
