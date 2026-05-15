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

// Escapa caracteres especiales de PostgreSQL LIKE/ILIKE para evitar comportamiento inesperado
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, c => `\\${c}`)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = escapeLike((searchParams.get('search') ?? '').trim().slice(0, 100))
  const agf    = (searchParams.get('agf')    ?? '').trim().slice(0, 100)
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
  if (error) return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })

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

  // ── Seed fallback cuando DB está vacía ──────────────────────────────────────
  if (total === 0 && !search && !agf && !tipo) {
    const seedFondos = SEED_FONDOS
    const seedTop = ['renta fija', 'conservador', 'moderado', 'agresivo'].map(cat => {
      const best = seedFondos.filter(f => f.tipo === cat).sort((a, b) => (b.r1a ?? 0) - (a.r1a ?? 0))[0]
      return { categoria: cat, nombre: best?.nombre ?? null, adm: best?.adm ?? null, r12m: best?.r1a ?? null }
    })
    const seedAgfs = Array.from(new Set(seedFondos.map(f => f.adm)))
    return NextResponse.json({
      ok: true, data: seedFondos, total: seedFondos.length, page: 1,
      pages: 1, liveCount: seedFondos.length,
      agfs: seedAgfs, ultima_actualizacion: null,
      topPorCategoria: seedTop, isSeed: true,
    })
  }

  return NextResponse.json({
    ok: true, data: fondos, total, page,
    pages: Math.ceil(total / PER_PAGE),
    liveCount: fondos.length,
    agfs: (agfList ?? []).map((a: { nombre: string }) => a.nombre),
    ultima_actualizacion: lastRow?.updated_at ?? null,
    topPorCategoria,
  })
}

// ── Seed data — Fondos Mutuos chilenos representativos ────────────────────
const SEED_FONDOS = [
  { nombre: 'Fintual Prudente Pizarro',    adm: 'Fintual',          tipo: 'renta fija',  riesgo: 1, r1m: 0.4,  r3m: 1.2,  r1a: 5.8,  r3a: 4.2,  tac: 0.49, minCLP: 1000, source: 'seed' as const },
  { nombre: 'Fintual Risky Norris',         adm: 'Fintual',          tipo: 'agresivo',    riesgo: 5, r1m: 3.1,  r3m: 8.4,  r1a: 28.6, r3a: 12.1, tac: 1.19, minCLP: 1000, source: 'seed' as const },
  { nombre: 'Fintual Moderate Clooney',     adm: 'Fintual',          tipo: 'moderado',    riesgo: 3, r1m: 1.8,  r3m: 4.9,  r1a: 16.2, r3a: 8.4,  tac: 0.79, minCLP: 1000, source: 'seed' as const },
  { nombre: 'Fintual Conservador Prat',     adm: 'Fintual',          tipo: 'conservador', riesgo: 2, r1m: 0.6,  r3m: 1.8,  r1a: 7.4,  r3a: 5.1,  tac: 0.59, minCLP: 1000, source: 'seed' as const },
  { nombre: 'BTG Pactual Renta Fija CLP',  adm: 'BTG Pactual',      tipo: 'renta fija',  riesgo: 1, r1m: 0.38, r3m: 1.15, r1a: 5.2,  r3a: 3.9,  tac: 0.60, minCLP: 500000, source: 'seed' as const },
  { nombre: 'BTG Pactual Acciones Chile',  adm: 'BTG Pactual',      tipo: 'agresivo',    riesgo: 5, r1m: 1.2,  r3m: 3.8,  r1a: 11.4, r3a: 4.8,  tac: 1.50, minCLP: 500000, source: 'seed' as const },
  { nombre: 'Banchile Fondos Acciones',    adm: 'Banchile',         tipo: 'agresivo',    riesgo: 5, r1m: 1.5,  r3m: 4.2,  r1a: 13.8, r3a: 5.6,  tac: 1.79, minCLP: 100000, source: 'seed' as const },
  { nombre: 'Banchile Renta Nominal',      adm: 'Banchile',         tipo: 'renta fija',  riesgo: 1, r1m: 0.42, r3m: 1.25, r1a: 5.6,  r3a: 4.1,  tac: 0.55, minCLP: 100000, source: 'seed' as const },
  { nombre: 'Santander Acciones Chile',    adm: 'Santander AM',     tipo: 'agresivo',    riesgo: 5, r1m: 1.3,  r3m: 3.9,  r1a: 12.5, r3a: 5.1,  tac: 1.65, minCLP: 100000, source: 'seed' as const },
  { nombre: 'Santander Equilibrio',        adm: 'Santander AM',     tipo: 'moderado',    riesgo: 3, r1m: 1.0,  r3m: 3.1,  r1a: 10.8, r3a: 6.2,  tac: 1.10, minCLP: 100000, source: 'seed' as const },
  { nombre: 'LarrainVial Acciones USA',    adm: 'LarrainVial',      tipo: 'agresivo',    riesgo: 5, r1m: 3.8,  r3m: 9.1,  r1a: 32.4, r3a: 14.2, tac: 1.20, minCLP: 500000, source: 'seed' as const },
  { nombre: 'LarrainVial Renta Fija',      adm: 'LarrainVial',      tipo: 'renta fija',  riesgo: 1, r1m: 0.45, r3m: 1.35, r1a: 6.1,  r3a: 4.5,  tac: 0.65, minCLP: 500000, source: 'seed' as const },
  { nombre: 'Principal Moderado',          adm: 'Principal',        tipo: 'moderado',    riesgo: 3, r1m: 1.1,  r3m: 3.3,  r1a: 11.9, r3a: 6.8,  tac: 1.05, minCLP: 100000, source: 'seed' as const },
  { nombre: 'Itaú Acciones Globales',      adm: 'Itaú Asset Mgmt',  tipo: 'agresivo',    riesgo: 5, r1m: 2.9,  r3m: 7.8,  r1a: 26.4, r3a: 11.8, tac: 1.35, minCLP: 500000, source: 'seed' as const },
  { nombre: 'Scotiabank Mix Moderado',     adm: 'Scotiabank',       tipo: 'moderado',    riesgo: 3, r1m: 0.9,  r3m: 2.8,  r1a: 9.6,  r3a: 5.4,  tac: 1.15, minCLP: 100000, source: 'seed' as const },
]
