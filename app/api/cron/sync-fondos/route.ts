export const dynamic    = 'force-dynamic'
export const maxDuration = 300 // 5 min — efectivo en Vercel Pro/Enterprise

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const FINTUAL_BASE    = 'https://fintual.com/api'
const FINTUAL_HEADERS = { Accept: 'application/json' }
const BATCH_SIZE      = 5
const DELAY_MS        = 500

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function delay(ms: number)    { return new Promise(r => setTimeout(r, ms)) }
function dateStr(d: Date)     { return d.toISOString().split('T')[0] }
function daysAgo(n: number)   { const d = new Date(); d.setDate(d.getDate() - n); return d }

function pct(now: number, past: number): number | null {
  if (!past || past <= 0) return null
  return +((now / past - 1) * 100).toFixed(2)
}

function priceAt(days: { date: string; price: number }[], target: Date): number | null {
  if (!days.length) return null
  const t = target.getTime()
  let best: { date: string; price: number } | null = null
  let bestDiff = Infinity
  for (const d of days) {
    const diff = Math.abs(new Date(d.date).getTime() - t)
    if (diff < bestDiff) { bestDiff = diff; best = d }
  }
  if (!best || bestDiff > 45 * 86_400_000) return null
  return best.price
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchJson(url: string, treat404AsEmpty = false): Promise<any> {
  const RETRY_DELAYS = [2000, 5000]
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const res = await fetch(url, { headers: FINTUAL_HEADERS, cache: 'no-store' })
    if (res.status === 429) {
      if (attempt < RETRY_DELAYS.length) { await delay(RETRY_DELAYS[attempt]); continue }
      throw new Error(`HTTP 429 rate-limit (3 intentos) — ${url.replace(FINTUAL_BASE, '')}`)
    }
    if (!res.ok) {
      if (treat404AsEmpty && res.status === 404) return { data: [] }
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status} ${url.replace(FINTUAL_BASE, '')} — ${body.slice(0, 120)}`)
    }
    return res.json()
  }
}

async function processBatch<T>(items: T[], fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    await Promise.all(items.slice(i, i + BATCH_SIZE).map(fn))
    if (i + BATCH_SIZE < items.length) await delay(DELAY_MS)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inferCategoria(nombre: string, attrs: any): string {
  const n = nombre.toLowerCase()
  const apiCat: string = (attrs?.category ?? attrs?.fund_type ?? attrs?.type_of_fund ?? '').toLowerCase()
  if (apiCat) {
    if (apiCat.includes('renta fija') || apiCat.includes('fixed') || apiCat.includes('deuda')) return 'renta fija'
    if (apiCat.includes('conservador') || apiCat.includes('conservative')) return 'conservador'
    if (apiCat.includes('balanceado') || apiCat.includes('mixto') || apiCat.includes('moderate')) return 'moderado'
    if (apiCat.includes('acciones') || apiCat.includes('equity') || apiCat.includes('agresivo')) return 'agresivo'
  }
  if (n.includes('very conservative') || n.includes('muy conservador')) return 'conservador'
  if (n.includes('risky') || n.includes('acciones') || n.includes('renta variable') || n.includes('accionario')) return 'agresivo'
  if (n.includes('moderate') || n.includes('balanceado') || n.includes('mixto')) return 'moderado'
  if (n.includes('conservative') || n.includes('conservador')) return 'conservador'
  if (n.includes('renta fija') || n.includes('deposito') || n.includes('depósito') || n.includes('deuda') || n.includes('money market')) return 'renta fija'
  return 'moderado'
}

// FIX: Extraer TAC (expense ratio / fee anual) desde los atributos de Fintual
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTac(attrs: any): number | null {
  if (!attrs) return null
  // Fintual puede retornar el fee bajo distintos nombres — probamos todos
  const raw =
    attrs.expense_ratio   ??   // decimal: 0.0051 → 0.51%
    attrs.annual_fee      ??
    attrs.management_fee  ??
    attrs.tac             ??
    attrs.total_expense   ??
    attrs.fee             ??
    null
  if (raw == null) return null
  const n = parseFloat(String(raw))
  if (isNaN(n) || n <= 0) return null
  // Si viene como decimal (< 1) convertir a porcentaje; si ya es % dejarlo
  return n < 1 ? +(n * 100).toFixed(4) : +n.toFixed(4)
}

export async function GET(req: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'
  const auth  = req.headers.get('authorization')
  if (!isDev && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db        = sb()
  const startedAt = Date.now()
  const log = { providers: 0, conceptual: 0, real_found: 0, synced: 0, errors: 0, skipped: 0 }

  const diag: Record<string, unknown> = {
    step2_first_error:    null,
    step3_first_error:    null,
    step3_first_raw:      null,
    step4_first_error:    null,
    step4_first_day_attr: null,
    supabase_first_error: null,
    sample_provider_id:   null,
    sample_conceptual:    null,
  }

  // FIX: conjuntos separados para control correcto de inactivos
  const allResolvedIds = new Set<string>()  // todos los que llegaron a paso 4
  const agfUpserts:   { id: string; nombre: string }[] = []
  const fondoUpserts: Record<string, unknown>[] = []

  try {
    // ── PASO 1: Providers ────────────────────────────────────────────────────
    const providersData = await fetchJson(`${FINTUAL_BASE}/asset_providers`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const providers: any[] = providersData.data ?? []
    log.providers = providers.length
    if (providers[0]) diag.sample_provider_id = `id=${providers[0].id} name=${providers[0].attributes?.name}`

    for (const p of providers) agfUpserts.push({ id: String(p.id), nombre: p.attributes?.name ?? 'Desconocido' })
    if (agfUpserts.length) {
      const { error } = await db.from('agf').upsert(agfUpserts, { onConflict: 'id' })
      if (error && !diag.supabase_first_error) diag.supabase_first_error = `agf upsert: ${error.message}`
    }

    // ── PASO 2: Conceptual assets ────────────────────────────────────────────
    type ConceptualEntry = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      id: string; agf_id: string; nombre: string; symbol: string | null; attrs: any
    }
    const allConceptual: ConceptualEntry[] = []

    for (const p of providers) {
      try {
        const cData = await fetchJson(`${FINTUAL_BASE}/asset_providers/${p.id}/conceptual_assets`, true)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const c of (cData.data ?? []) as any[]) {
          if (!diag.sample_conceptual)
            diag.sample_conceptual = { id: c.id, nombre: c.attributes?.name, attrs_keys: Object.keys(c.attributes ?? {}) }
          allConceptual.push({
            id: String(c.id), agf_id: String(p.id),
            nombre: c.attributes?.name ?? '', symbol: c.attributes?.symbol ?? null,
            attrs: c.attributes,
          })
        }
        log.conceptual += cData.data?.length ?? 0
      } catch (e) {
        log.errors++
        if (!diag.step2_first_error) diag.step2_first_error = String(e)
      }
      await delay(DELAY_MS)
    }

    // ── PASO 3: Real assets → elegir la mejor serie ──────────────────────────
    type FundEntry = ConceptualEntry & {
      real_asset_id: string
      ultimo_precio: number | null
      ultima_fecha:  string | null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      real_attrs:    any
    }
    const fundsWithReal: FundEntry[] = []
    let step3Inspected = false

    await processBatch(allConceptual, async (c) => {
      try {
        const rData = await fetchJson(`${FINTUAL_BASE}/conceptual_assets/${c.id}/real_assets`)
        if (!step3Inspected) {
          step3Inspected = true
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const first = rData.data?.[0] as any
          diag.step3_first_raw = {
            data_length:      rData.data?.length ?? 0,
            first_id:         first?.id,
            first_type:       first?.type,
            first_attrs_keys: Object.keys(first?.attributes ?? {}),
            first_attrs:      first?.attributes,
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const series: any[] = rData.data ?? []
        if (!series.length) return

        const serieA = series.find(s => String(s.attributes?.serie ?? '').toUpperCase() === 'A')
        const byDate = [...series].sort((a, b) =>
          (b.attributes?.last_day?.date ?? '').localeCompare(a.attributes?.last_day?.date ?? '')
        )
        const best = serieA ?? byDate[0]

        fundsWithReal.push({
          ...c,
          real_asset_id: String(best.id),
          ultimo_precio: best.attributes?.last_day?.price ?? null,
          ultima_fecha:  best.attributes?.last_day?.date  ?? null,
          real_attrs:    best.attributes,
        })
        log.real_found++
      } catch (e) {
        log.errors++
        if (!diag.step3_first_error) diag.step3_first_error = String(e)
        if (!step3Inspected) {
          step3Inspected = true
          diag.step3_first_raw = { error: String(e), conceptual_id: c.id }
        }
      }
    })

    // ── PASO 4: Price history → calcular rentabilidades ──────────────────────
    const from = dateStr(daysAgo(365 * 3 + 60))
    const to   = dateStr(new Date())

    await processBatch(fundsWithReal, async (f) => {
      allResolvedIds.add(f.id)  // FIX: marcar siempre, independiente del resultado
      try {
        const dData = await fetchJson(
          `${FINTUAL_BASE}/real_assets/${f.real_asset_id}/days?from_date=${from}&to_date=${to}`
        )
        if (!diag.step4_first_day_attr && dData.data?.[0])
          diag.step4_first_day_attr = dData.data[0].attributes

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const days: { date: string; price: number }[] = (dData.data ?? []).map((d: any) => {
          const attrs    = d.attributes ?? {}
          const rawPrice = attrs.price ?? attrs.nav ?? attrs.value ?? attrs.close ?? null
          return { date: String(attrs.date ?? ''), price: rawPrice != null ? parseFloat(String(rawPrice)) : 0 }
        }).filter((d: { date: string; price: number }) => d.date && d.price > 0)
          .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))

        // FIX: si no hay suficientes días no eliminamos de allResolvedIds, solo marcamos skipped
        // El fondo sigue siendo válido, solo no tiene rentabilidades calculables
        if (days.length < 5) {
          log.skipped++
          fondoUpserts.push({
            id: f.id, agf_id: f.agf_id, nombre: f.nombre, symbol: f.symbol,
            real_asset_id: f.real_asset_id, categoria: inferCategoria(f.nombre, f.attrs),
            tac: extractTac(f.real_attrs) ?? extractTac(f.attrs),
            ultimo_precio: f.ultimo_precio, ultima_fecha: f.ultima_fecha,
            activo: true, updated_at: new Date().toISOString(),
          })
          return
        }

        const nowPrice = days[days.length - 1].price
        const p1m  = priceAt(days, daysAgo(30))
        const p3m  = priceAt(days, daysAgo(90))
        const p12m = priceAt(days, daysAgo(365))
        const p36m = priceAt(days, daysAgo(365 * 3))

        fondoUpserts.push({
          id:            f.id,
          agf_id:        f.agf_id,
          nombre:        f.nombre,
          symbol:        f.symbol,
          real_asset_id: f.real_asset_id,
          categoria:     inferCategoria(f.nombre, f.attrs),
          moneda:        'CLP',
          // FIX: extraer TAC desde los atributos del real_asset o del conceptual
          tac:           extractTac(f.real_attrs) ?? extractTac(f.attrs),
          rent_1m:       p1m  ? pct(nowPrice, p1m)  : null,
          rent_3m:       p3m  ? pct(nowPrice, p3m)  : null,
          rent_12m:      p12m ? pct(nowPrice, p12m) : null,
          rent_3a:       p36m ? pct(nowPrice, p36m) : null,
          ultimo_precio: f.ultimo_precio ?? nowPrice,
          ultima_fecha:  f.ultima_fecha  ?? days[days.length - 1].date,
          activo:        true,
          updated_at:    new Date().toISOString(),
        })
        log.synced++
      } catch (e) {
        log.errors++
        if (!diag.step4_first_error) diag.step4_first_error = String(e)
        // Guardar sin rentabilidades para que no desaparezca de la BD
        fondoUpserts.push({
          id:            f.id, agf_id: f.agf_id, nombre: f.nombre, symbol: f.symbol,
          real_asset_id: f.real_asset_id, categoria: inferCategoria(f.nombre, f.attrs),
          tac:           extractTac(f.real_attrs) ?? extractTac(f.attrs),
          ultimo_precio: f.ultimo_precio, ultima_fecha: f.ultima_fecha,
          activo:        true, updated_at: new Date().toISOString(),
        })
      }
    })

    // ── Upsert masivo ────────────────────────────────────────────────────────
    const CHUNK = 100
    for (let i = 0; i < fondoUpserts.length; i += CHUNK) {
      const { error } = await db
        .from('fondos_mutuos')
        .upsert(fondoUpserts.slice(i, i + CHUNK), { onConflict: 'id' })
      if (error) {
        log.errors++
        if (!diag.supabase_first_error) diag.supabase_first_error = `fondos upsert: ${error.message}`
      }
    }

    // Marcar inactivos SOLO si el sync fue limpio (>=80% de los fondos esperados resueltos)
    // Con rate limits masivos, allResolvedIds puede ser muy pequeño y desactivaría fondos válidos
    const { count: totalActivos } = await db
      .from('fondos_mutuos').select('*', { count: 'exact', head: true }).eq('activo', true)
    const threshold = Math.max(500, Math.floor((totalActivos ?? 0) * 0.8))
    if (allResolvedIds.size >= threshold) {
      const ids = Array.from(allResolvedIds)
      await db
        .from('fondos_mutuos')
        .update({ activo: false, updated_at: new Date().toISOString() })
        .not('id', 'in', `(${ids.join(',')})`)
    } else {
      diag.inactive_skipped = `allResolvedIds=${allResolvedIds.size} < threshold=${threshold} — no se marcaron inactivos`
    }

    return NextResponse.json({
      ok:         true,
      duration_s: +((Date.now() - startedAt) / 1000).toFixed(1),
      log,
      diag,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e), duration_s: +((Date.now() - startedAt) / 1000).toFixed(1), log, diag },
      { status: 500 }
    )
  }
}
