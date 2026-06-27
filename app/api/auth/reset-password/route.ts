import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendResetPasswordEmail } from '../../../../lib/email'

const MAX_PER_EMAIL = 3
const MAX_PER_IP    = 10
const WINDOW_MS     = 60 * 60_000  // 1 hora

// Fallback en memoria si Supabase no está disponible
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
  const adminSb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const now     = new Date()
  const resetAt = new Date(Date.now() + WINDOW_MS).toISOString()

  try {
    // Límite por email (más estricto — previene enumeration y abuso de un target)
    const emailKey = `rl:reset_email:${email.toLowerCase()}`
    const { data: eRow } = await adminSb.from('rate_limits').select('count, reset_at').eq('id', emailKey).maybeSingle()
    if (eRow && new Date(eRow.reset_at) > now) {
      if (eRow.count >= MAX_PER_EMAIL) return false
      await adminSb.from('rate_limits').update({ count: eRow.count + 1 }).eq('id', emailKey)
    } else {
      await adminSb.from('rate_limits').upsert({ id: emailKey, count: 1, reset_at: resetAt }, { onConflict: 'id' })
    }

    // Límite por IP (secundario — previene spray attacks)
    const ipKey = `rl:reset_ip:${ip}`
    const { data: iRow } = await adminSb.from('rate_limits').select('count, reset_at').eq('id', ipKey).maybeSingle()
    if (iRow && new Date(iRow.reset_at) > now) {
      if (iRow.count >= MAX_PER_IP) return false
      await adminSb.from('rate_limits').update({ count: iRow.count + 1 }).eq('id', ipKey)
    } else {
      await adminSb.from('rate_limits').upsert({ id: ipKey, count: 1, reset_at: resetAt }, { onConflict: 'id' })
    }

    return true
  } catch {
    // Fallback en memoria si Supabase falla
    return checkMemoryLimit(_emailMap, email.toLowerCase(), MAX_PER_EMAIL) &&
           checkMemoryLimit(_ipMap, ip, MAX_PER_IP)
  }
}

export async function POST(req: NextRequest) {
  // Mismo orden que signup: x-real-ip primero (más confiable detrás del
  // proxy actual), x-forwarded-for como respaldo.
  const ip = (req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown').slice(0, 45)

  try {
    const { email } = await req.json() as { email: string }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
    }

    const allowed = await checkRateLimit(email.toLowerCase().trim(), ip)
    if (!allowed) {
      // Respuesta genérica — no revelar si el límite es por email o IP
      return NextResponse.json({ ok: true })
    }

    const adminSb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Buscar nombre en profiles sin escanear la tabla de auth completa
    let firstName = 'Trader'
    try {
      const { data: profile } = await adminSb
        .from('profiles')
        .select('nombre')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle()
      const nombre = (profile as { nombre?: string } | null)?.nombre
      if (nombre) firstName = nombre.split(' ')[0]
    } catch { /* ignore — use default */ }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://squantdesk.com').replace(/\/$/, '')
    const { data: linkData, error: linkErr } = await adminSb.auth.admin.generateLink({
      type:    'recovery',
      email:   email.toLowerCase().trim(),
      options: {},
    })

    if (linkErr || !linkData?.properties?.hashed_token) {
      // Silencioso — no revelar si el email existe o no
      console.error('[reset-password] generateLink:', linkErr?.message)
      return NextResponse.json({ ok: true })
    }

    // token_hash en vez de action_link — el callback server-side (PKCE) no
    // puede leer los tokens que action_link entrega por hash fragment.
    const resetUrl = `${appUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=recovery`
    await sendResetPasswordEmail(email, firstName, resetUrl)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[reset-password]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
