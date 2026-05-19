export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// Mide outcomes diariamente para señales ≥22 días con price_at_signal.
// Llama a /api/motor/accuracy que:
//   1. Fetcha precios actuales (Yahoo + Binance)
//   2. Calcula outcome_return y outcome_correct
//   3. Persiste en signal_history
// Con esto el ciclo de retroalimentación es completamente automático.

import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
if (!BASE_URL) throw new Error('[motor-accuracy] NEXT_PUBLIC_APP_URL no definida')

export async function GET(req: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET || req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const res  = await fetch(`${BASE_URL}/api/motor/accuracy`, { cache: 'no-store' })
    const json = await res.json()

    console.log('[cron/motor-accuracy]', new Date().toISOString(), {
      measured:     json.measured,
      pendingCount: json.pendingCount,
      overall:      json.overall,
    })

    return NextResponse.json({ ok: true, ts: new Date().toISOString(), ...json })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/motor-accuracy] error:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
