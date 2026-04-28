import type { NextRequest } from 'next/server'

// ─── Verificación de admin en API routes ─────────────────────────────────────
// Acepta cookie httpOnly (nuevo, seguro) o Authorization header (legacy).
// El secret vive en ADMIN_SECRET — nunca en variables NEXT_PUBLIC_*.
export function checkAdminAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const cookie = req.cookies.get('sigma_admin')?.value
  if (cookie === secret) return true
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}`
}
