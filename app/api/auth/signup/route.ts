import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    // Verificar variables de entorno primero
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[signup] Variables de Supabase no configuradas en Vercel')
      return NextResponse.json({ error: 'Servicio no disponible. Contacta al soporte.' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const { email, password, nombre } = body

    const validationError = validateSignup(email, password, nombre)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const supabase = adminClient()
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { nombre: typeof nombre === 'string' ? nombre.trim().slice(0, 100) : '' },
    })

    if (error) {
      console.error('[signup] Supabase error:', error.message, '| URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40))
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
        console.error('[signup] Service role key inválida o sin permisos de admin')
        return NextResponse.json({ error: 'Error de configuración del servidor.' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Error al crear la cuenta. Intenta nuevamente.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, userId: data.user?.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown'
    console.error('[signup] Exception:', msg)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
