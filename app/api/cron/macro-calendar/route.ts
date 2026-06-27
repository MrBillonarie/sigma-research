export const dynamic    = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

// Llena macro_events con fechas OFICIALES (Fed/BLS/BEA, públicas con meses de
// anticipación) + datos reales de EIA (petróleo/gas). Sin pronóstico de
// consenso — esa parte requiere una API de pago (FMP/Finnhub la cobran).
//
// IMPORTANTE: actualizar los arrays *_2026 cada año con el calendario oficial:
//   FOMC → federalreserve.gov/monetarypolicy/fomccalendars.htm
//   CPI  → bls.gov/schedule/news_release/cpi.htm
//   PCE  → bea.gov/news/schedule

function checkCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (auth.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
}

// ─── Calendario oficial 2026 — actualizar en enero de cada año ──────────────
const FOMC_2026 = [
  '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17',
  '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09',
]

const CPI_2026 = [
  '2026-01-13', '2026-02-13', '2026-03-11', '2026-04-10', '2026-05-12', '2026-06-10',
  '2026-07-14', '2026-08-12', '2026-09-11', '2026-10-14', '2026-11-10', '2026-12-10',
]

const PCE_2026 = [
  '2026-04-30', '2026-05-28', '2026-06-25', '2026-07-30', '2026-08-26',
  '2026-09-30', '2026-10-29', '2026-11-25', '2026-12-23',
]

const GDP_2026 = [
  { date: '2026-06-25', label: 'Q1 2026 (Tercera estimación)' },
  { date: '2026-07-30', label: 'Q2 2026 (Estimación avance)' },
  { date: '2026-08-26', label: 'Q2 2026 (Segunda estimación)' },
  { date: '2026-09-30', label: 'Q2 2026 (Tercera estimación)' },
  { date: '2026-10-29', label: 'Q3 2026 (Estimación avance)' },
  { date: '2026-11-25', label: 'Q3 2026 (Segunda estimación)' },
  { date: '2026-12-23', label: 'Q3 2026 (Tercera estimación)' },
]

function firstFridayOfMonth(year: number, month0: number): string {
  const d = new Date(year, month0, 1)
  const offset = (5 - d.getDay() + 7) % 7
  d.setDate(1 + offset)
  return d.toISOString().slice(0, 10)
}

function buildNfpDates(monthsAhead = 6): string[] {
  const now = new Date()
  const out: string[] = []
  for (let i = 0; i < monthsAhead; i++) {
    out.push(firstFridayOfMonth(now.getFullYear(), now.getMonth() + i))
  }
  return out
}

function nextWeekday(targetDow: number): string {
  const d = new Date()
  const diff = (targetDow - d.getDay() + 7) % 7
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff))
  return d.toISOString().slice(0, 10)
}

interface Row {
  title: string; currency: string; impact: 'HIGH' | 'MED' | 'LOW'; type: 'MACRO' | 'CRYPTO'
  event_date: string; event_time: string; previous: string; forecast: string; actual: string
  description: string; source: string; is_manual: boolean; country: string
}

function buildOfficialEvents(): Row[] {
  const today = new Date().toISOString().slice(0, 10)
  const rows: Row[] = []

  for (const d of FOMC_2026) {
    if (d < today) continue
    rows.push({
      title: 'FOMC Decision + Press Conference', currency: 'USD', impact: 'HIGH', type: 'MACRO',
      event_date: d, event_time: '14:00', previous: '', forecast: '', actual: '',
      description: 'Decisión de tasas de la Fed. Alta volatilidad esperada en crypto y commodities.',
      source: 'FOMC', is_manual: false, country: 'US',
    })
  }
  for (const d of CPI_2026) {
    if (d < today) continue
    rows.push({
      title: 'CPI (YoY)', currency: 'USD', impact: 'HIGH', type: 'MACRO',
      event_date: d, event_time: '08:30', previous: '', forecast: '', actual: '',
      description: 'Índice de precios al consumidor. Indicador clave de inflación para la Fed.',
      source: 'BLS', is_manual: false, country: 'US',
    })
  }
  for (const d of PCE_2026) {
    if (d < today) continue
    rows.push({
      title: 'PCE Price Index', currency: 'USD', impact: 'HIGH', type: 'MACRO',
      event_date: d, event_time: '08:30', previous: '', forecast: '', actual: '',
      description: 'Indicador de inflación favorito de la Fed.',
      source: 'BEA', is_manual: false, country: 'US',
    })
  }
  for (const g of GDP_2026) {
    if (g.date < today) continue
    rows.push({
      title: `GDP — ${g.label}`, currency: 'USD', impact: 'MED', type: 'MACRO',
      event_date: g.date, event_time: '08:30', previous: '', forecast: '', actual: '',
      description: 'Producto Interno Bruto de EEUU.',
      source: 'BEA', is_manual: false, country: 'US',
    })
  }
  for (const d of buildNfpDates(6)) {
    if (d < today) continue
    rows.push({
      title: 'NFP (Non-Farm Payrolls)', currency: 'USD', impact: 'HIGH', type: 'MACRO',
      event_date: d, event_time: '08:30', previous: '', forecast: '', actual: '',
      description: 'Empleo no agrícola. Alta volatilidad en crypto 08:25–08:45 ET.',
      source: 'BLS', is_manual: false, country: 'US',
    })
  }
  return rows
}

