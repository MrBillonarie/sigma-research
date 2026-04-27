export const revalidate = 3600

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PER_PAGE = 50

interface FondoRow {
  nombre: string
  categoria: string | null
  rent_1m:  number | null
  rent_3m:  number | null
  rent_12m: number | null
  rent_3a:  number | null
  tac:      number | null
  agf:      { nombre: string } | null
}

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function riesgoFromCategoria(cat: string | null): number {
  switch ((cat ?? '').toLowerCase()) {
    case 'renta fija':  return 1
    case 'conservador': return 2
    case 'moderado':    return 3
    case 'agresivo':    return 5
    default:            return 3
  }
}

const SORT_MAP: Record<string, string> = {
  nombre: 'nombre',
  r1m:    'rent_1m',
  r3m:    'rent_3m',
  r12m:   'rent_12m',
  r3a:    'rent_3a',
  tac:    'tac',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') ?? '').trim()
  const agf    = (searchParams.get('agf')    ?? '').trim()
  const tipo   = (searchParams.get('tipo')   ?? '').trim()
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const sortKey     = searchParams.get('sort') ?? 'r12m'
  const sortDir     = searchParams.get('dir')  === 'asc'
  const exportAll   = searchParams.get('export') === 'csv'

  const db     = sb()
  const col    = SORT_MAP[sortKey] ?? 'rent_12m'
  const nullsFirst = sortDir ? true : false   // ASC → nulls first; DESC → nulls last

  // Resolver agf_id
  let agfId: string | null = null
  if (agf) {
    const { data: agfRow } = await db.from('agf').select('id').eq('nombre', agf).maybeSingle()
    agfId = agfRow?.id ?? null
    if (!agfId) return NextResponse.json({ ok: true, data: [], total: 0, page, pages: 0, liveCount: 0, agfs: [], ultima_actualizacion: null })
  }

  // Query principal
  let q = db
    .from('fondos_mutuos')
    .select('*, agf(nombre)', { count: 'exact' })
    .eq('activo', true)
    .order(col, { ascending: sortDir, nullsFirst })

  if (!exportAll) q = q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

  if (search) q = q.ilike('nombre', `%${search}%`)
  if (agfId)  q = q.eq('agf_id', agfId)
  if (tipo && tipo !== 'todos') {
    if (tipo === 'etf') q = q.ilike('nombre', '%ETF%')
    else                q = q.eq('categoria', tipo).not('nombre', 'ilike', '%ETF%')
  }

  const { data, count, error } = await q
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  // ── CSV export ────────────────────────────────────────────────────────────
  if (exportAll) {
    const rows = (data ?? []).map((f: FondoRow) => ({
      nombre:  f.nombre,
      adm:     (f.agf as { nombre: string } | null)?.nombre ?? '',
      tipo:    f.categoria ?? '',
      riesgo:  riesgoFromCategoria(f.categoria),
      r1m:     f.rent_1m  ?? '',
      r3m:     f.rent_3m  ?? '',
      r12m:    f.rent_12m ?? '',
      r3a:     f.rent_3a  ?? '',
      tac:     f.tac      ?? '',
    }))
    const header = 'Fondo,Administradora,Tipo,Riesgo,1M%,3M%,12M%,3A%,TAC%'
    const csv = [header, ...rows.map(r =>
      [r.nombre, r.adm, r.tipo, r.riesgo, r.r1m, r.r3m, r.r12m, r.r3a, r.tac]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )].join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="fondos-mutuos-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  // Lista AGFs
  const { data: agfList } = await db.from('agf').select('nombre').order('nombre')

  // Última sync
  const { data: lastRow } = await db
    .from('fondos_mutuos')
    .select('updated_at')
    .eq('activo', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Top por categoría (1 fondo por tipo, siempre ordenado por rent_12m desc)
  const CATEGORIAS = ['renta fija', 'conservador', 'moderado', 'agresivo']
  const topResults = await Promise.all(
    CATEGORIAS.map(cat => {
      const tq = db.from('fondos_mutuos')
        .select('nombre, rent_12m, agf(nombre)')
        .eq('activo', true)
        .eq('categoria', cat)
        .not('rent_12m', 'is', null)
        .not('nombre', 'ilike', '%ETF%')
        .order('rent_12m', { ascending: false })
        .limit(1)
      return tq.maybeSingle()
    })
  )
  const topPorCategoria = CATEGORIAS.map((cat, i) => {
    const row = topResults[i].data as FondoRow | null
    return {
      categoria: cat,
      nombre:    row?.nombre ?? null,
      adm:       (row?.agf as { nombre: string } | null)?.nombre ?? null,
      r12m:      row?.rent_12m ?? null,
    }
  })

  const fondos = (data ?? []).map((f: FondoRow) => ({
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
    ok: true, data: fondos, total, page,
    pages: Math.ceil(total / PER_PAGE),
    liveCount: fondos.length,
    agfs: (agfList ?? []).map((a: { nombre: string }) => a.nombre),
    ultima_actualizacion: lastRow?.updated_at ?? null,
    topPorCategoria,
  })
}
