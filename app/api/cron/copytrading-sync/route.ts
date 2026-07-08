export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

function checkCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (auth.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
}

// 2026-07-08: DESACTIVADO PERMANENTEMENTE. Decisión de producto: Sigma nunca
// custodia API keys de terceros para operar en su nombre — el copytrading
// real es vía Binance Copy Trading (Lead Trader), donde Binance mantiene
// el control de fondos y permisos en todo momento. Este endpoint colocaba
// órdenes reales usando llaves guardadas en user_config; las credenciales
// ya guardadas (2 filas) fueron purgadas y el formulario de onboarding que
// las capturaba fue removido. La lógica de ejecución fue eliminada por
// completo (no solo comentada) para no dejar código muerto que dependa de
// que el cron siga deshabilitado como única protección.
export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ disabled: true, reason: 'copytrading via Binance Lead Trader unicamente' })
}
