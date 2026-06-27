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
  r1m:            number | null
  r3m:            number | null
  r12m:           number | null
  r3a:            number | null
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
  r1m:      'r1m',
  r3m:      'r3m',
  r12m:     'r12m',
  r3a:      'r3a',
  tac:      'expense_ratio',
  aum:      'aum',
  precio:   'precio',
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, c => `\\${c}`)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search     = escapeLike((searchParams.get('search')     ?? '').trim().slice(0, 100))
  const exposicion = (searchParams.get('exposicion') ?? '').trim().slice(0, 50)
  const sector     = (searchParams.get('sector')     ?? '').trim().slice(0, 50)
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const sortKey    = searchParams.get('sort') ?? 'r12m'
  const sortDir    = searchParams.get('dir')  === 'asc'
  const exportAll  = searchParams.get('export') === 'csv'

  const db  = sb()
  const col = SORT_MAP[sortKey] ?? 'r12m'

  let q = db
    .from('etfs')
    .select('*', { count: 'exact' })
    .order(col, { ascending: sortDir, nullsFirst: sortDir })

  if (!exportAll) q = q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
  if (search)     q = q.or(`ticker.ilike.%${search}%,nombre.ilike.%${search}%`)
  if (exposicion) q = q.eq('exposicion', exposicion)
  if (sector)     q = q.eq('sector', sector)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })

  // ── CSV export ──────────────────────────────────────────────────────────────
  if (exportAll) {
    const rows = (data ?? []).map((e: EtfRow) => ({
      ticker:   e.ticker,
      nombre:   e.nombre,
      exposicion: e.exposicion ?? '',
      sector:   e.sector ?? '',
      indice:   e.indice ?? '',
      precio:   e.precio ?? '',
      r1m:      e.r1m  ?? '',
      r3m:      e.r3m  ?? '',
      r12m:     e.r12m ?? '',
      r3a:      e.r3a  ?? '',
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
    db.from('etfs').select('ticker,nombre,r12m,exposicion,sector').eq('exposicion', 'USA').is('sector', null).not('r12m', 'is', null).order('r12m', { ascending: false }).limit(1).maybeSingle(),
    db.from('etfs').select('ticker,nombre,r12m,exposicion,sector').in('exposicion', ['Global', 'Global ex USA']).is('sector', null).not('r12m', 'is', null).order('r12m', { ascending: false }).limit(1).maybeSingle(),
    db.from('etfs').select('ticker,nombre,r12m,exposicion,sector').in('exposicion', ['Emergentes', 'Latam', 'Brasil', 'Chile']).not('r12m', 'is', null).order('r12m', { ascending: false }).limit(1).maybeSingle(),
    db.from('etfs').select('ticker,nombre,r12m,exposicion,sector').not('sector', 'is', null).neq('sector', 'Renta Fija').not('r12m', 'is', null).order('r12m', { ascending: false }).limit(1).maybeSingle(),
  ])
  const toCard = (grupo: string, res: typeof topUSA) => {
    const row = res.data as Pick<EtfRow, 'ticker' | 'nombre' | 'r12m' | 'exposicion' | 'sector'> | null
    return { grupo, ticker: row?.ticker ?? null, nombre: row?.nombre ?? null, r12m: row?.r12m ?? null, exposicion: row?.exposicion ?? null, sector: row?.sector ?? null }
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
    r1m:           e.r1m,
    r3m:           e.r3m,
    r12m:          e.r12m,
    r3a:           e.r3a,
  }))

  const total = count ?? 0

  // ── Seed fallback cuando DB está vacía ──────────────────────────────────────
  if (total === 0 && !search && !exposicion && !sector) {
    const seed = SEED_ETFS
    const seedExposiciones = Array.from(new Set(seed.map(e => e.exposicion).filter(Boolean)))
    const seedSectores     = Array.from(new Set(seed.map(e => e.sector).filter(Boolean)))
    const seedTopCards = [
      { grupo: 'USA',        ...bestOf(seed, e => e.exposicion === 'USA'        && !e.sector) },
      { grupo: 'Global',     ...bestOf(seed, e => e.exposicion === 'Global'     && !e.sector) },
      { grupo: 'Emergentes', ...bestOf(seed, e => e.exposicion === 'Emergentes' && !e.sector) },
      { grupo: 'Sectores',   ...bestOf(seed, e => !!e.sector && e.sector !== 'Renta Fija') },
    ]
    const sorted = [...seed].sort((a, b) => (b.r12m ?? 0) - (a.r12m ?? 0))
    return NextResponse.json({
      ok: true, data: sorted, total: seed.length, page: 1,
      pages: 1, topCards: seedTopCards,
      exposiciones: seedExposiciones, sectores: seedSectores,
      ultima_actualizacion: null, isSeed: true,
    })
  }

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

