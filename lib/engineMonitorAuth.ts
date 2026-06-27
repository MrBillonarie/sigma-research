import crypto from 'crypto'

// Verifica la cookie de sesión del gate de "monitoreo del motor" (sigma_engine_session).
// Mismo esquema HMAC que la sesión de admin: payload "id:expires" + firma sha256.
export function verifyEngineMonitorSession(cookieValue: string | undefined): boolean {
  const secret = process.env.ENGINE_MONITOR_SECRET
  if (!secret || !cookieValue) return false

  const dot = cookieValue.lastIndexOf('.')
  if (dot === -1) return false

  const payload = cookieValue.slice(0, dot)
  const sig     = cookieValue.slice(dot + 1)
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  if (sig.length !== expected.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false

  const colon   = payload.lastIndexOf(':')
  if (colon === -1) return false
  const expires = parseInt(payload.slice(colon + 1), 10)
  return !isNaN(expires) && expires > Date.now()
}
