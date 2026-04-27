export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// Genera señales para los 3 perfiles cada día de trading.
// Esto acumula datos en signal_history con price_at_signal, conditions_met y regime,
// que el cron motor-accuracy usa 22+ días después para medir accuracy.

import { NextRequest, NextResponse } from 'next/server'

const PROFILES  = ['retail', 'trader', 'institucional'] as const
const BASE_URL  = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000'

export async function GET(req: NextRequest) {
  // Vercel valida esta cabecera automáticamente en Hobby/Pro
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, string> = {}

  for (const profile of PROFILES) {
    try {
      // Llamar al endpoint principal del motor para cada perfil.
      // El handler ya llama a saveSignalHistory() internamente con precio y contexto.
      const res = await fetch(`${BASE_URL}/api/motor/signals?profile=${profile}`, {
        headers: { 'x-cron': '1' },
        cache:   'no-store',
      })
      results[profile] = res.ok ? `ok (${res.status})` : `error (${res.status})`
    } catch (e) {
      results[profile] = `exception: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  console.log('[cron/motor-signals]', new Date().toISOString(), results)
  return NextResponse.json({ ok: true, results, ts: new Date().toISOString() })
}