// ── Helpers ──────────────────────────────────────────────────────────────────
function bestOf(arr: typeof SEED_ETFS, fn: (e: typeof SEED_ETFS[0]) => boolean) {
  const match = arr.filter(fn).sort((a, b) => (b.r12m ?? 0) - (a.r12m ?? 0))[0]
  return { ticker: match?.ticker ?? null, nombre: match?.nombre ?? null, r12m: match?.r12m ?? null, exposicion: match?.exposicion ?? null, sector: match?.sector ?? null }
}

// ── Seed data — ETFs representativos (datos aproximados 2025-2026) ─────────
const SEED_ETFS = [
  { ticker: 'SPY',  nombre: 'SPDR S&P 500 ETF Trust',           descripcion: 'Replica el índice S&P 500 (500 mayores empresas USA)', indice: 'S&P 500',        exposicion: 'USA',        sector: null,        divisa: 'USD', aum: 550e9, volumen_avg: 80e6, expense_ratio: 0.0945, dividend_yield: 1.3, precio: 590,  r1m: 2.1,  r3m: 5.8,  r12m: 24.3, r3a: 10.2 },
  { ticker: 'QQQ',  nombre: 'Invesco Nasdaq-100 ETF',            descripcion: 'Replica el Nasdaq-100, dominado por tecnología',        indice: 'Nasdaq-100',     exposicion: 'USA',        sector: 'Tecnología', divisa: 'USD', aum: 280e9, volumen_avg: 45e6, expense_ratio: 0.20,   dividend_yield: 0.6, precio: 510,  r1m: 3.2,  r3m: 8.1,  r12m: 31.5, r3a: 12.4 },
  { ticker: 'VOO',  nombre: 'Vanguard S&P 500 ETF',              descripcion: 'S&P 500 de Vanguard con expense ratio mínimo',          indice: 'S&P 500',        exposicion: 'USA',        sector: null,        divisa: 'USD', aum: 450e9, volumen_avg: 20e6, expense_ratio: 0.03,   dividend_yield: 1.4, precio: 540,  r1m: 2.0,  r3m: 5.7,  r12m: 24.1, r3a: 10.1 },
  { ticker: 'VTI',  nombre: 'Vanguard Total Stock Market ETF',   descripcion: 'Mercado total de acciones USA (>3.800 empresas)',        indice: 'CRSP US Total',  exposicion: 'USA',        sector: null,        divisa: 'USD', aum: 380e9, volumen_avg: 8e6,  expense_ratio: 0.03,   dividend_yield: 1.4, precio: 258,  r1m: 1.9,  r3m: 5.5,  r12m: 23.6, r3a: 9.8  },
  { ticker: 'SCHD', nombre: 'Schwab US Dividend Equity ETF',     descripcion: 'Acciones USA con dividendos crecientes y calidad',      indice: 'Dow Jones US Div',exposicion: 'USA',        sector: null,        divisa: 'USD', aum: 60e9,  volumen_avg: 5e6,  expense_ratio: 0.06,   dividend_yield: 3.6, precio: 79,   r1m: 1.2,  r3m: 3.8,  r12m: 15.2, r3a: 8.1  },
  { ticker: 'JEPI', nombre: 'JPMorgan Equity Premium Income ETF',descripcion: 'Ingresos mensuales altos vía opciones cubiertas',        indice: null,             exposicion: 'USA',        sector: null,        divisa: 'USD', aum: 35e9,  volumen_avg: 6e6,  expense_ratio: 0.35,   dividend_yield: 7.2, precio: 57,   r1m: 0.8,  r3m: 2.1,  r12m: 9.4,  r3a: 5.2  },
  { ticker: 'IWM',  nombre: 'iShares Russell 2000 ETF',          descripcion: 'Pequeñas empresas americanas (Russell 2000)',           indice: 'Russell 2000',   exposicion: 'USA',        sector: null,        divisa: 'USD', aum: 70e9,  volumen_avg: 30e6, expense_ratio: 0.19,   dividend_yield: 1.2, precio: 220,  r1m: -0.5, r3m: 2.3,  r12m: 10.8, r3a: 4.3  },
  { ticker: 'VEA',  nombre: 'Vanguard FTSE Developed Markets ETF',descripcion:'Mercados desarrollados fuera de USA (Europa, Japón)',   indice: 'FTSE Dev ex US', exposicion: 'Global',     sector: null,        divisa: 'USD', aum: 115e9, volumen_avg: 10e6, expense_ratio: 0.05,   dividend_yield: 3.1, precio: 51,   r1m: 1.5,  r3m: 4.2,  r12m: 12.4, r3a: 4.8  },
  { ticker: 'VXUS', nombre: 'Vanguard Total International Stock ETF','descripcion':'Todo el mercado internacional excepto USA',         indice: 'FTSE Global ex US',exposicion:'Global ex USA',sector: null,       divisa: 'USD', aum: 70e9,  volumen_avg: 4e6,  expense_ratio: 0.07,   dividend_yield: 2.8, precio: 59,   r1m: 1.3,  r3m: 3.9,  r12m: 11.5, r3a: 4.2  },
  { ticker: 'VWO',  nombre: 'Vanguard FTSE Emerging Markets ETF', descripcion: 'Mercados emergentes: China, India, Brasil, Taiwan',    indice: 'FTSE Emerging',  exposicion: 'Emergentes', sector: null,        divisa: 'USD', aum: 80e9,  volumen_avg: 12e6, expense_ratio: 0.08,   dividend_yield: 2.9, precio: 44,   r1m: 0.9,  r3m: 2.8,  r12m: 8.7,  r3a: 2.1  },
  { ticker: 'EEM',  nombre: 'iShares MSCI Emerging Markets ETF',  descripcion: 'Exposición a economías emergentes vía MSCI',           indice: 'MSCI Emerging',  exposicion: 'Emergentes', sector: null,        divisa: 'USD', aum: 25e9,  volumen_avg: 25e6, expense_ratio: 0.70,   dividend_yield: 2.5, precio: 42,   r1m: 0.7,  r3m: 2.5,  r12m: 7.9,  r3a: 1.8  },
  { ticker: 'XLK',  nombre: 'Technology Select Sector SPDR Fund', descripcion: 'Sector tecnología del S&P 500 (Apple, MSFT, NVDA)',    indice: null,             exposicion: 'USA',        sector: 'Tecnología', divisa: 'USD', aum: 60e9,  volumen_avg: 10e6, expense_ratio: 0.09,   dividend_yield: 0.7, precio: 225,  r1m: 4.1,  r3m: 10.2, r12m: 38.2, r3a: 16.1 },
  { ticker: 'XLF',  nombre: 'Financial Select Sector SPDR Fund',  descripcion: 'Sector financiero del S&P 500 (JPM, BRK, BAC)',        indice: null,             exposicion: 'USA',        sector: 'Financiero', divisa: 'USD', aum: 38e9,  volumen_avg: 18e6, expense_ratio: 0.09,   dividend_yield: 1.7, precio: 45,   r1m: 1.8,  r3m: 4.6,  r12m: 20.4, r3a: 9.5  },
  { ticker: 'XLE',  nombre: 'Energy Select Sector SPDR Fund',     descripcion: 'Sector energía del S&P 500 (XOM, CVX, SLB)',          indice: null,             exposicion: 'USA',        sector: 'Energía',   divisa: 'USD', aum: 28e9,  volumen_avg: 12e6, expense_ratio: 0.09,   dividend_yield: 3.2, precio: 90,   r1m: -1.2, r3m: -2.8, r12m: 4.1,  r3a: 6.8  },
  { ticker: 'XLV',  nombre: 'Health Care Select Sector SPDR Fund',descripcion: 'Sector salud del S&P 500 (JNJ, UNH, LLY)',            indice: null,             exposicion: 'USA',        sector: 'Salud',     divisa: 'USD', aum: 35e9,  volumen_avg: 8e6,  expense_ratio: 0.09,   dividend_yield: 1.5, precio: 145,  r1m: 0.5,  r3m: 1.8,  r12m: 8.3,  r3a: 7.2  },
  { ticker: 'GLD',  nombre: 'SPDR Gold Shares',                   descripcion: 'Exposición directa al oro físico',                    indice: 'Gold Spot',      exposicion: 'Global',     sector: 'Materiales', divisa: 'USD', aum: 60e9,  volumen_avg: 9e6,  expense_ratio: 0.40,   dividend_yield: 0.0, precio: 240,  r1m: 3.5,  r3m: 9.8,  r12m: 28.5, r3a: 12.8 },
  { ticker: 'TLT',  nombre: 'iShares 20+ Year Treasury Bond ETF', descripcion: 'Bonos del Tesoro USA a largo plazo (>20 años)',        indice: 'ICE US Treasury',exposicion: 'USA',        sector: 'Renta Fija', divisa: 'USD', aum: 55e9,  volumen_avg: 20e6, expense_ratio: 0.15,   dividend_yield: 4.2, precio: 92,   r1m: 1.2,  r3m: -1.8, r12m: -5.2, r3a: -8.4 },
  { ticker: 'AGG',  nombre: 'iShares Core US Aggregate Bond ETF', descripcion: 'Mercado total de renta fija USA investment grade',     indice: 'Bloomberg US Agg',exposicion:'USA',         sector: 'Renta Fija', divisa: 'USD', aum: 95e9,  volumen_avg: 6e6,  expense_ratio: 0.03,   dividend_yield: 3.8, precio: 96,   r1m: 0.8,  r3m: 0.9,  r12m: 2.1,  r3a: -1.8 },
  { ticker: 'HYG',  nombre: 'iShares iBoxx $ High Yield Corp Bond',descripcion:'Bonos corporativos de alto rendimiento (high yield)',  indice: 'iBoxx $ Liq HY', exposicion: 'USA',        sector: 'Renta Fija', divisa: 'USD', aum: 15e9,  volumen_avg: 22e6, expense_ratio: 0.49,   dividend_yield: 6.4, precio: 78,   r1m: 0.6,  r3m: 1.8,  r12m: 7.2,  r3a: 2.4  },
  { ticker: 'VNQ',  nombre: 'Vanguard Real Estate ETF',           descripcion: 'REITs (bienes raíces cotizados) del mercado USA',      indice: 'MSCI US REIT',   exposicion: 'USA',        sector: 'Inmobiliario',divisa:'USD', aum: 35e9,  volumen_avg: 5e6,  expense_ratio: 0.12,   dividend_yield: 4.1, precio: 82,   r1m: 1.9,  r3m: 3.4,  r12m: 11.8, r3a: 3.2  },
]
