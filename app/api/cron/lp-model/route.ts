import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAutoModel } from '@/lib/lp-auto-model'

// GET /api/cron/lp-model — dry-run for debugging, no DB writes
export async function GET() {
  try {
    const result = await runAutoModel()
    return NextResponse.json({ ok: true, result })
  } catch (e: unknown) {
    const msg   = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack   : undefined
    return NextResponse.json({ ok: false, error: msg, stack }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const result = await runAutoModel()

    // Sin señal → desactivar la señal activa (si la hubiera) y terminar
    if (!result.shouldSignal || result.hyp === 'none') {
      await supabase
        .from('lp_signals')
        .update({ is_active: false })
        .eq('is_active', true)
        .eq('requires_approval', false)

      return NextResponse.json({
        action:  'no_signal',
        regime:  result.regime.regime,
        score:   result.regimeScore,
      })
    }

    // Evitar duplicados: no crear si ya hay una señal pendiente de las últimas 3h
    const { data: recent } = await supabase
      .from('lp_signals')
      .select('id, created_at')
      .eq('requires_approval', true)
      .is('rejected_at', null)
      .gte('created_at', new Date(Date.now() - 3 * 3600 * 1000).toISOString())
      .maybeSingle()

    if (recent) {
      return NextResponse.json({ action: 'skipped', reason: 'pending_approval_exists' })
    }

    // Insertar señal pendiente de aprobación
    const { data, error } = await supabase
      .from('lp_signals')
      .insert({
        hyp:               result.hyp,
        hyp_text:          result.hypText,
        pool:              result.pool,
        fee_tier:          result.feeTier,
        range_low_pct:     result.rangeLowPct,
        range_high_pct:    result.rangeHighPct,
        kelly_pct:         result.kellyPct,
        vol_daily_m:       result.volDailyM,
        days_projected:    result.daysProjected,
        ref_price:         result.refPrice,
        tick_lower:        result.tickLower,
        tick_upper:        result.tickUpper,
        is_active:         false,
        requires_approval: true,
        source:            'auto',
        regime_score:      result.regimeScore,
        atr_24h_pct:       result.atr24hPct,
        raw_pool_data:     result.rawPoolData,
        expires_at:        new Date(Date.now() + result.daysProjected * 86_400_000).toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ action: 'signal_pending', signalId: data.id })
  } catch (e: unknown) {
    const msg   = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack   : undefined
    console.error('[cron/lp-model]', msg, stack)
    return NextResponse.json({ error: msg, stack }, { status: 500 })
  }
}
