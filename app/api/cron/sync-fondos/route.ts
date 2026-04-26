export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — efectivo solo en Vercel Pro/Enterprise

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const FINTUAL_BASE = 'https://fintual.com/api'
const FINTUAL_HEADERS = { Accept: 'application/json' }
const BATCH_SIZE = 5
const DELAY_MS  = 500

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }
function dateStr(d: Date)  { return d.toISOString().split('T')[0] }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d }

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
  const RETRY_DELAYS = [2000, 5000] // backoff en ms para 429: 2s → 5s → fallo

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const res = await fetch(url, { headers: FINTUAL_HEADERS, cache: 'no-store' })

    if (res.status === 429) {
      if (attempt < RETRY_DELAYS.length) {
        await delay(RETRY_DELAYS[attempt])
        continue // reintentar
      }
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

export async function GET(req: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'
  const auth  = req.headers.get('authorization')
  if (!isDev && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = sb()
  const startedAt = Date.now()
  const log = { providers: 0, conceptual: 0, real_found: 0, synced: 0, errors: 0, skipped: 0 }

  // ── Diagnóstico: captura primer error y muestra de datos en cada paso ──────
  const diag: Record<string, unknown> = {
    step2_first_error:    null,  // primer error al buscar conceptual_assets
    step3_first_error:    null,  // primer error al buscar real_assets
    step3_first_raw:      null,  // respuesta cruda del primer conceptual_assets/{id}/real_assets
    step4_first_error:    null,  // primer error al buscar days
    step4_first_day_attr: null,  // atributos del primer day para ver el nombre del campo precio
    supabase_first_error: null,  // primer error de upsert a Supabase
    sample_provider_id:   null,  // id del primer provider
    sample_conceptual:    null,  // nombre + id del primer conceptual asset encontrado
  }

  const processedIds = new Set<string>()
  const agfUpserts:   { id: string; nombre: string }[] = []
  const fondoUpserts: Record<string, unknown>[] = []

  try {
    // ── PASO 1: Providers ───────────────────────────────────────────────────
    const providersData = await fetchJson(`${FINTUAL_BASE}/asset_providers`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const providers: any[] = providersData.data ?? []
    log.providers = providers.length
    if (providers[0]) diag.sample_provider_id = `id=${providers[0].id} name=${providers[0].attributes?.name}`

    for (const p of providers) {
      agfUpserts.push({ id: String(p.id), nombre: p.attributes?.name ?? 'Desconocido' })
    }
    if (agfUpserts.length) {
      const { error } = await db.from('agf').upsert(agfUpserts, { onConflict: 'id' })
      if (error && !diag.supabase_first_error) diag.supabase_first_error = `agf upsert: ${error.message}`
    }

    // ── PASO 2: Conceptual assets por provider ──────────────────────────────
    type ConceptualEntry = {
      id: string; agf_id: string; nombre: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      symbol: string | null; attrs: any
    }
    const allConceptual: ConceptualEntry[] = []

    // Providers en serie (1 a la vez) para no saturar la API de Fintual
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of providers) {
      try {
        // treat404AsEmpty=true → providers sin fondos no cuentan como error
        const cData = await fetchJson(
          `${FINTUAL_BASE}/asset_providers/${p.id}/conceptual_assets`,
          true
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const c of (cData.data ?? []) as any[]) {
          if (!diag.sample_conceptual) {
            diag.sample_conceptual = { id: c.id, nombre: c.attributes?.name, attrs_keys: Object.keys(c.attributes ?? {}) }
          }
          allConceptual.push({
            id:     String(c.id),
            agf_id: String(p.id),
            nombre: c.attributes?.name ?? '',
            symbol: c.attributes?.symbol ?? null,
            attrs:  c.attributes,
          })
        }
        log.conceptual += cData.data?.length ?? 0
      } catch (e) {
        log.errors++
        if (!diag.step2_first_error) diag.step2_first_error = String(e)
      }
      await delay(DELAY_MS)
    }

    // ── PASO 3: Real assets → elegir la serie más reciente ──────────────────
    type FundEntry = ConceptualEntry & {
      real_asset_id: string
      ultimo_precio: number | null
      ultima_fecha: string | null
    }
    const fundsWithReal: FundEntry[] = []
    let step3Inspected = false

    await processBatch(allConceptual, async (c) => {
      try {
        const rData = await fetchJson(`${FINTUAL_BASE}/conceptual_assets/${c.id}/real_assets`)

        // Capturar la respuesta cruda del primer éxito para ver la estructura real
        if (!step3Inspected) {
          step3Inspected = true
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const first = rData.data?.[0] as any
          diag.step3_first_raw = {
            data_length: rData.data?.length ?? 0,
            first_id:    first?.id,
            first_type:  first?.type,
            first_attrs_keys: Object.keys(first?.attributes ?? {}),
            first_attrs: first?.attributes,
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const series: any[] = rData.data ?? []
        if (!series.length) return

        const serieA = series.find(s => String(s.attributes?.serie ?? '').toUpperCase() === 'A')
        const byDate = [...series].sort((a, b) => {
          const dateA = a.attributes?.last_day?.date ?? ''
          const dateB = b.attributes?.last_day?.date ?? ''
          return dateB.localeCompare(dateA)
        })
        const best = serieA ?? byDate[0]

        fundsWithReal.push({
          ...c,
          real_asset_id: String(best.id),
          ultimo_precio: best.attributes?.last_day?.price ?? null,
          ultima_fecha:  best.attributes?.last_day?.date  ?? null,
        })
        log.real_found++
      } catch (e) {
        log.errors++
        if (!diag.step3_first_error) diag.step3_first_error = String(e)
        // Intento alternativo: inspeccionar igual el primer error
        if (!step3Inspected) {
          step3Inspected = true
          diag.step3_first_raw = { error: String(e), conceptual_id: c.id, url: `/conceptual_assets/${c.id}/real_assets` }
        }
      }
    })

    // ── PASO 4: Price history → calcular rentabilidades ──────────────────────
    const from = dateStr(daysAgo(365 * 3 + 60))
    const to   = dateStr(new Date())

    await processBatch(fundsWithReal, async (f) => {
      processedIds.add(f.id)
      try {
        const dData = await fetchJson(
          `${FINTUAL_BASE}/real_assets/${f.real_asset_id}/days?from_date=${from}&to_date=${to}`
        )

        // Capturar atributos del primer day para saber cómo se llama el campo precio
        if (!diag.step4_first_day_attr && dData.data?.[0]) {
          diag.step4_first_day_attr = dData.data[0].attributes
        }

        // Intentar los distintos nombres de campo que usa Fintual
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const days: { date: string; price: number }[] = (dData.data ?? []).map((d: any) => {
          const attrs = d.attributes ?? {}
          const rawPrice = attrs.price ?? attrs.nav ?? attrs.value ?? attrs.close ?? null
          return {
            date:  String(attrs.date ?? ''),
            price: rawPrice != null ? parseFloat(String(rawPrice)) : 0,
          }
        }).filter((d: { date: string; price: number }) => d.date && d.price > 0)
          .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))

        if (days.length < 5) { log.skipped++; processedIds.delete(f.id); return }

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
        // Guardar el fondo sin rentabilidades para que quede registrado
        fondoUpserts.push({
          id:            f.id,
          agf_id:        f.agf_id,
          nombre:        f.nombre,
          symbol:        f.symbol,
          real_asset_id: f.real_asset_id,
          categoria:     inferCategoria(f.nombre, f.attrs),
          ultimo_precio: f.ultimo_precio,
          ultima_fecha:  f.ultima_fecha,
          activo:        true,
          updated_at:    new Date().toISOString(),
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

    // ── Marcar inactivos ─────────────────────────────────────────────────────
    if (processedIds.size > 0) {
      const ids = Array.from(processedIds).join(',')
      await db
        .from('fondos_mutuos')
        .update({ activo: false, updated_at: new Date().toISOString() })
        .not('id', 'in', `(${ids})`)
    }

    return NextResponse.json({
      ok: true,
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
