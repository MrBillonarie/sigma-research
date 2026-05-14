import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usa service_role para crear usuarios ya confirmados sin email de verificación
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, nombre } = await req.json().catch(() => ({}))

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    }

    const supabase = adminClient()

    // Crear usuario ya confirmado (sin email de verificación)
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,         // confirma automáticamente
      user_metadata: { nombre },
    })

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        return NextResponse.json({ error: 'Ya existe una cuenta con ese email.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, userId: data.user?.id })
  } catch (e) {
    console.error('[api/auth/signup]', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
