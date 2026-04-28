import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendNuevoReporte } from '@/lib/email'
import { checkAdminAuth }  from '@/lib/adminAuth'

function makeService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await makeService()
    .from('reportes')
    .select('id,numero,titulo,fecha,descripcion,url_pdf,activo,created_at')
    .order('numero', { ascending: false })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ reportes: data })
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { numero, titulo, fecha, descripcion, url_pdf } = await req.json()
  const { data, error } = await makeService()
    .from('reportes')
    .insert({ numero, titulo, fecha, descripcion, url_pdf: url_pdf ?? '', activo: true })
    .select()
    .single()
  if (error) return NextResponse.json({ error }, { status: 500 })

  // Notificar suscriptores activos en background
  void (async () => {
    try {
      const service = makeService()
      const { data: subs } = await service
        .from('subscriptions')
        .select('user_id')
        .eq('status', 'active')
      if (!subs?.length) return
      const ids = subs.map(s => s.user_id)
      const { data: users } = await service.auth.admin.listUsers()
      const subscribers = (users?.users ?? [])
        .filter(u => ids.includes(u.id))
        .map(u => ({ email: u.email!, nombre: (u.user_metadata?.nombre as string) || u.email!.split('@')[0] }))
      if (subscribers.length) {
        await sendNuevoReporte(subscribers, data)
      }
    } catch (e) {
      console.error('[reportes] notify', e)
    }
  })()

  return NextResponse.json({ reporte: data })
}

export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...updates } = await req.json()
  const { data, error } = await makeService()
    .from('reportes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ reporte: data })
}

export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const { error } = await makeService().from('reportes').delete().eq('id', id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
