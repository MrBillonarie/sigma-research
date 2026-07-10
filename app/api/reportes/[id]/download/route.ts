export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPlanInfo } from '@/lib/plan'

function makeServiceClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  // ?inline=1 → abrir en el navegador (botón VER); default → descarga
  const inline = new URL(req.url).searchParams.get('inline') === '1'
  // Plan via helper compartido (lib/plan.ts) — getUser() ya trae app_metadata
  // fresco del servidor de auth, sin necesidad del lookup admin por service role
  const { userId, isPro } = await getPlanInfo()
  if (!userId) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const service = makeServiceClient()

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

  // Regla de planes (2026-07-09): los reportes se publican semanalmente.
  // FREE: 1 reporte al mes — la primera edición de cada mes calendario.
  // PRO/ANUAL: todas las ediciones + hemeroteca completa.
  if (!isPro) {
    const month = (reporte.fecha as string | null)?.slice(0, 7) ?? ''
    const { data: monthFirst } = month
      ? await service
          .from('reportes')
          .select('id')
          .eq('activo', true)
          .gte('fecha', `${month}-01`)
          .lte('fecha', `${month}-31`)
          .order('fecha',  { ascending: true })
          .order('numero', { ascending: true })
          .limit(1)
          .maybeSingle()
      : { data: null }
    if (!monthFirst || monthFirst.id !== params.id) {
      return NextResponse.json(
        { error: 'Tu plan incluye 1 reporte al mes (la primera edición). Las ediciones semanales son del plan PRO.' },
        { status: 403 }
      )
    }
  }

  // Validate url_pdf domain before fetching to prevent SSRF
  let pdfUrl: URL
  try {
    pdfUrl = new URL(reporte.url_pdf)
  } catch {
    return NextResponse.json({ error: 'URL de PDF inválida.' }, { status: 500 })
  }
  const SUPABASE_HOST = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
  if (pdfUrl.hostname !== SUPABASE_HOST) {
    return NextResponse.json({ error: 'Origen de PDF no permitido.' }, { status: 403 })
  }

  // Proxy the PDF so the URL stays server-side
  const pdfRes = await fetch(pdfUrl.toString(), { signal: AbortSignal.timeout(15000) })
  if (!pdfRes.ok) {
    return NextResponse.json({ error: 'Error al obtener el PDF.' }, { status: 502 })
  }

  const fileName = `reporte-${params.id.slice(0, 8)}.pdf`

  return new NextResponse(pdfRes.body, {
    headers: {
      'Content-Type':              'application/pdf',
      'Content-Disposition':       `${inline ? 'inline' : 'attachment'}; filename="${fileName}"`,
      'X-Content-Type-Options':    'nosniff',
      'Cache-Control':             'private, no-cache, no-store',
      'Content-Security-Policy':   "default-src 'none'",
    },
  })
}
