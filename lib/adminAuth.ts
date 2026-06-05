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

// ─── Admin auth — constant-time, HMAC-signed session token, no raw secret ─────
export function checkAdminAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false

  // HMAC-signed session token (browser sessions via /api/admin/login)
  const sessionCookie = req.cookies.get('sigma_admin_session')?.value
  if (sessionCookie && verifySessionToken(sessionCookie, secret)) return true

  // Authorization: Bearer <secret> — programmatic access (cron jobs, scripts)
  const header = req.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (bearer.length > 0 && safeEqual(bearer, secret)) return true

  // x-admin-secret header (used by marketing and direct email routes)
  const xSecret = req.headers.get('x-admin-secret') ?? ''
  if (xSecret && safeEqual(xSecret, secret)) return true

  return false
}
