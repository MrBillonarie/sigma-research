export const dynamic     = 'force-dynamic'
export const runtime     = 'nodejs'
export const maxDuration = 90

import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { reunirDatos } from '@/lib/researchData'
import { generarInformeHtml } from '@/lib/researchReportHtml'

// Informe semanal completo (11 páginas, plantilla Terminal) listo para imprimir
// a PDF desde el navegador. Reúne los datos duros y llama al generador; las
// narrativas las redacta Claude si `?narrativa=1`.

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conNarrativa = req.nextUrl.searchParams.get('narrativa') === '1'
  const override = req.nextUrl.searchParams.get('numero')

  try {
    const usarClaude = req.nextUrl.searchParams.get('claude') === '1'
    const datos = await reunirDatos(override ? parseInt(override, 10) : undefined)
    const salida = await generarInformeHtml({ ...datos, conNarrativa, usarClaude })

    return new NextResponse(salida.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Informe-Numero': String(salida.numero),
        'X-Informe-Precios': `${salida.precios}/13`,
        'X-Informe-Motor': `${salida.conMotor} (${salida.ejecutables} ejecutables)`,
        'X-Informe-Narrativa': salida.narrativaError ? `error: ${encodeURIComponent(salida.narrativaError)}` : (conNarrativa ? 'ok' : 'omitida'),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[admin/reportes/imprimir]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
