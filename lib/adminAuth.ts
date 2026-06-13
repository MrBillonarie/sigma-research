import type { NextRequest } from 'next/server'
import crypto from 'crypto'
import { safeEqual } from './crypto'

// Verifica token HMAC-firmado generado por /api/admin/login
function verifySessionToken(cookieValue: string, secret: string): boolean {
  const dot = cookieValue.lastIndexOf('.')
  if (dot === -1) return false

  const payload = cookieValue.slice(0, dot)
  const sig     = cookieValue.slice(dot + 1)

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  if (!safeEqual(sig, expected)) return false

  const colon = payload.lastIndexOf(':')
  if (colon === -1) return false
  const expires = parseInt(payload.slice(colon + 1), 10)
  return !isNaN(expires) && expires > Date.now()
}

// ─── Admin auth — solo session tokens HMAC-firmados, sin raw secrets ──────────
export function checkAdminAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false

  // Solo acepta sesiones firmadas generadas por /api/admin/login
  const sessionCookie = req.cookies.get('sigma_admin_session')?.value
  if (sessionCookie && verifySessionToken(sessionCookie, secret)) return true

  return false
}
