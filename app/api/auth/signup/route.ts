import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendConfirmationEmail } from '@/lib/email'

// In-memory fallback only — primary rate limiting uses Supabase (escala entre procesos)
const _rlFallback = new Map<string, { count: number; reset: number }>()

async function checkSignupRateLimit(ip: string, sb: ReturnType<typeof adminClient>): Promise<boolean> {
  const MAX       = 5
  const WINDOW_MS = 10 * 60_000
  const key       = `rl:signup:${ip}`
  const resetAt   = new Date(Date.now() + WINDOW_MS).toISOString()

  try {
    const { data, error } = await sb
      .from('rate_limits')
      .select('count, reset_at')
      .eq('id', key)
      .maybeSingle()

    if (error) throw error

    if (!data || new Date(data.reset_at) < new Date()) {
      await sb.from('rate_limits').upsert({ id: key, count: 1, reset_at: resetAt }, { onConflict: 'id' })
      return true
    }
    if (data.count >= MAX) return false
    await sb.from('rate_limits').update({ count: data.count + 1 }).eq('id', key)
    return true
  } catch {
    const now   = Date.now()
    const entry = _rlFallback.get(ip)
    if (!entry || now > entry.reset) { _rlFallback.set(ip, { count: 1, reset: now + WINDOW_MS }); return true }
    if (entry.count >= MAX) return false
    entry.count++
    return true
  }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(`Supabase no configurado. URL: ${url ? 'OK' : 'FALTA'}, KEY: ${key ? 'OK' : 'FALTA'}`)
  }

  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function validateSignup(email: unknown, password: unknown, nombre: unknown): string | null {
  if (typeof email !== 'string' || typeof password !== 'string') return 'Datos inválidos'
  if (!email.trim() || !password) return 'Email y contraseña requeridos'
  if (email.length > 254) return 'Email demasiado largo'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Formato de email inválido'
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (password.length > 128) return 'La contraseña es demasiado larga'
  if (typeof nombre === 'string' && nombre.length > 100) return 'El nombre es demasiado largo'
  return null
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[signup] Variables de Supabase no configuradas')
      return NextResponse.json({ error: 'Servicio no disponible. Contacta al soporte.' }, { status: 503 })
    }

    const supabaseClient = adminClient()
    if (!await checkSignupRateLimit(ip, supabaseClient)) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera 10 minutos.' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const { email, password, nombre } = body

    const validationError = validateSignup(email, password, nombre)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const normalEmail = (email as string).trim().toLowerCase()
    const firstName   = typeof nombre === 'string' ? nombre.trim().slice(0, 100) : ''
    const appUrl      = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

    // generateLink({ type: 'signup' }) creates the user (unconfirmed) and returns
    // a Supabase-signed action_link. Clicking it confirms the email and creates a session.
    const { data: linkData, error } = await supabaseClient.auth.admin.generateLink({
      type: 'signup',
      email: normalEmail,
      password,
      options: {
        data: { nombre: firstName },
        redirectTo: `${appUrl}/auth/callback`,
      },
    })

    if (error) {
      console.error('[signup] generateLink error:', error.message)
      if (error.message.includes('already registered') || error.message.includes('already exists') || error.status === 422) {
        return NextResponse.json({ error: 'Ya existe una cuenta con ese email.' }, { status: 409 })
      }
      if (error.message.includes('invalid') && error.message.includes('email')) {
        return NextResponse.json({ error: 'Formato de email inválido.' }, { status: 400 })
      }
      if (error.message.includes('password')) {
        return NextResponse.json({ error: 'La contraseña no cumple los requisitos.' }, { status: 400 })
      }
      if (error.message.includes('not authorized') || error.status === 401 || error.status === 403) {
        return NextResponse.json({ error: 'Error de configuración del servidor.' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Error al crear la cuenta. Intenta nuevamente.' }, { status: 400 })
    }

    // Usamos token_hash en vez de action_link: action_link entrega los tokens
    // por hash fragment (flujo implícito), invisible para nuestro callback
    // server-side (que usa PKCE). token_hash sí llega por query string y se
    // verifica directo con verifyOtp en /auth/callback.
    const tokenHash = linkData?.properties?.hashed_token
    if (tokenHash) {
      const confirmUrl = `${appUrl}/auth/callback?token_hash=${tokenHash}&type=signup`
      const { success, error: emailError } = await sendConfirmationEmail(
        normalEmail,
        firstName || 'Trader',
        confirmUrl,
      )
      if (!success) console.error('[signup] email send failed:', emailError)
    } else {
      console.error('[signup] hashed_token missing from generateLink response')
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown'
    console.error('[signup] Exception:', msg)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
