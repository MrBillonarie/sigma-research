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

  // Validate plan via app_metadata
  const { data: authUser } = await service.auth.admin.getUserById(user.id)
  const plan = (authUser?.user?.app_metadata?.plan as string) ?? 'free'

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
  if (plan !== 'pro' && plan !== 'anual') {
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

  const fileName = `reporte-${params.id.slice(0, 8)}.pdf`

  return new NextResponse(pdfRes.body, {
    headers: {
      'Content-Type':              'application/pdf',
      'Content-Disposition':       `attachment; filename="${fileName}"`,
      'X-Content-Type-Options':    'nosniff',
      'Cache-Control':             'private, no-cache, no-store',
      'Content-Security-Policy':   "default-src 'none'",
    },
  })
}
