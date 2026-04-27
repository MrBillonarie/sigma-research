export const revalidate = 3600

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PER_PAGE = 50

interface EtfRow {
  ticker:         string
  nombre:         string
  descripcion:    string | null
  indice:         string | null
  exposicion:     string | null
  sector:         string | null
  divisa:         string | null
  aum:            number | null
  volumen_avg:    number | null
  expense_ratio:  number | null
  dividend_yield: number | null
  precio:         number | null
  rent_1m:        number | null
  rent_3m:        number | null
  rent_12m:       number | null
  rent_3a:        number | null
  updated_at:     string | null
}

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const SORT_MAP: Record<string, string> = {
  ticker:   'ticker',
  nombre:   'nombre',
  r1m:      'rent_1m',
  r3m:      'rent_3m',
  r12m:     'rent_12m',
  r3a:      'rent_3a',
  tac:      'expense_ratio',
  aum:      'aum',
  precio:   'precio',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search     = (searchParams.get('search')     ?? '').trim()
  const exposicion = (searchParams.get('exposicion') ?? '').trim()
  const sector     = (searchParams.get('sector')     ?? '').trim()
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const sortKey    = searchParams.get('sort') ?? 'r12m'
  const sortDir    = searchParams.get('dir')  === 'asc'
  const exportAll  = searchParams.get('export') === 'csv'

  const db  = sb()
  const col = SORT_MAP[sortKey] ?? 'rent_12m'

  let q = db
    .from('etfs')
    .select('*', { count: 'exact' })
    .order(col, { ascending: sortDir, nullsFirst: sortDir })

  if (!exportAll) q = q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
  if (search)     q = q.or(`ticker.ilike.%${search}%,nombre.ilike.%${search}%`)
  if (exposicion) q = q.eq('exposicion', exposicion)
  if (sector)     q = q.eq('sector', sector)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  // ── CSV export ──────────────────────────────────────────────────────────────
  if (exportAll) {
    const rows = (data ?? []).map((e: EtfRow) => ({
      ticker:   e.ticker,
      nombre:   e.nombre,
      exposicion: e.exposicion ?? '',
      sector:   e.sector ?? '',
      indice:   e.indice ?? '',
      precio:   e.precio ?? '',
      r1m:      e.rent_1m  ?? '',
      r3m:      e.rent_3m  ?? '',
      r12m:     e.rent_12m ?? '',
      r3a:      e.rent_3a  ?? '',
      tac:      e.expense_ratio  ?? '',
      yield:    e.dividend_yield ?? '',
      aum:      e.aum ?? '',
    }))
    const header = 'Ticker,Nombre,Exposición,Sector,Índice,Precio USD,1M%,3M%,12M%,3A%,Expense Ratio%,Dividend Yield%,AUM USD'
    const csv = [header, ...rows.map(r =>
      [r.ticker, r.nombre, r.exposicion, r.sector, r.indice, r.precio, r.r1m, r.r3m, r.r12m, r.r3a, r.tac, r.yield, r.aum]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )].join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="etfs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  // Top por grupo de exposición (1 ETF por grupo, mejor 12M)
  const [topUSA, topGlobal, topEM, topSector] = await Promise.all([
    db.from('etfs').select('ticker,nombre,rent_12m,exposicion,sector').eq('exposicion', 'USA').is('sector', null).not('rent_12m', 'is', null).order('rent_12m', { ascending: false }).limit(1).maybeSingle(),
    db.from('etfs').select('ticker,nombre,rent_12m,exposicion,sector').in('exposicion', ['Global', 'Global ex USA']).is('sector', null).not('rent_12m', 'is', null).order('rent_12m', { ascending: false }).limit(1).maybeSingle(),
    db.from('etfs').select('ticker,nombre,rent_12m,exposicion,sector').in('exposicion', ['Emergentes', 'Latam', 'Brasil', 'Chile']).not('rent_12m', 'is', null).order('rent_12m', { ascending: false }).limit(1).maybeSingle(),
    db.from('etfs').select('ticker,nombre,rent_12m,exposicion,sector').not('sector', 'is', null).neq('sector', 'Renta Fija').not('rent_12m', 'is', null).order('rent_12m', { ascending: false }).limit(1).maybeSingle(),
  ])
  const toCard = (grupo: string, res: typeof topUSA) => {
    const row = res.data as Pick<EtfRow, 'ticker' | 'nombre' | 'rent_12m' | 'exposicion' | 'sector'> | null
    return { grupo, ticker: row?.ticker ?? null, nombre: row?.nombre ?? null, r12m: row?.rent_12m ?? null, exposicion: row?.exposicion ?? null, sector: row?.sector ?? null }
  }
  const topCards = [
    toCard('USA',        topUSA),
    toCard('Global',     topGlobal),
    toCard('Emergentes', topEM),
    toCard('Sectores',   topSector),
  ]

  // Filtros disponibles
  const { data: exposiciones } = await db.from('etfs').select('exposicion').order('exposicion')
  const { data: sectores }     = await db.from('etfs').select('sector').not('sector', 'is', null).order('sector')

  const uniqueExposiciones = Array.from(new Set((exposiciones ?? []).map((r: Pick<EtfRow, 'exposicion'>) => r.exposicion).filter(Boolean)))
  const uniqueSectores     = Array.from(new Set((sectores     ?? []).map((r: Pick<EtfRow, 'sector'>)     => r.sector    ).filter(Boolean)))

  const { data: lastRow } = await db
    .from('etfs')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const etfs = (data ?? []).map((e: EtfRow) => ({
    ticker:        e.ticker,
    nombre:        e.nombre,
    descripcion:   e.descripcion,
    indice:        e.indice,
    exposicion:    e.exposicion,
    sector:        e.sector,
    divisa:        e.divisa ?? 'USD',
    aum:           e.aum,
    volumen_avg:   e.volumen_avg,
    expense_ratio: e.expense_ratio,
    dividend_yield: e.dividend_yield,
    precio:        e.precio,
    r1m:           e.rent_1m,
    r3m:           e.rent_3m,
    r12m:          e.rent_12m,
    r3a:           e.rent_3a,
  }))

  const total = count ?? 0
  return NextResponse.json({
    ok: true,
    data: etfs,
    total, page,
    pages: Math.ceil(total / PER_PAGE),
    topCards,
    exposiciones: uniqueExposiciones,
    sectores:     uniqueSectores,
    ultima_actualizacion: lastRow?.updated_at ?? null,
  })
}
