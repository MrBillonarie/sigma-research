// Reúne los datos duros del research (motor, calendario, Binance, número de
// edición) para alimentar al generador del informe. Lo usan tanto la ruta de
// impresión manual como el cron semanal, para que no diverjan.

import { createClient } from '@supabase/supabase-js'
import { resultadosBinance } from './researchBinance'
import type { SignalVps, RegimeVps, EventoRaw } from './researchReportHtml'
import type { BinanceResumen } from './researchBinance'

const VPS = process.env.VPS_INTERNAL ?? process.env.VPS_URL ?? 'http://127.0.0.1:8080'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Lunes/viernes de la próxima semana operativa (mismo criterio que el generador). */
export function semanaObjetivo(hoy = new Date()): { lun: string; vie: string } {
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
  const dow = d.getUTCDay()
  if (dow !== 1) d.setUTCDate(d.getUTCDate() + ((8 - dow) % 7))
  const vie = new Date(d.getTime()); vie.setUTCDate(vie.getUTCDate() + 4)
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  return { lun: iso(d), vie: iso(vie) }
}

export interface DatosInforme {
  ultimoNumero: number
  regimenGlobal: string | null
  signals: SignalVps[]
  regimes: Record<string, RegimeVps>
  eventos: EventoRaw[]
  binance: BinanceResumen
}

export async function reunirDatos(numeroOverride?: number): Promise<DatosInforme> {
  const { lun, vie } = semanaObjetivo()

  let ultimoNumero: number
  if (numeroOverride && Number.isFinite(numeroOverride)) {
    ultimoNumero = numeroOverride - 1
  } else {
    const { data } = await sb().from('reportes').select('numero').order('numero', { ascending: false }).limit(1)
    ultimoNumero = data?.[0]?.numero ?? 0
  }

  const [motor, eventos, binance] = await Promise.all([
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

  return { ultimoNumero, regimenGlobal: motor.regimenGlobal, signals: motor.signals, regimes: motor.regimes, eventos, binance }
}
