import type { NextRequest } from 'next/server'
import crypto from 'crypto'

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8')
    const bb = Buffer.from(b, 'utf8')
    if (ba.length !== bb.length) return false
    return crypto.timingSafeEqual(ba, bb)
  } catch { return false }
}

// Verifica token HMAC-firmado generado por /api/admin/login
function verifySessionToken(cookieValue: string, secret: string): boolean {
  const dot = cookieValue.lastIndexOf('.')
  if (dot === -1) return false

  const payload = cookieValue.slice(0, dot)
  const sig     = cookieValue.slice(dot + 1)

  // Verificar firma HMAC
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  if (!safeEqual(sig, expected)) return false

  // Verificar expiración server-side
  const colon = payload.lastIndexOf(':')
  if (colon === -1) return false
  const expires = parseInt(payload.slice(colon + 1), 10)
  return !isNaN(expires) && expires > Date.now()
}

// ─── Admin auth — synchronous, constant-time, no raw secret in cookies ────────
export function checkAdminAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false

  // HMAC-signed session token (browser sessions via /api/admin/login)
  const sessionCookie = req.cookies.get('sigma_admin_session')?.value
  if (sessionCookie && verifySessionToken(sessionCookie, secret)) return true

  // Legacy raw cookie — kept temporarily for backward compat, will be removed
  const legacy = req.cookies.get('sigma_admin')?.value
  if (legacy && safeEqual(legacy, secret)) return true

  // Authorization: Bearer <secret> — programmatic access (cron jobs, scripts)
  const header = req.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (bearer.length > 0 && safeEqual(bearer, secret)) return true

  // x-admin-secret header (used by marketing and direct email routes)
  const xSecret = req.headers.get('x-admin-secret') ?? ''
  if (xSecret && safeEqual(xSecret, secret)) return true

  return false
}
