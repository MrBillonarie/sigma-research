export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const CMF_API_KEY  = '35a364e05b2334d30771f8bf2a816c27b7da86ac'
const CMF_BASE     = 'https://api.cmfchile.cl/api-sbifv3/recursos_api'
const FINTUAL_BASE = 'https://fintual.cl/api'

// ─── Static metadata (never changes: tipo, riesgo, tac, minCLP) ──────────────
const META = [
  { nombre: 'LarrainVial Enfoque LV',   adm: 'LarrainVial AGF', tipo: 'agresivo',    riesgo: 5, tac: 1.95, minCLP: 500000 },
  { nombre: 'Risky Norris',             adm: 'Fintual',         tipo: 'agresivo',    riesgo: 5, tac: 1.19, minCLP: 1000   },
  { nombre: 'BTG Pactual Acciones CL',  adm: 'BTG Pactual AGF', tipo: 'agresivo',    riesgo: 4, tac: 1.60, minCLP: 500000 },
  { nombre: 'Moderate Pitt',            adm: 'Fintual',         tipo: 'moderado',    riesgo: 3, tac: 1.19, minCLP: 1000   },
  { nombre: 'Sura Acciones Chile',      adm: 'Sura AGF',        tipo: 'moderado',    riesgo: 3, tac: 1.40, minCLP: 100000 },
  { nombre: 'Conservative Clooney',     adm: 'Fintual',         tipo: 'conservador', riesgo: 2, tac: 1.19, minCLP: 1000   },
  { nombre: 'Security Plus',            adm: 'Security AGF',    tipo: 'renta fija',  riesgo: 1, tac: 0.68, minCLP: 100000 },
  { nombre: 'BTG Pactual Renta Corto',  adm: 'BTG Pactual AGF', tipo: 'renta fija',  riesgo: 1, tac: 0.60, minCLP: 100000 },
  { nombre: 'BCI Competitivo',          adm: 'BCI Asset Mgmt',  tipo: 'renta fija',  riesgo: 1, tac: 0.70, minCLP: 50000  },
  { nombre: 'Sura Renta Depósito',      adm: 'Sura AGF',        tipo: 'renta fija',  riesgo: 1, tac: 0.75, minCLP: 100000 },
  { nombre: 'Very Conservative Streep', adm: 'Fintual',         tipo: 'conservador', riesgo: 1, tac: 1.19, minCLP: 1000   },
] as const

// ─── Static fallback returns ──────────────────────────────────────────────────
const STATIC: Record<string, { r1m: number; r3m: number; r1a: number; r3a: number | null }> = {
  'LarrainVial Enfoque LV':   { r1m:  1.80, r3m: 7.20, r1a: 22.30, r3a: 41.20 },
  'Risky Norris':             { r1m:  1.32, r3m: 9.94, r1a: 18.50, r3a: null  },
  'BTG Pactual Acciones CL':  { r1m: -0.50, r3m: 4.20, r1a: 13.20, r3a: 26.80 },
  'Moderate Pitt':            { r1m:  1.10, r3m: 6.06, r1a:  9.61, r3a: null  },
  'Sura Acciones Chile':      { r1m:  0.20, r3m: 3.50, r1a:  8.40, r3a: 18.20 },
  'Conservative Clooney':     { r1m:  0.53, r3m: 2.90, r1a:  8.79, r3a: null  },
  'Security Plus':            { r1m:  0.41, r3m: 1.78, r1a:  5.15, r3a: 11.80 },
  'BTG Pactual Renta Corto':  { r1m:  0.42, r3m: 1.75, r1a:  5.10, r3a: null  },
  'BCI Competitivo':          { r1m:  0.38, r3m: 1.65, r1a:  4.90, r3a: 11.20 },
  'Sura Renta Depósito':      { r1m:  0.39, r3m: 1.70, r1a:  5.00, r3a: 11.00 },
  'Very Conservative Streep': { r1m:  0.30, r3m: 1.20, r1a:  4.80, r3a: null  },
}

const FINTUAL_NAMES = new Set(['Risky Norris', 'Moderate Pitt', 'Conservative Clooney', 'Very Conservative Streep'])

// ─── Utils ────────────────────────────────────────────────────────────────────
function dateStr(d: Date) { return d.toISOString().split('T')[0] }

function daysAgo(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() - n); return d
}
function monthsAgo(n: number): Date {
  const d = new Date(); d.setMonth(d.getMonth() - n); return d
}

function pct(now: number, past: number) {
  return +((now / past - 1) * 100).toFixed(2)
}

// Find price closest to a target date in a sorted array
function priceAt(days: { date: string; price: number }[], target: Date): number | null {
  if (!days.length) return null
  const t = target.getTime()
  return days.reduce((best, d) => {
    const diff = Math.abs(new Date(d.date).getTime() - t)
    const bestDiff = Math.abs(new Date(best.date).getTime() - t)
    return diff < bestDiff ? d : best
  }).price
}

