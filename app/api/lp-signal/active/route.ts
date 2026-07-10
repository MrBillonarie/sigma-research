export const dynamic    = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPlanInfo } from '@/lib/plan'

export async function GET() {
  // Regla de planes: la calculadora LP de /lp-defi es libre; la señal del
  // MODELO (rangos + Kelly generados por el cron y aprobados por admin) es PRO.
  const { userId, isPro } = await getPlanInfo()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPro) {
    return NextResponse.json(
      { error: 'Las señales LP del modelo requieren plan PRO.', gated: true },
      { status: 403 }
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('lp_signals')
    .select('id, hyp, hyp_text, pool, fee_tier, range_low_pct, range_high_pct, kelly_pct, days_projected, ref_price, created_at, expires_at')
    .eq('is_active', true)
    .eq('requires_approval', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    // Table doesn't exist yet — return no-signal state gracefully
    if (error.code === '42P01') return NextResponse.json({ signal: null })
    return NextResponse.json({ error: 'Error fetching signal' }, { status: 500 })
  }
  return NextResponse.json({ signal: data })
}
