import type { NextRequest } from 'next/server'
import crypto from 'crypto'

// ─── Admin auth — constant-time comparison to prevent timing attacks ──────────
export function checkAdminAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false

  const expected = Buffer.from(secret, 'utf8')

  const cookie = req.cookies.get('sigma_admin')?.value
  if (cookie) {
    try {
      const candidate = Buffer.from(cookie, 'utf8')
      if (candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)) return true
    } catch { /* length mismatch */ }
  }

  const header = req.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (bearer) {
    try {
      const candidate = Buffer.from(bearer, 'utf8')
      if (candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)) return true
    } catch { /* length mismatch */ }
  }

  return false
}
