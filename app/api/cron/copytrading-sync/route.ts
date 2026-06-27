export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { toBinanceSymbol, directionToSide, computeSizeUsd } from '@/lib/copytrading'
import { placeFuturesMarketOrder, getSymbolInfo, roundToStepSize } from '@/lib/binanceFutures'

const VPS  = process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'
const PASS = '0808'

function makeSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
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

async function getMotorAuthCookie(): Promise<string> {
  const res = await fetch(`${VPS}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `pwd=${PASS}`,
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  })
  const cookie = res.headers.get('set-cookie') ?? ''
  const match = cookie.match(/([^;]+)/)
  return match ? match[1] : ''
}

interface OpenPosition {
  sym: string
  tf: string
  direction: string
  kelly_pct: number
  opened_at: string
}

export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = makeSb()
  const results: Record<string, unknown>[] = []

  // 1. Posiciones abiertas reales del motor (mismo origen que /api/vps/trades)
  let open: Record<string, OpenPosition> = {}
  try {
    const cookie = await getMotorAuthCookie()
    const res = await fetch(`${VPS}/api/trades`, {
      headers: cookie ? { Cookie: cookie } : {},
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    const data = await res.json()
    open = data.open ?? {}
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer el motor: ${String(e)}` }, { status: 502 })
  }

  // 2. Usuarios inscritos en copytrading con capital y keys configuradas
  const { data: users, error: usersErr } = await sb
    .from('user_config')
    .select('user_id, binance_api_key, binance_api_secret, copytrading_capital_usd')
    .eq('copytrading_enabled', true)
    .gt('copytrading_capital_usd', 0)
    .not('binance_api_key', 'is', null)

  if (usersErr) {
    return NextResponse.json({ error: usersErr.message }, { status: 500 })
  }
  if (!users || users.length === 0) {
    return NextResponse.json({ ok: true, positions: Object.keys(open).length, users: 0, results: [] })
  }

  // 3. Por cada posición abierta del motor, por cada usuario inscrito
  for (const [posKey, pos] of Object.entries(open)) {
    const binanceSymbol = toBinanceSymbol(pos.sym)

    for (const user of users) {
      if (!binanceSymbol) {
        results.push({ posKey, user_id: user.user_id, status: 'skipped_no_pair', motor_sym: pos.sym })
        continue
      }

      // Dedupe: ¿ya se ejecutó esta apertura para este usuario?
      const { data: existing } = await sb
        .from('copytrading_log')
        .select('id')
        .eq('user_id', user.user_id)
        .eq('motor_sym', pos.sym)
        .eq('motor_tf', pos.tf)
        .eq('status', 'executed')
        .gte('created_at', new Date(new Date(pos.opened_at).getTime() - 5 * 60_000).toISOString())
        .limit(1)

      if (existing && existing.length > 0) {
        continue // ya copiada, no duplicar la orden
      }

      const sizeUsd = computeSizeUsd(pos.kelly_pct, user.copytrading_capital_usd)
      const symbolInfo = await getSymbolInfo(binanceSymbol)

      if (!symbolInfo || sizeUsd <= 0) {
        await sb.from('copytrading_log').insert({
          user_id: user.user_id, motor_sym: pos.sym, motor_tf: pos.tf,
          direction: pos.direction, binance_symbol: binanceSymbol, size_usd: sizeUsd,
          status: 'skipped_no_capital',
        })
        results.push({ posKey, user_id: user.user_id, status: 'skipped_no_capital' })
        continue
      }

      const quantity = roundToStepSize(sizeUsd / symbolInfo.price, symbolInfo.stepSize)
      if (quantity <= 0) {
        await sb.from('copytrading_log').insert({
          user_id: user.user_id, motor_sym: pos.sym, motor_tf: pos.tf,
          direction: pos.direction, binance_symbol: binanceSymbol, size_usd: sizeUsd,
          status: 'skipped_no_capital', detail: { reason: 'quantity rounds to 0' },
        })
        continue
      }

      const order = await placeFuturesMarketOrder(
        { apiKey: user.binance_api_key, apiSecret: user.binance_api_secret },
        binanceSymbol,
        directionToSide(pos.direction),
        quantity
      )

      await sb.from('copytrading_log').insert({
        user_id: user.user_id, motor_sym: pos.sym, motor_tf: pos.tf,
        direction: pos.direction, binance_symbol: binanceSymbol, size_usd: sizeUsd,
        status: order.ok ? 'executed' : 'error',
        binance_order_id: order.ok ? String(order.orderId) : null,
        detail: order.ok ? null : { error: order.error },
      })

      results.push({
        posKey, user_id: user.user_id, binanceSymbol, quantity, sizeUsd,
        status: order.ok ? 'executed' : 'error',
      })
    }
  }

  return NextResponse.json({ ok: true, positions: Object.keys(open).length, users: users.length, results })
}
