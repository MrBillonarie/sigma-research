export const dynamic     = 'force-dynamic'
export const runtime     = 'nodejs'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'
import { reunirDatos } from '@/lib/researchData'
import { generarInformeHtml } from '@/lib/researchReportHtml'
import { htmlAPdf } from '@/lib/renderPdf'

// Cron de los domingos: genera el research semanal completo (datos reales +
// narrativas de Claude), lo renderiza a PDF con el Chrome del VPS y lo sube al
// bucket.
//
// SALVAGUARDA: solo se publica en vivo (visible para los usuarios) cuando la
// edición pasa el control de calidad — narrativas escritas y los 13 precios
// presentes. Si algo falta (p. ej. todavía no hay ANTHROPIC_API_KEY, o el motor
// no respondió), queda como BORRADOR oculto para que el admin lo revise. Nunca
// llega a los usuarios un informe con huecos en ámbar o datos incompletos.

const BUCKET = 'Reportes'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function checkCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (auth.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
}

export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const force = req.nextUrl.searchParams.get('force') === '1'
  const service = sb()

  try {
    // Idempotencia: no regenerar si ya hay un reporte de esta semana.
    if (!force) {
      const hace5dias = new Date(Date.now() - 5 * 86_400_000).toISOString()
      const { data: reciente } = await service
        .from('reportes').select('numero,created_at')
        .gte('created_at', hace5dias).order('created_at', { ascending: false }).limit(1)
      if (reciente?.length) {
        return NextResponse.json({ ok: true, skipped: `ya existe el reporte #${reciente[0].numero} de esta semana` })
      }
    }

    const datos = await reunirDatos()
    const salida = await generarInformeHtml({ ...datos, conNarrativa: true })

    // Control de calidad — decide publicar en vivo vs dejar borrador.
    const narrativasOk = salida.narrativaError == null
    const datosOk = salida.precios === 13 && salida.conMotor >= 1
    const publicar = narrativasOk && datosOk
    const motivo = publicar ? null
      : [!narrativasOk ? `narrativas: ${salida.narrativaError}` : null,
         salida.precios !== 13 ? `precios ${salida.precios}/13` : null,
         salida.conMotor < 1 ? 'motor sin respuesta' : null].filter(Boolean).join('; ')

    // Render + subida.
    const pdf = await htmlAPdf(salida.html)
    const num3 = String(salida.numero).padStart(3, '0')
    const objPath = `${Date.now()}-research-${num3}.pdf`
    const { error: upErr } = await service.storage.from(BUCKET)
      .upload(objPath, pdf, { contentType: 'application/pdf', upsert: true })
    if (upErr) throw new Error(`subida: ${upErr.message}`)
    const { data: { publicUrl } } = service.storage.from(BUCKET).getPublicUrl(objPath)

    const hoy = new Date().toISOString().slice(0, 10)
    const { data: fila, error: insErr } = await service.from('reportes').insert({
      numero: salida.numero,
      titulo: `SIGMA Research #${num3}`,
      fecha: hoy,
      descripcion: `Research semanal ${salida.semana}. ${salida.conMotor}/13 con lectura del motor, ${salida.ejecutables} ejecutables. Generado automáticamente.`,
      url_pdf: publicUrl,
      activo: publicar,
    }).select().single()
    if (insErr) throw new Error(`insert: ${insErr.message}`)

    console.log('[cron/research-semanal]', new Date().toISOString(), {
      numero: salida.numero, publicado: publicar, motivo, bytes: pdf.length,
    })

    return NextResponse.json({
      ok: true,
      numero: salida.numero,
      id: fila.id,
      publicado: publicar,
      estado: publicar ? 'PUBLICADO (visible para usuarios)' : 'BORRADOR (oculto, revisar en el admin)',
      motivoBorrador: motivo,
      precios: `${salida.precios}/13`,
      conMotor: salida.conMotor,
      pdfKB: Math.round(pdf.length / 1024),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/research-semanal] error:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
