/**
 * Sincronización Fintual → Supabase (script standalone)
 * Uso: npx tsx scripts/sync-fondos.ts
 */

import { loadEnvConfig } from '@next/env'
import { createClient }  from '@supabase/supabase-js'

// Carga .env.local igual que Next.js (busca desde la raíz del proyecto)
loadEnvConfig(process.cwd())

const FINTUAL_BASE    = 'https://fintual.com/api'
const FINTUAL_HEADERS = { Accept: 'application/json' }
const DELAY_MS        = 300
const RETRY_DELAYS    = [2000, 5000] // backoff para 429

// ─── Supabase ─────────────────────────────────────────────────────────────────
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const dateStr  = (d: Date) => d.toISOString().split('T')[0]
const daysAgo  = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }

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
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const res = await fetch(url, { headers: FINTUAL_HEADERS })

    if (res.status === 429) {
      if (attempt < RETRY_DELAYS.length) {
        process.stdout.write(` [429 → esperar ${RETRY_DELAYS[attempt] / 1000}s]`)
        await sleep(RETRY_DELAYS[attempt])
        continue
      }
      throw new Error('HTTP 429 (rate-limit, 3 intentos)')
    }

    if (!res.ok) {
      if (treat404AsEmpty && res.status === 404) return { data: [] }
      throw new Error(`HTTP ${res.status}`)
    }

    return res.json()
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inferCategoria(nombre: string, attrs: any): string {
  const n = nombre.toLowerCase()
  const apiCat = (attrs?.category ?? attrs?.fund_type ?? attrs?.type_of_fund ?? '').toLowerCase()
  if (apiCat) {
    if (apiCat.includes('renta fija') || apiCat.includes('fixed') || apiCat.includes('deuda')) return 'renta fija'
    if (apiCat.includes('conservador') || apiCat.includes('conservative'))                     return 'conservador'
    if (apiCat.includes('balanceado')  || apiCat.includes('mixto') || apiCat.includes('moderate')) return 'moderado'
    if (apiCat.includes('acciones')    || apiCat.includes('equity') || apiCat.includes('agresivo')) return 'agresivo'
  }
  if (n.includes('very conservative') || n.includes('muy conservador'))            return 'conservador'
  if (n.includes('risky')   || n.includes('acciones') || n.includes('accionario')) return 'agresivo'
  if (n.includes('moderate')|| n.includes('balanceado')|| n.includes('mixto'))    return 'moderado'
  if (n.includes('conservative') || n.includes('conservador'))                    return 'conservador'
  if (n.includes('renta fija') || n.includes('deposito') || n.includes('depósito') ||
      n.includes('deuda') || n.includes('money market'))                           return 'renta fija'
  return 'moderado'
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now()
  const counters  = { synced: 0, sin_datos: 0, errors: 0 }
  const processedIds = new Set<string>()

  console.log('━━━ Sync Fondos Mutuos → Supabase ━━━')
  console.log(`Fintual API: ${FINTUAL_BASE}`)
  console.log(`Supabase:    ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
  console.log()

  // ── PASO 1: Providers ───────────────────────────────────────────────────────
  const providersData = await fetchJson(`${FINTUAL_BASE}/asset_providers`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providers: any[] = providersData.data ?? []
  console.log(`Providers encontrados: ${providers.length}`)
  console.log()

  // Upsert AGFs
  const agfUpserts = providers.map(p => ({ id: String(p.id), nombre: p.attributes?.name ?? 'Desconocido' }))
  const { error: agfErr } = await db.from('agf').upsert(agfUpserts, { onConflict: 'id' })
  if (agfErr) console.error('  ⚠ Error guardando AGFs:', agfErr.message)
  else console.log(`  ✓ ${agfUpserts.length} AGFs guardadas en Supabase`)
  console.log()

  // ── PASO 2 + 3 + 4: Por cada provider en serie ─────────────────────────────
  const from = dateStr(daysAgo(365 * 3 + 60))
  const to   = dateStr(new Date())

  for (let pi = 0; pi < providers.length; pi++) {
    const p      = providers[pi]
    const prefix = `[${String(pi + 1).padStart(3)}/${providers.length}] ${(p.attributes?.name ?? '?').slice(0, 30).padEnd(32)}`
    process.stdout.write(prefix)

    // ── Conceptual assets del provider ───────────────────────────────────────
    let conceptuals: { id: string; nombre: string; attrs: unknown }[] = []
    try {
      const cData = await fetchJson(`${FINTUAL_BASE}/asset_providers/${p.id}/conceptual_assets`, true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conceptuals = (cData.data ?? []).map((c: any) => ({
        id:     String(c.id),
        nombre: c.attributes?.name ?? '',
        attrs:  c.attributes,
      }))
    } catch (e) {
      console.log(`ERROR — ${e}`)
      counters.errors++
      await sleep(DELAY_MS)
      continue
    }

    if (conceptuals.length === 0) {
      process.stdout.write('VACÍO\n')
      await sleep(DELAY_MS)
      continue
    }

    // ── Por cada fondo del provider ───────────────────────────────────────────
    let fondosSynced = 0, fondosSinDatos = 0, fondosErr = 0
    const fondoUpserts: Record<string, unknown>[] = []

    for (const c of conceptuals) {
      processedIds.add(c.id)

      // Obtener real_assets (series)
      let realAssetId: string | null = null
      let ultimoPrecio: number | null = null
      let ultimaFecha:  string | null = null

      try {
        const rData = await fetchJson(`${FINTUAL_BASE}/conceptual_assets/${c.id}/real_assets`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const series: any[] = rData.data ?? []

        if (series.length > 0) {
          const serieA = series.find(s => String(s.attributes?.serie ?? '').toUpperCase() === 'A')
          const byDate = [...series].sort((a, b) => {
            const dateA = a.attributes?.last_day?.date ?? ''
            const dateB = b.attributes?.last_day?.date ?? ''
            return dateB.localeCompare(dateA)
          })
          const best = serieA ?? byDate[0]
          realAssetId  = String(best.id)
          ultimoPrecio = best.attributes?.last_day?.price ?? null
          ultimaFecha  = best.attributes?.last_day?.date  ?? null
        }
      } catch {
        // Sin real_asset — guardar fondo sin rentabilidades
      }

      // Obtener historial de precios y calcular rentabilidades
      let rent_1m: number | null  = null
      let rent_3m: number | null  = null
      let rent_12m: number | null = null
      let rent_3a: number | null  = null

      if (realAssetId) {
        try {
          const dData = await fetchJson(
            `${FINTUAL_BASE}/real_assets/${realAssetId}/days?from_date=${from}&to_date=${to}`
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const days: { date: string; price: number }[] = (dData.data ?? []).map((d: any) => {
            const a = d.attributes ?? {}
            const rawPrice = a.price ?? a.nav ?? a.value ?? a.close ?? null
            return { date: String(a.date ?? ''), price: rawPrice != null ? parseFloat(String(rawPrice)) : 0 }
          }).filter((d: { date: string; price: number }) => d.date && d.price > 0)
            .sort((a: { date: string; price: number }, b: { date: string; price: number }) => a.date.localeCompare(b.date))

          if (days.length >= 5) {
            const nowP = days[days.length - 1].price
            ultimoPrecio = ultimoPrecio ?? nowP
            ultimaFecha  = ultimaFecha  ?? days[days.length - 1].date
            rent_1m  = pct(nowP, priceAt(days, daysAgo(30))  ?? 0)
            rent_3m  = pct(nowP, priceAt(days, daysAgo(90))  ?? 0)
            rent_12m = pct(nowP, priceAt(days, daysAgo(365)) ?? 0)
            rent_3a  = pct(nowP, priceAt(days, daysAgo(365 * 3)) ?? 0)
            fondosSynced++
            counters.synced++
          } else {
            fondosSinDatos++
            counters.sin_datos++
          }
          await sleep(DELAY_MS)
        } catch {
          fondosErr++
          counters.errors++
        }
      } else {
        fondosSinDatos++
        counters.sin_datos++
      }

      fondoUpserts.push({
        id:            c.id,
        agf_id:        String(p.id),
        nombre:        c.nombre,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        symbol:        (c.attrs as any)?.symbol ?? null,
        real_asset_id: realAssetId,
        categoria:     inferCategoria(c.nombre, c.attrs),
        moneda:        'CLP',
        rent_1m,
        rent_3m,
        rent_12m,
        rent_3a,
        ultimo_precio: ultimoPrecio,
        ultima_fecha:  ultimaFecha,
        activo:        true,
        updated_at:    new Date().toISOString(),
      })
    }

    // Upsert del batch de fondos de este provider
    if (fondoUpserts.length > 0) {
      const { error: upErr } = await db
        .from('fondos_mutuos')
        .upsert(fondoUpserts, { onConflict: 'id' })
      if (upErr) {
        process.stdout.write(`OK (${conceptuals.length} fondos) ⚠ Supabase: ${upErr.message}\n`)
      } else {
        const parts = [`${conceptuals.length} fondos`]
        if (fondosSynced > 0)   parts.push(`${fondosSynced} con rent.`)
        if (fondosSinDatos > 0) parts.push(`${fondosSinDatos} sin datos`)
        if (fondosErr > 0)      parts.push(`${fondosErr} err`)
        process.stdout.write(`OK (${parts.join(', ')})\n`)
      }
    } else {
      process.stdout.write('VACÍO\n')
    }

    await sleep(DELAY_MS)
  }

  // ── Marcar como inactivos los fondos que ya no están en la API ──────────────
  if (processedIds.size > 0) {
    const ids = Array.from(processedIds).join(',')
    const { error: inactErr } = await db
      .from('fondos_mutuos')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .not('id', 'in', `(${ids})`)
    if (inactErr) console.error('\n⚠ Error marcando inactivos:', inactErr.message)
  }

  // ── Resumen final ─────────────────────────────────────────────────────────
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log()
  console.log('━━━ Resumen ━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Duración:      ${seconds}s`)
  console.log(`Providers:     ${providers.length}`)
  console.log(`Con rent.:     ${counters.synced}`)
  console.log(`Sin datos:     ${counters.sin_datos}`)
  console.log(`Errores:       ${counters.errors}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
