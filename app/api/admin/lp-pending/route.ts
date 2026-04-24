import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Señales pendientes de aprobación (no rechazadas, no aprobadas)
  const { data: pending, error: e1 } = await supabase
    .from('lp_signals')
    .select('*')
    .eq('requires_approval', true)
    .is('rejected_at', null)
    .is('approved_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  // Señal activa actual
  const { data: active, error: e2 } = await supabase
    .from('lp_signals')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()

  // Últimas 10 señales (historial)
  const { data: history, error: e3 } = await supabase
    .from('lp_signals')
    .select('id, created_at, hyp, pool, is_active, approved_at, rejected_at, source, regime_score')
    .order('created_at', { ascending: false })
    .limit(10)

  if (e1 || e2 || e3) {
    return NextResponse.json({ error: e1 ?? e2 ?? e3 }, { status: 500 })
  }

  return NextResponse.json({ pending, active, history })
}
