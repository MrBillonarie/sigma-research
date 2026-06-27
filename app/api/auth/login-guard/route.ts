import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Pre-flight de rate limit para login — antes el login llamaba directo a
// supabase.auth.signInWithPassword desde el cliente, sin ningún control
// propio contra fuerza bruta de contraseña (dependía 100% del límite nativo
// de Supabase, no configurable desde este repo). El cliente llama este
// endpoint ANTES de intentar la contraseña; si está permitido, sigue usando
// el mismo signInWithPassword de siempre — no se toca el mecanismo de auth.

const MAX_PER_EMAIL = 8
const MAX_PER_IP    = 20
const WINDOW_MS     = 15 * 60_000  // 15 minutos

const _ipMap    = new Map<string, { count: number; reset: number }>()
const _emailMap = new Map<string, { count: number; reset: number }>()

function checkMemoryLimit(map: Map<string, { count: number; reset: number }>, key: string, max: number): boolean {
  const now  = Date.now()
  const slot = map.get(key)
  if (!slot || now > slot.reset) { map.set(key, { count: 1, reset: now + WINDOW_MS }); return true }
  if (slot.count >= max) return false
  slot.count++
  return true
}

async function checkRateLimit(email: string, ip: string): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return checkMemoryLimit(_emailMap, email, MAX_PER_EMAIL) && checkMemoryLimit(_ipMap, ip, MAX_PER_IP)
  }
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const now     = new Date()
  const resetAt = new Date(Date.now() + WINDOW_MS).toISOString()

  try {
    const emailKey = `rl:login_email:${email}`
    const { data: eRow } = await sb.from('rate_limits').select('count, reset_at').eq('id', emailKey).maybeSingle()
    if (eRow && new Date(eRow.reset_at) > now) {
      if (eRow.count >= MAX_PER_EMAIL) return false
      await sb.from('rate_limits').update({ count: eRow.count + 1 }).eq('id', emailKey)
    } else {
      await sb.from('rate_limits').upsert({ id: emailKey, count: 1, reset_at: resetAt }, { onConflict: 'id' })
    }

    const ipKey = `rl:login_ip:${ip}`
    const { data: iRow } = await sb.from('rate_limits').select('count, reset_at').eq('id', ipKey).maybeSingle()
    if (iRow && new Date(iRow.reset_at) > now) {
      if (iRow.count >= MAX_PER_IP) return false
      await sb.from('rate_limits').update({ count: iRow.count + 1 }).eq('id', ipKey)
    } else {
      await sb.from('rate_limits').upsert({ id: ipKey, count: 1, reset_at: resetAt }, { onConflict: 'id' })
    }
    return true
  } catch {
    return checkMemoryLimit(_emailMap, email, MAX_PER_EMAIL) && checkMemoryLimit(_ipMap, ip, MAX_PER_IP)
  }
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown').slice(0, 45)

  try {
    const { email } = await req.json() as { email?: string }
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }
    const allowed = await checkRateLimit(email.toLowerCase().trim(), ip)
    if (!allowed) {
      return NextResponse.json({ allowed: false, error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 })
    }
    return NextResponse.json({ allowed: true })
  } catch (e) {
    console.error('[login-guard]', e)
    // Si el propio guard falla, no se bloquea el login por un error nuestro —
    // el límite nativo de Supabase sigue siendo la red de seguridad de fondo.
    return NextResponse.json({ allowed: true })
  }
}
