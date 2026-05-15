import type { NextRequest } from 'next/server'
import crypto from 'crypto'

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8')
    const bb = Buffer.from(b, 'utf8')
    if (ba.length !== bb.length) { crypto.timingSafeEqual(ba, ba); return false }
    return crypto.timingSafeEqual(ba, bb)
  } catch { return false }
}

// ─── Admin auth — constant-time comparison to prevent timing attacks ──────────
export function checkAdminAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false

  // Cookie (raw secret — legacy, still supported)
  const cookie = req.cookies.get('sigma_admin')?.value
  if (cookie && safeEqual(cookie, secret)) return true

  // Authorization: Bearer <secret>
  const header = req.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (bearer && safeEqual(bearer, secret)) return true

  // x-admin-secret header (used by marketing and direct email routes)
  const xSecret = req.headers.get('x-admin-secret') ?? ''
  if (xSecret && safeEqual(xSecret, secret)) return true

  return false
}