async function fetchEiaSeries(url: string, extraParams: Record<string, string>, key: string) {
  const params = new URLSearchParams({
    api_key: key, frequency: 'weekly', 'data[0]': 'value',
    'sort[0][column]': 'period', 'sort[0][direction]': 'desc',
    length: '2', offset: '0', ...extraParams,
  })
  const res = await fetch(`${url}?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) return []
  const json = await res.json()
  return (json?.response?.data ?? []) as { period: string; value: string }[]
}

async function buildEiaEvents(): Promise<Row[]> {
  const key = process.env.EIA_API_KEY
  if (!key) return []
  const rows: Row[] = []

  try {
    const crude = await fetchEiaSeries(
      'https://api.eia.gov/v2/petroleum/stoc/wstk/data/',
      { 'facets[product][]': 'EPC0', 'facets[duoarea][]': 'NUS', 'facets[process][]': 'SAX' }, key,
    )
    if (crude.length) {
      rows.push({
        title: 'EIA Crude Oil Inventories', currency: 'USD', impact: 'HIGH', type: 'MACRO',
        event_date: nextWeekday(3), event_time: '10:30',
        previous: crude[1] ? `${Number(crude[1].value).toLocaleString()} Mbbl` : '',
        forecast: '', actual: crude[0] ? `${Number(crude[0].value).toLocaleString()} Mbbl` : '',
        description: 'Inventario semanal de petróleo crudo en EEUU. Mueve directamente el precio de WTI.',
        source: 'EIA', is_manual: false, country: 'US',
      })
    }
  } catch { /* no bloquear el resto si EIA falla */ }

  try {
    const ng = await fetchEiaSeries(
      'https://api.eia.gov/v2/natural-gas/stor/wkly/data/',
      { 'facets[duoarea][]': 'R48', 'facets[process][]': 'SWO' }, key,
    )
    if (ng.length) {
      rows.push({
        title: 'EIA Natural Gas Storage', currency: 'USD', impact: 'HIGH', type: 'MACRO',
        event_date: nextWeekday(4), event_time: '10:30',
        previous: ng[1] ? `${Number(ng[1].value).toLocaleString()} Bcf` : '',
        forecast: '', actual: ng[0] ? `${Number(ng[0].value).toLocaleString()} Bcf` : '',
        description: 'Inventario semanal de gas natural en EEUU. Principal driver del precio de NG.',
        source: 'EIA', is_manual: false, country: 'US',
      })
    }
  } catch { /* no bloquear el resto si EIA falla */ }

  return rows
}

export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )

    const rows = [...buildOfficialEvents(), ...await buildEiaEvents()]
    const today = new Date().toISOString().slice(0, 10)

    // Regenerar desde cero los eventos automáticos futuros (idempotente, sin duplicados).
    // Las tareas privadas (calendar_tasks) y eventos manuales no se tocan.
    const { error: delError } = await sb
      .from('macro_events')
      .delete()
      .eq('is_manual', false)
      .gte('event_date', today)
    if (delError) throw delError

    const { error: insError } = await sb.from('macro_events').insert(rows)
    if (insError) throw insError

    console.log('[cron/macro-calendar]', new Date().toISOString(), { inserted: rows.length })
    return NextResponse.json({ ok: true, ts: new Date().toISOString(), inserted: rows.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/macro-calendar] error:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
