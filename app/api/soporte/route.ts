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

  const svc = serviceClient()
  const { data, error } = await svc
    .from('contact_submissions')
    .select('id, motivo, mensaje, status, respuesta, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hilo de conversación de cada ticket
  const ids = (data ?? []).map(t => t.id)
  let mensajes: Array<{ ticket_id: string; sender: string; body: string; created_at: string }> = []
  if (ids.length > 0) {
    const { data: msgs } = await svc
      .from('support_messages')
      .select('ticket_id, sender, body, created_at')
      .in('ticket_id', ids)
      .order('created_at', { ascending: true })
    mensajes = msgs ?? []
  }

  const tickets = (data ?? []).map(t => ({
    ...t,
    mensajes: mensajes.filter(m => m.ticket_id === t.id),
  }))

  return NextResponse.json({ tickets })
}

// Respuesta del usuario dentro de un ticket existente (chat)
export async function PUT(req: NextRequest) {
  const { data: { user } } = await authClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { ticket_id, mensaje } = await req.json().catch(() => ({})) as Record<string, string>
  if (!ticket_id) return NextResponse.json({ error: 'ticket_id requerido.' }, { status: 400 })
  const body = (mensaje ?? '').replace(/<[^>]*>/g, '').trim()
  if (!body) return NextResponse.json({ error: 'El mensaje es obligatorio.' }, { status: 400 })
  if (body.length > 2000) return NextResponse.json({ error: 'Mensaje demasiado largo (máximo 2000 caracteres).' }, { status: 400 })

  const svc = serviceClient()

  // El ticket debe pertenecer al usuario y seguir abierto
  const { data: ticket, error: tErr } = await svc
    .from('contact_submissions')
    .select('id, user_id, status, motivo, nombre, email')
    .eq('id', ticket_id)
    .single()
  if (tErr || !ticket)              return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 })
  if (ticket.user_id !== user.id)   return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 })
  if (ticket.status === 'resuelto') return NextResponse.json({ error: 'El ticket ya fue resuelto. Crea una nueva consulta.' }, { status: 409 })

  const { data: msg, error } = await svc
    .from('support_messages')
    .insert({ ticket_id, sender: 'user', body })
    .select('sender, body, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reabre el ciclo: vuelve a PENDIENTE para el admin
  await svc
    .from('contact_submissions')
    .update({ status: 'pendiente', updated_at: new Date().toISOString() })
    .eq('id', ticket_id)

  // Aviso por email al equipo (no bloquea la respuesta)
  void sendContactoNotif({
    nombre:  ticket.nombre ?? user.email ?? 'usuario',
    email:   ticket.email ?? user.email ?? '',
    motivo:  `Re: ${ticket.motivo ?? 'Consulta'}`,
    mensaje: body,
  })

  return NextResponse.json({ mensaje: msg }, { status: 201 })
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