// ─── Fintual (public API, no key needed) ─────────────────────────────────────
async function fintualReturns(nombre: string) {
  // 1. Find asset id by name
  const listRes = await fetch(`${FINTUAL_BASE}/real_assets`, {
    next: { revalidate: 86400 },
    headers: { 'Accept': 'application/json' },
  })
  if (!listRes.ok) throw new Error('fintual list')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any = await listRes.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asset = list.data?.find((a: any) => {
    const n: string = a.attributes?.name ?? ''
    return n.toLowerCase() === nombre.toLowerCase()
  })
  if (!asset) throw new Error(`fintual: "${nombre}" not found`)

  // 2. Get 37 months of daily prices
  const from = dateStr(monthsAgo(37))
  const to   = dateStr(new Date())
  const dRes = await fetch(`${FINTUAL_BASE}/real_assets/${asset.id}/days?from_date=${from}&to_date=${to}`, {
    next: { revalidate: 86400 },
    headers: { 'Accept': 'application/json' },
  })
  if (!dRes.ok) throw new Error('fintual days')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dData: any = await dRes.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const days = (dData.data ?? []).map((d: any) => ({
    date:  String(d.attributes?.date ?? ''),
    price: parseFloat(d.attributes?.price ?? d.attributes?.nav ?? '0'),
  })).filter((d: { date: string; price: number }) => d.date && d.price > 0)
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))

  if (days.length < 20) throw new Error('fintual: not enough data')

  const now  = days[days.length - 1].price
  const p1m  = priceAt(days, daysAgo(30))
  const p3m  = priceAt(days, daysAgo(90))
  const p12m = priceAt(days, daysAgo(365))
  const p36m = priceAt(days, daysAgo(365 * 3))

  const sv = STATIC[nombre]
  return {
    r1m:  p1m  ? pct(now, p1m)  : sv.r1m,
    r3m:  p3m  ? pct(now, p3m)  : sv.r3m,
    r1a:  p12m ? pct(now, p12m) : sv.r1a,
    r3a:  p36m ? pct(now, p36m) : (sv.r3a ?? null),
    source: 'live' as const,
  }
}

// ─── CMF SBIF API ─────────────────────────────────────────────────────────────
interface CmfFondo { run: string; codigo: string; nombre: string }

// Module-level cache to avoid re-fetching the fund list within the same request burst
let _cmfList: CmfFondo[] | null = null
let _cmfListTs = 0

async function getCmfList(): Promise<CmfFondo[]> {
  if (_cmfList && Date.now() - _cmfListTs < 3_600_000) return _cmfList
  const url = `${CMF_BASE}/fondos_mutuos/?apikey=${CMF_API_KEY}&formato=json`
  const res = await fetch(url, { next: { revalidate: 86400 } })
  if (!res.ok) throw new Error(`CMF list ${res.status}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json()
  const admins: unknown[] = data?.FondosMutuos?.FondoMutuo ?? []
  const fondos: CmfFondo[] = []
  for (const adm of admins) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = adm as any
    const run = String(a.RunAdministradora ?? a.Run ?? '')
    const fs: unknown[] = a.Fondo ?? a.Fondos?.Fondo ?? []
    for (const f of fs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fi = f as any
      fondos.push({ run, codigo: String(fi.Codigo ?? ''), nombre: String(fi.Nombre ?? '') })
    }
  }
  _cmfList = fondos; _cmfListTs = Date.now()
  return fondos
}

function normName(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim()
}

function matchScore(a: string, b: string): number {
  const na = normName(a), nb = normName(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.85
  const wa = na.split(' '), wb = nb.split(' ')
  const common = wa.filter(w => wb.includes(w)).length
  return common / Math.max(wa.length, wb.length)
}

async function cmfReturns(nombre: string) {
  const fondos = await getCmfList()

  let best: CmfFondo | null = null, bestScore = 0
  for (const f of fondos) {
    const s = matchScore(nombre, f.nombre)
    if (s > bestScore) { bestScore = s; best = f }
  }
  if (!best || bestScore < 0.5) throw new Error(`CMF: "${nombre}" no match (best ${bestScore.toFixed(2)})`)

  // Fetch valor cuota for 5 reference points in parallel
  const points = [
    { key: 'now', d: monthsAgo(0) },
    { key: 'm1',  d: monthsAgo(1) },
    { key: 'm3',  d: monthsAgo(3) },
    { key: 'm12', d: monthsAgo(12) },
    { key: 'm36', d: monthsAgo(36) },
  ]
  const vcMap: Record<string, number> = {}

  await Promise.all(points.map(async ({ key, d }) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    try {
      const url = `${CMF_BASE}/fondos_mutuos/${best!.run}/${best!.codigo}/valor_cuota/${y}/${m}?apikey=${CMF_API_KEY}&formato=json`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      if (!res.ok) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json()
      const list: unknown[] = data?.ValoresCuota?.ValorCuota ?? []
      if (!list.length) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const last = list[list.length - 1] as any
      const val = parseFloat(String(last.Valor ?? last.valor ?? '0'))
      if (val > 0) vcMap[key] = val
    } catch { /* silent fallback */ }
  }))

  const now = vcMap['now']
  if (!now) throw new Error(`CMF: no current valor cuota for "${nombre}"`)

  const sv = STATIC[nombre]
  return {
    r1m:  vcMap['m1']  ? pct(now, vcMap['m1'])  : sv.r1m,
    r3m:  vcMap['m3']  ? pct(now, vcMap['m3'])  : sv.r3m,
    r1a:  vcMap['m12'] ? pct(now, vcMap['m12']) : sv.r1a,
    r3a:  vcMap['m36'] ? pct(now, vcMap['m36']) : (sv.r3a ?? null),
    source: 'live' as const,
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const results = await Promise.all(
    META.map(async (meta) => {
      try {
        const returns = FINTUAL_NAMES.has(meta.nombre)
          ? await fintualReturns(meta.nombre)
          : await cmfReturns(meta.nombre)
        return { ...meta, ...returns }
      } catch {
        const sv = STATIC[meta.nombre]
        return { ...meta, ...sv, source: 'static' as const }
      }
    })
  )

  const liveCount = results.filter(r => r.source === 'live').length

  return NextResponse.json(
    { ok: true, data: results, liveCount, total: META.length },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' } }
  )
}
