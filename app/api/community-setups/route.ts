export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Anon client for public reads — respects RLS
function makeAnonSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}

// Service client for authenticated writes
function makeSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const MIN_REP = 10

export async function GET() {
  const sb = makeAnonSb()
  const { data, error } = await sb
    .from('community_setups')
    .select('*, profiles(username, reputation)')
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })

  const filtered = (data ?? []).filter((s: { profiles?: { reputation?: number } }) => (s.profiles?.reputation ?? 0) >= MIN_REP)
  return NextResponse.json(filtered)
}

export async function POST(req: NextRequest) {
  const sb    = makeSb()
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('reputation')
    .eq('id', user.id)
    .maybeSingle()

  if ((profile?.reputation ?? 0) < MIN_REP) {
    return NextResponse.json({ error: `Necesitas al menos ${MIN_REP} puntos de reputación para publicar setups` }, { status: 403 })
  }

  const body = await req.json()
  const { par, tipo, entry, sl, tp, range_low, range_high, fee_tier, protocol, rr, timeframe, metodologia, nota, fecha } = body

  if (!par || !tipo) return NextResponse.json({ error: 'par y tipo son requeridos' }, { status: 400 })
  if (!['LONG', 'SHORT', 'LP'].includes(tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })

  // Sanitización: truncar strings para prevenir inyección y DoS
  const clean = (s: unknown, max: number) => typeof s === 'string' ? s.trim().slice(0, max) : undefined
  const parClean     = clean(par, 20)?.toUpperCase()
  const metClean     = clean(metodologia, 500)
  const notaClean    = clean(nota, 1000)
  const feeClean     = clean(fee_tier, 10)
  const protClean    = clean(protocol, 50)
  const tfClean      = clean(timeframe, 10)
  if (!parClean) return NextResponse.json({ error: 'par inválido' }, { status: 400 })

  const { data, error } = await sb
    .from('community_setups')
    .insert({
      user_id: user.id,
      par: parClean, tipo,
      entry:       tipo !== 'LP' ? (Number(entry) || null)      : null,
      sl:          tipo !== 'LP' ? (Number(sl) || null)          : null,
      tp:          tipo !== 'LP' ? (Number(tp) || null)          : null,
      range_low:   tipo === 'LP' ? (Number(range_low) || null)   : null,
      range_high:  tipo === 'LP' ? (Number(range_high) || null)  : null,
      fee_tier:    tipo === 'LP' ? (feeClean || null)            : null,
      protocol:    tipo === 'LP' ? (protClean || null)           : null,
      rr:          tipo !== 'LP' ? (Number(rr) || null)          : null,
      timeframe:   tfClean || null,
      metodologia: metClean || null,
      nota:        notaClean || null,
      fecha:       fecha ?? new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const sb    = makeSb()
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { setup_id, vote_type } = await req.json()
  if (!setup_id || !['up', 'down'].includes(vote_type))
    return NextResponse.json({ error: 'setup_id y vote_type (up/down) requeridos' }, { status: 400 })

  const { error } = await sb
    .from('setup_votes')
    .upsert({ user_id: user.id, setup_id, vote_type }, { onConflict: 'user_id,setup_id' })

  if (error) return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
