import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSoporteRespuesta } from '@/lib/email'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function auth(req: NextRequest) {
  const header = req.headers.get('authorization') ?? ''
  const secret = process.env.ADMIN_SECRET ?? 'adminsigma'
  return header === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await sb()
    .from('contact_submissions')
    .select('id, nombre, empresa, email, motivo, mensaje, status, respuesta, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tickets: data })
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id, status, respuesta, enviarEmail } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status)    updates.status    = status
  if (respuesta) updates.respuesta = respuesta

  const { data, error } = await sb()
    .from('contact_submissions')
    .update(updates)
    .eq('id', id)
    .select('nombre, email, mensaje, respuesta')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (enviarEmail && respuesta && data?.email) {
    await sendSoporteRespuesta(data.email, data.nombre, data.mensaje, respuesta)
  }

  return NextResponse.json({ ok: true })
}
