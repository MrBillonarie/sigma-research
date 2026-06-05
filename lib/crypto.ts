import crypto from 'crypto'

// Comparación en tiempo constante — previene timing attacks
export function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8')
    const bb = Buffer.from(b, 'utf8')
    if (ba.length !== bb.length) return false
    return crypto.timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}
