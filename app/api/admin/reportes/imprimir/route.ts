export const dynamic     = 'force-dynamic'
export const runtime     = 'nodejs'
export const maxDuration = 90

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/adminAuth'
import { resultadosBinance } from '@/lib/researchBinance'
import { generarInformeHtml, type SignalVps, type RegimeVps, type EventoRaw } from '@/lib/researchReportHtml'

// Informe semanal completo (11 páginas, plantilla Terminal) listo para imprimir
// a PDF desde el navegador. Reúne los datos duros y llama al generador; las
// narrativas las redacta Claude si `?narrativa=1`.

const VPS = process.env.VPS_INTERNAL ?? process.env.VPS_URL ?? 'http://127.0.0.1:8080'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// Lunes/viernes de la próxima semana operativa (mismo criterio que el generador).
function semanaObjetivo(hoy = new Date()): { lun: string; vie: string } {
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
  const dow = d.getUTCDay()
  if (dow !== 1) d.setUTCDate(d.getUTCDate() + ((8 - dow) % 7))
  const vie = new Date(d.getTime()); vie.setUTCDate(vie.getUTCDate() + 4)
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  return { lun: iso(d), vie: iso(vie) }
}

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conNarrativa = req.nextUrl.searchParams.get('narrativa') === '1'
  const override = req.nextUrl.searchParams.get('numero')

  try {
    const { lun, vie } = semanaObjetivo()

    // Número de edición: override, o la mayor publicada.
    let ultimoNumero: number
    if (override && Number.isFinite(parseInt(override, 10))) {
      ultimoNumero = parseInt(override, 10) - 1
    } else {
      const { data } = await sb().from('reportes').select('numero').order('numero', { ascending: false }).limit(1)
      ultimoNumero = data?.[0]?.numero ?? 0
    }

    // Motor + calendario + Binance en paralelo.
    const [motor, cal, binance] = await Promise.all([
      (async () => {
        try {
          const [rPub, rReg] = await Promise.all([
            fetch(`${VPS}/api/public`, { signal: AbortSignal.timeout(9000), cache: 'no-store' }),
            fetch(`${VPS}/api/regime`, { signal: AbortSignal.timeout(9000), cache: 'no-store' }),
          ])
          const pub = rPub.ok ? await rPub.json() : {}
          const reg = rReg.ok ? await rReg.json() : {}
          return {
            signals: [...(pub.signals ?? []), ...(pub.top_models ?? [])] as SignalVps[],
            regimes: (reg ?? {}) as Record<string, RegimeVps>,
            regimenGlobal: typeof pub.regime === 'string' ? pub.regime : null,
          }
        } catch {
          return { signals: [] as SignalVps[], regimes: {} as Record<string, RegimeVps>, regimenGlobal: null }
        }
      })(),
      (async () => {
        const { data } = await sb()
          .from('macro_events')
          .select('title,impact,event_date,event_time,description,source')
          .gte('event_date', lun).lte('event_date', vie)
          .order('event_date', { ascending: true })
        return (data ?? []) as EventoRaw[]
      })(),
      resultadosBinance(7),
    ])

    const salida = await generarInformeHtml({
      ultimoNumero,
      regimenGlobal: motor.regimenGlobal,
      signals: motor.signals,
      regimes: motor.regimes,
      eventos: cal,
      binance,
      conNarrativa,
    })

    return new NextResponse(salida.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        // Diagnóstico para el admin sin ensuciar el HTML.
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
