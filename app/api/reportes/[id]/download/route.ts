export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPlanInfo } from '@/lib/plan'
import { checkAdminSessionCookie } from '@/lib/adminAuth'

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
  // fresco del servidor de auth, sin necesidad del lookup admin por service role.
  // La sesión de admin (HMAC, sin usuario Supabase) también accede — necesaria
  // para el preview "PDF ↗" del panel de administración.
  const isAdmin = checkAdminSessionCookie(cookies().get('sigma_admin_session')?.value)
  const { userId, isPro } = await getPlanInfo()
  if (!userId && !isAdmin) {
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
  // PRO/ANUAL: todas las ediciones + hemeroteca completa. Admin: sin límite.
  if (!isPro && !isAdmin) {
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

  // Validate url_pdf domain before parsing to prevent SSRF
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

  // Descargar via Storage API con service role — funciona con bucket público o
  // PRIVADO (url_pdf guarda la forma pública histórica; aquí solo se parsea
  // bucket + path). Antes se hacía fetch a la URL pública, lo que impedía
  // privatizar el bucket.
  const marker = '/storage/v1/object/public/'
  const mIdx   = pdfUrl.pathname.indexOf(marker)
  if (mIdx === -1) {
    return NextResponse.json({ error: 'Formato de URL de PDF no soportado.' }, { status: 500 })
  }
  const rest       = decodeURIComponent(pdfUrl.pathname.slice(mIdx + marker.length))
  const slash      = rest.indexOf('/')
  const bucket     = slash === -1 ? rest : rest.slice(0, slash)
  const objectPath = slash === -1 ? ''   : rest.slice(slash + 1)
  if (!bucket || !objectPath) {
    return NextResponse.json({ error: 'Ruta de PDF inválida.' }, { status: 500 })
  }

  const { data: blob, error: dlError } = await service.storage.from(bucket).download(objectPath)
  if (dlError || !blob) {
    return NextResponse.json({ error: 'Error al obtener el PDF.' }, { status: 502 })
  }

  const fileName = `reporte-${params.id.slice(0, 8)}.pdf`

  return new NextResponse(blob, {
    headers: {
      'Content-Type':              'application/pdf',
      'Content-Disposition':       `${inline ? 'inline' : 'attachment'}; filename="${fileName}"`,
      'X-Content-Type-Options':    'nosniff',
      'Cache-Control':             'private, no-cache, no-store',
      'Content-Security-Policy':   "default-src 'none'",
    },
  })
}
