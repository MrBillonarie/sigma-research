import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendNuevoReporte } from '@/lib/email'
import { checkAdminAuth }  from '@/lib/adminAuth'
import { logAdminAction }  from '@/lib/adminAudit'

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
  const { numero, titulo, fecha, descripcion, url_pdf } = await req.json().catch(() => ({}))
  const { data, error } = await makeService()
    .from('reportes')
    .insert({ numero, titulo, fecha, descripcion, url_pdf: url_pdf ?? '', activo: true })
    .select()
    .single()
  if (error) return NextResponse.json({ error }, { status: 500 })

  void logAdminAction('reporte.create', data.id, { numero, titulo })

  // Notificar a todos los usuarios con email confirmado en background
  void (async () => {
    try {
      const service = makeService()
      const { data: authData } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const subscribers = (authData?.users ?? [])
        .filter(u => u.email && u.email_confirmed_at)
        .map(u => ({
          email:  u.email!,
          nombre: (u.user_metadata?.nombre as string) || u.email!.split('@')[0],
        }))
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
  const { id, ...updates } = await req.json().catch(() => ({}))
  const { data, error } = await makeService()
    .from('reportes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error }, { status: 500 })
  const action = 'activo' in updates && Object.keys(updates).length === 1 ? 'reporte.toggle' : 'reporte.edit'
  void logAdminAction(action, id, updates)
  return NextResponse.json({ reporte: data })
}

export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json().catch(() => ({}))
  const { error } = await makeService().from('reportes').delete().eq('id', id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  void logAdminAction('reporte.delete', id)
  return NextResponse.json({ ok: true })
}
