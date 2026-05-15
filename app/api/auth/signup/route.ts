import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Validación server-side robusta
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
      // Mapear errores internos a mensajes genéricos
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        return NextResponse.json({ error: 'Ya existe una cuenta con ese email.' }, { status: 409 })
      }
      if (error.message.includes('invalid') && error.message.includes('email')) {
        return NextResponse.json({ error: 'Formato de email inválido.' }, { status: 400 })
      }
      if (error.message.includes('password')) {
        return NextResponse.json({ error: 'La contraseña no cumple los requisitos.' }, { status: 400 })
      }
      // Error genérico — no exponer mensaje interno
      return NextResponse.json({ error: 'Error al crear la cuenta. Intenta nuevamente.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, userId: data.user?.id })
  } catch (e) {
    console.error('[api/auth/signup]', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
