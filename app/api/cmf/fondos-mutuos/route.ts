export const revalidate = 3600 // ISR: cache 1 hora por combinación de query params

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PER_PAGE = 50

// ─── Supabase server client (service role) ────────────────────────────────────
function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ─── Inferir nivel de riesgo desde categoría ─────────────────────────────────
function riesgoFromCategoria(cat: string | null): number {
  if (!cat) return 3
  switch (cat.toLowerCase()) {
    case 'renta fija':  return 1
    case 'conservador': return 2
    case 'moderado':    return 3
    case 'agresivo':    return 5
    default:            return 3
  }
}

// ─── GET /api/cmf/fondos-mutuos ───────────────────────────────────────────────
// Query params: search, agf, tipo, page
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') ?? '').trim()
  const agf    = (searchParams.get('agf')    ?? '').trim()
  const tipo   = (searchParams.get('tipo')   ?? '').trim()
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'))

  const db = sb()

  // ── Resolver agf_id si hay filtro por AGF ────────────────────────────────
  let agfId: string | null = null
  if (agf) {
    const { data: agfRow } = await db.from('agf').select('id').eq('nombre', agf).maybeSingle()
    agfId = agfRow?.id ?? null
    // Si el AGF no existe en la BD, retornar vacío en vez de ignorar el filtro
    if (!agfId) {
      return NextResponse.json({ ok: true, data: [], total: 0, page, pages: 0, liveCount: 0, agfs: [], ultima_actualizacion: null })
    }
  }

  // ── Query principal ───────────────────────────────────────────────────────
  let q = db
    .from('fondos_mutuos')
    .select('*, agf(nombre)', { count: 'exact' })
    .eq('activo', true)
    .order('rent_12m', { ascending: false, nullsFirst: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

  if (search)  q = q.ilike('nombre', `%${search}%`)
  if (agfId)   q = q.eq('agf_id', agfId)
  if (tipo && tipo !== 'todos') q = q.eq('categoria', tipo)

  const { data, count, error } = await q

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // ── Lista de AGFs para el dropdown ───────────────────────────────────────
  const { data: agfList } = await db.from('agf').select('nombre').order('nombre')

  // ── Fecha de última sincronización ────────────────────────────────────────
  const { data: lastRow } = await db
    .from('fondos_mutuos')
    .select('updated_at')
    .eq('activo', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Mapear al formato que consume la página ───────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fondos = (data ?? []).map((f: any) => ({
    nombre: f.nombre,
    adm:    (f.agf as { nombre: string } | null)?.nombre ?? '',
    tipo:   f.categoria ?? 'moderado',
    riesgo: riesgoFromCategoria(f.categoria),
    r1m:    f.rent_1m  ?? 0,
    r3m:    f.rent_3m  ?? 0,
    r1a:    f.rent_12m ?? 0,
    r3a:    f.rent_3a  ?? null,
    tac:    f.tac      ?? null,
    minCLP: 0,
    source: 'live' as const,
  }))

  const total = count ?? 0

  return NextResponse.json({
    ok:    true,
    data:  fondos,
    total,
    page,
    pages: Math.ceil(total / PER_PAGE),
    liveCount: fondos.length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agfs:  (agfList ?? []).map((a: any) => a.nombre),
    ultima_actualizacion: lastRow?.updated_at ?? null,
  })
}
