import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSoporteRespuesta } from '@/lib/email'
import { checkAdminAuth }       from '@/lib/adminAuth'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}


export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const client = sb()
  const { data, error } = await client
    .from('contact_submissions')
    .select('id, nombre, empresa, email, motivo, mensaje, status, respuesta, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hilo de conversación por ticket
  const ids = (data ?? []).map(t => t.id)
  let mensajes: Array<{ ticket_id: string; sender: string; body: string; created_at: string }> = []
  if (ids.length > 0) {
    const { data: msgs } = await client
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

export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id, status, respuesta, enviarEmail } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const client = sb()
  const reply  = respuesta ? String(respuesta).replace(/<[^>]*>/g, '').trim().slice(0, 5000) : ''

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  // Responder ya no cierra el ticket: queda "visto" (en revisión) y el usuario
  // puede seguir la conversación hasta que el admin lo marque resuelto.
  if (status)     updates.status = status
  else if (reply) updates.status = 'visto'

  const { data, error } = await client
    .from('contact_submissions')
    .update(updates)
    .eq('id', id)
    .select('user_id, nombre, email, mensaje')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // La respuesta entra al hilo de conversación (chat)
  if (reply) {
    const { error: mErr } = await client
      .from('support_messages')
      .insert({ ticket_id: id, sender: 'admin', body: reply })
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
  }

  if (enviarEmail && reply && data?.email) {
    await sendSoporteRespuesta(data.email, data.nombre, data.mensaje, reply)
  }

  if (reply && data?.user_id) {
    await client.from('notifications').insert({
      user_id:      data.user_id,
      type:         'soporte',
      title:        'Respuesta a tu ticket de soporte',
      body:         reply.slice(0, 200),
      urgente:      false,
      accion_label: 'Ver respuesta',
      accion_href:  '/soporte',
      read:         false,
    })
  }

  return NextResponse.json({ ok: true })
}
