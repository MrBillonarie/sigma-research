export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function makeClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

function makeServiceClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = makeClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const service = makeServiceClient()

  // Validate plan
  const { data: sub } = await service
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!sub) {
    return NextResponse.json({ error: 'Sin plan activo.' }, { status: 403 })
  }

  // Fetch report
  const { data: reporte } = await service
    .from('reportes')
    .select('numero, titulo, fecha, url_pdf, activo')
    .eq('id', params.id)
    .maybeSingle()

  if (!reporte || !reporte.activo) {
    return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 })
  }
  if (!reporte.url_pdf) {
    return NextResponse.json({ error: 'PDF aún no disponible.' }, { status: 404 })
  }

  // Plan MENSUAL: solo el más reciente; ANUAL: todos
  if (sub.plan === 'mensual') {
    const { data: latest } = await service
      .from('reportes')
      .select('id')
      .eq('activo', true)
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest && latest.id !== params.id) {
      return NextResponse.json({ error: 'Tu plan solo incluye el reporte más reciente.' }, { status: 403 })
    }
  }

  // Proxy the PDF so the URL stays server-side
  const pdfRes = await fetch(reporte.url_pdf)
  if (!pdfRes.ok) {
    return NextResponse.json({ error: 'Error al obtener el PDF.' }, { status: 502 })
  }

  const num      = String(reporte.numero).padStart(3, '0')
  const mes      = reporte.fecha?.slice(0, 7) ?? ''
  const fileName = `SIGMA_Reporte_Mensual_#${num}_${mes}.pdf`

  return new NextResponse(pdfRes.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
