import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendContactoNotif } from '@/lib/email'

function authClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET() {
  const { data: { user } } = await authClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data, error } = await serviceClient()
    .from('contact_submissions')
    .select('id, motivo, mensaje, status, respuesta, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tickets: data })
}

export async function POST(req: NextRequest) {
  const { data: { user } } = await authClient().auth.getUser()
  if (!user || !user.email) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { motivo, mensaje } = await req.json().catch(() => ({})) as Record<string, string>

  if (!mensaje?.trim())
    return NextResponse.json({ error: 'El mensaje es obligatorio.' }, { status: 400 })
  if (mensaje.trim().length < 10)
    return NextResponse.json({ error: 'Mensaje demasiado corto (mínimo 10 caracteres).' }, { status: 400 })
  if (mensaje.trim().length > 2000)
    return NextResponse.json({ error: 'Mensaje demasiado largo (máximo 2000 caracteres).' }, { status: 400 })

  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').trim()
  const nombre = (user.user_metadata?.nombre as string) || user.email.split('@')[0]
  const email  = user.email.toLowerCase()

  const { data, error } = await serviceClient()
    .from('contact_submissions')
    .insert({
      user_id: user.id,
      nombre,
      email,
      motivo:  motivo ? stripHtml(motivo).slice(0, 100) : null,
      mensaje: stripHtml(mensaje).slice(0, 2000),
    })
    .select('id, motivo, mensaje, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void sendContactoNotif({ nombre, email, motivo, mensaje: mensaje.trim() })

  return NextResponse.json({ ticket: data }, { status: 201 })
}
