import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendConfirmationEmail } from '@/lib/email'

// Self-service para usuarios que nunca recibieron o perdieron su email de
// confirmación — antes el único reenvío posible pasaba por checkAdminAuth,
// dejando a cualquiera con el correo en spam/borrado sin ninguna salida.
// Mismo patrón anti-enumeration que reset-password: rate limit por email Y
// por IP, y siempre se responde { ok: true } sin revelar si la cuenta existe
// o ya está confirmada.

const MAX_PER_EMAIL = 3
const MAX_PER_IP    = 10
const WINDOW_MS     = 60 * 60_000  // 1 hora

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
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const now     = new Date()
  const resetAt = new Date(Date.now() + WINDOW_MS).toISOString()

  try {
    const emailKey = `rl:resend_confirm_email:${email}`
    const { data: eRow } = await sb.from('rate_limits').select('count, reset_at').eq('id', emailKey).maybeSingle()
    if (eRow && new Date(eRow.reset_at) > now) {
      if (eRow.count >= MAX_PER_EMAIL) return false
      await sb.from('rate_limits').update({ count: eRow.count + 1 }).eq('id', emailKey)
    } else {
      await sb.from('rate_limits').upsert({ id: emailKey, count: 1, reset_at: resetAt }, { onConflict: 'id' })
    }

    const ipKey = `rl:resend_confirm_ip:${ip}`
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
  // Mismo orden que signup: x-real-ip primero (más confiable detrás del
  // proxy actual), x-forwarded-for como respaldo.
  const ip = (req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown').slice(0, 45)

  try {
    const { email } = await req.json() as { email?: string }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
    }
    const normalEmail = email.toLowerCase().trim()

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Servicio no disponible. Contacta al soporte.' }, { status: 503 })
    }

    const allowed = await checkRateLimit(normalEmail, ip)
    if (!allowed) {
      // Respuesta genérica — no revelar si el límite es por email o IP
      return NextResponse.json({ ok: true })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let firstName = 'Trader'
    try {
      const { data: profile } = await sb.from('profiles').select('nombre').eq('email', normalEmail).maybeSingle()
      const nombre = (profile as { nombre?: string } | null)?.nombre
      if (nombre) firstName = nombre.split(' ')[0]
    } catch { /* usar default */ }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    // magiclink en vez de signup: el usuario ya existe (sin confirmar), no
    // se necesita password de nuevo — al hacer clic confirma el email y
    // abre sesión, igual que el reenvío manual que ya hacía un admin.
    const { data: linkData, error: linkError } = await sb.auth.admin.generateLink({
      type: 'magiclink',
      email: normalEmail,
      options: { redirectTo: `${appUrl}/auth/callback` },
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      // Silencioso — no revelar si el email existe o no
      console.error('[resend-confirmation] generateLink:', linkError?.message)
      return NextResponse.json({ ok: true })
    }

    // token_hash en vez de action_link — ver nota en signup/route.ts: el
    // callback server-side no puede leer tokens del hash fragment.
    const confirmUrl = `${appUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=magiclink`
    await sendConfirmationEmail(normalEmail, firstName, confirmUrl)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[resend-confirmation]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
