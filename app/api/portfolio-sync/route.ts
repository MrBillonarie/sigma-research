export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getFuturesBalanceUSD, getSpotBalanceUSD } from '@/lib/binanceBalance'
import { getIbkrNetLiquidationUSD } from '@/lib/ibkrFlex'

function makeSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const sb = makeSb()
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'No auth' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await sb.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { platform } = await req.json().catch(() => ({})) as { platform?: string }
    if (platform !== 'binance' && platform !== 'ibkr') {
      return NextResponse.json({ error: 'platform debe ser "binance" o "ibkr"' }, { status: 400 })
    }

    const { data: config } = await sb
      .from('user_config')
      .select('binance_api_key, binance_api_secret, ibkr_flex_token, ibkr_query_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (platform === 'binance') {
      if (!config?.binance_api_key || !config?.binance_api_secret) {
        return NextResponse.json({ error: 'No hay API keys de Binance configuradas.' }, { status: 400 })
      }
      const creds = { apiKey: config.binance_api_key, apiSecret: config.binance_api_secret }
      const [futures, spot] = await Promise.all([getFuturesBalanceUSD(creds), getSpotBalanceUSD(creds)])

      if (!futures.ok && !spot.ok) {
        return NextResponse.json({ error: futures.error }, { status: 400 })
      }
      const payload: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() }
      if (futures.ok) payload.binance_futures = futures.usd
      if (spot.ok)    payload.binance_spot    = spot.usd
      const { error: upErr } = await sb.from('portfolio').upsert(payload, { onConflict: 'user_id' })
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

      return NextResponse.json({
        ok: true,
        binance_futures: futures.ok ? futures.usd : null,
        binance_spot:    spot.ok    ? spot.usd    : null,
        warning: !futures.ok ? `Futures: ${futures.error}` : !spot.ok ? `Spot: ${spot.error}` : null,
      })
    }

    // platform === 'ibkr'
    if (!config?.ibkr_flex_token || !config?.ibkr_query_id) {
      return NextResponse.json({ error: 'No hay credenciales de IBKR Flex Query configuradas.' }, { status: 400 })
    }
    const result = await getIbkrNetLiquidationUSD(config.ibkr_flex_token, config.ibkr_query_id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    const { error: upErr } = await sb
      .from('portfolio')
      .upsert({ user_id: user.id, ibkr: result.usd, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, ibkr: result.usd })
  } catch (err) {
    console.error('[/api/portfolio-sync]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
