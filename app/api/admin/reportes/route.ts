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

  // Notificar a todos los usuarios — query profiles para escalar sin límite de 1000
  void (async () => {
    try {
      const service = makeService()
      let allSubscribers: { email: string; nombre: string }[] = []
      let from = 0
      const PAGE = 1000
      while (true) {
        const { data: rows, error } = await service
          .from('profiles')
          .select('email, nombre')
          .not('email', 'is', null)
          .range(from, from + PAGE - 1)
        if (error || !rows?.length) break
        allSubscribers = allSubscribers.concat(
          rows.map((r: { email: string; nombre?: string }) => ({
            email:  r.email,
            nombre: r.nombre || r.email.split('@')[0],
          }))
        )
        if (rows.length < PAGE) break
        from += PAGE
      }
      if (allSubscribers.length) {
        await sendNuevoReporte(allSubscribers, data)
      }
    } catch (e) {
      console.error('[reportes] notify', e)
    }
  })()

  return NextResponse.json({ reporte: data })
}

export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, titulo, fecha, descripcion, url_pdf, activo } = await req.json().catch(() => ({}))
  // Allowlist fields — never pass raw body to Supabase
  const updates: Record<string, unknown> = {}
  if (titulo     !== undefined) updates.titulo      = String(titulo).slice(0, 200)
  if (fecha      !== undefined) updates.fecha       = String(fecha).slice(0, 20)
  if (descripcion !== undefined) updates.descripcion = String(descripcion).slice(0, 2000)
  if (url_pdf    !== undefined) updates.url_pdf     = String(url_pdf).slice(0, 500)
  if (activo     !== undefined) updates.activo      = Boolean(activo)
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Sin campos válidos' }, { status: 400 })
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
