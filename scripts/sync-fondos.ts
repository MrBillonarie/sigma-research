/**
 * Sincronización Fintual → Supabase
 *
 * Modos:
 *   UPDATE   (default, diario):    fetcha days directo por real_asset_id conocido — 1 request/fondo
 *   DISCOVER (semanal, --discover): recorre providers para encontrar fondos nuevos — 3 requests/fondo
 *
 * Uso:
 *   npx tsx scripts/sync-fondos.ts             → update mode
 *   npx tsx scripts/sync-fondos.ts --discover  → discovery mode
 */

import { loadEnvConfig } from '@next/env'
import { createClient }  from '@supabase/supabase-js'
import { Resend }        from 'resend'

loadEnvConfig(process.cwd())

const FINTUAL_BASE    = 'https://fintual.com/api'
const FINTUAL_HEADERS = { Accept: 'application/json' }
const DISCOVER_MODE   = process.argv.includes('--discover')

// ─── Delays ───────────────────────────────────────────────────────────────────
const FUND_DELAY_MS     = 600
const PROVIDER_DELAY_MS = 2_000
const RETRY_DELAYS      = [8_000, 20_000, 45_000]
const COOLDOWN_MS       = 240_000
const MAX_CONSEC_FAILS  = 3
const MAX_COOLDOWNS_PER_PROVIDER = 2
const CONCURRENT_FUNDS  = 3

let consecFails      = 0
let coolingDown      = false
let providerCooldowns = 0

// ─── Clientes ─────────────────────────────────────────────────────────────────
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
const resend = new Resend(process.env.RESEND_API_KEY)

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))
const dateStr = (d: Date)    => d.toISOString().split('T')[0]
const daysAgo = (n: number)  => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const now     = ()           => new Date().toLocaleTimeString('es-CL')

function pct(current: number, past: number): number | null {
  if (!past || past <= 0) return null
  return +((current / past - 1) * 100).toFixed(2)
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
        const wait = RETRY_DELAYS[attempt]
        process.stdout.write(` [429→${wait / 1000}s]`)
        await sleep(wait)
        continue
      }
      consecFails++
      if (consecFails >= MAX_CONSEC_FAILS && !coolingDown) {
        coolingDown = true
        providerCooldowns++
        process.stdout.write(`\n  ⏸ cooldown ${providerCooldowns}/${MAX_COOLDOWNS_PER_PROVIDER} → ${COOLDOWN_MS / 1000}s...`)
        await sleep(COOLDOWN_MS)
        consecFails = 0
        coolingDown = false
        process.stdout.write(' reanudando\n')
        if (providerCooldowns >= MAX_COOLDOWNS_PER_PROVIDER) {
          throw new Error('PROVIDER_SKIP')
        }
      }
      throw new Error('HTTP 429')
    }

    if (!res.ok) {
      if (treat404AsEmpty && res.status === 404) return { data: [] }
      throw new Error(`HTTP ${res.status}`)
    }

    consecFails = 0
    return res.json()
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inferCategoria(nombre: string, attrs: any): string {
  const n      = nombre.toLowerCase()
  const apiCat = (attrs?.category ?? attrs?.fund_type ?? attrs?.type_of_fund ?? '').toLowerCase()
  if (apiCat) {
    if (apiCat.includes('renta fija') || apiCat.includes('fixed') || apiCat.includes('deuda'))      return 'renta fija'
    if (apiCat.includes('conservador') || apiCat.includes('conservative'))                           return 'conservador'
    if (apiCat.includes('balanceado')  || apiCat.includes('mixto') || apiCat.includes('moderate'))  return 'moderado'
    if (apiCat.includes('acciones')    || apiCat.includes('equity') || apiCat.includes('agresivo')) return 'agresivo'
  }
  if (n.includes('very conservative') || n.includes('muy conservador'))            return 'conservador'
  if (n.includes('risky')   || n.includes('acciones') || n.includes('accionario')) return 'agresivo'
  if (n.includes('moderate')|| n.includes('balanceado')|| n.includes('mixto'))    return 'moderado'
  if (n.includes('conservative') || n.includes('conservador'))                    return 'conservador'
  if (n.includes('renta fija')   || n.includes('deposito') || n.includes('depósito') ||
      n.includes('deuda')        || n.includes('money market'))                   return 'renta fija'
  return 'moderado'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTac(attrs: any): number | null {
  if (!attrs) return null
  const raw = attrs.expense_ratio ?? attrs.annual_fee ?? attrs.management_fee ?? attrs.tac ?? attrs.fee ?? null
  if (raw == null) return null
  const n = parseFloat(String(raw))
  if (isNaN(n) || n <= 0) return null
  return n < 1 ? +(n * 100).toFixed(4) : +n.toFixed(4)
}

// ─── Notificación email ───────────────────────────────────────────────────────
async function sendNotification(counters: Record<string, number>, durationS: string, totalFondos: number, mode: string) {
  const to   = process.env.EMAIL_ADMIN_TO ?? 'squantdesk@gmail.com'
  const from = process.env.EMAIL_FROM     ?? 'onboarding@resend.dev'
  const url  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigma-research.vercel.app'
  const fecha = new Date().toLocaleString('es-CL')

  const html = `<!DOCTYPE html><html><body style="background:#0a0a0a;font-family:'Courier New',monospace;color:#e5e5e5;padding:40px 20px;margin:0">
  <table style="max-width:560px;margin:0 auto;background:#111;border:1px solid #222">
    <tr><td style="padding:24px 32px;border-bottom:1px solid #222">
      <span style="display:inline-block;width:28px;height:28px;border:1px solid #d4af37;text-align:center;line-height:28px;font-size:14px;font-weight:bold;color:#d4af37">Σ</span>
      <span style="margin-left:10px;font-size:13px;letter-spacing:0.3em;color:#e5e5e5;vertical-align:middle">SIGMA RESEARCH</span>
    </td></tr>
    <tr><td style="padding:32px 32px 8px">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.3em;color:#d4af37">// SYNC COMPLETADO · ${mode.toUpperCase()}</p>
      <h1 style="margin:0 0 20px;font-size:28px;font-weight:bold;color:#22c55e">✓ FONDOS MUTUOS ACTUALIZADOS</h1>
      <p style="font-size:12px;color:#777">${fecha}</p>
    </td></tr>
    <tr><td style="padding:8px 32px 32px">
      <table style="width:100%;border-collapse:collapse">
        ${[
          ['Modo',                     mode,                         '#d4af37'],
          ['Total fondos en Supabase', totalFondos.toString(),       '#d4af37'],
          ['Con rentabilidades',       counters.synced.toString(),   '#22c55e'],
          ['Sin datos históricos',     counters.sin_datos.toString(),'#777'],
          ['Errores API',              counters.errors.toString(),   counters.errors > 10 ? '#ef4444' : '#777'],
          ['Duración',                 durationS + 's',              '#e5e5e5'],
        ].map(([k, v, c]) => `
          <tr style="border-bottom:1px solid #1a1a1a">
            <td style="padding:10px 0;font-size:12px;color:#777">${k}</td>
            <td style="padding:10px 0;font-size:14px;color:${c};text-align:right;font-weight:bold">${v}</td>
          </tr>`).join('')}
      </table>
      <div style="margin-top:24px">
        <a href="${url}/comparador/fondos-mutuos" style="display:inline-block;background:#d4af37;color:#0a0a0a;padding:12px 28px;font-size:13px;letter-spacing:0.2em;text-decoration:none;font-weight:bold">
          VER FONDOS MUTUOS →
        </a>
      </div>
    </td></tr>
    <tr><td style="padding:20px 32px;border-top:1px solid #222">
      <p style="margin:0;font-size:11px;color:#555">Sync automático · Sigma Research</p>
    </td></tr>
  </table>
</body></html>`

  try {
    await resend.emails.send({ from, to, subject: `✓ Sync Fondos [${mode}] — ${counters.synced} con rent. · ${fecha}`, html })
    console.log(`\n📧 Email enviado a ${to}`)
  } catch (e) {
    console.error('\n⚠ Email no enviado:', e)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODO UPDATE — 1 request por fondo usando real_asset_id conocido
// ═══════════════════════════════════════════════════════════════════════════════
async function runUpdate() {
  console.log('📡 Modo UPDATE — cargando fondos desde Supabase...')

  // Traer todos los fondos activos con real_asset_id conocido
  const { data: fondos, error } = await db
    .from('fondos_mutuos')
    .select('id, nombre, agf_id, real_asset_id, categoria, tac, symbol')
    .eq('activo', true)
    .not('real_asset_id', 'is', null)

  if (error) throw new Error(`Supabase: ${error.message}`)
  if (!fondos || fondos.length === 0) {
    console.log('⚠ No hay fondos con real_asset_id — ejecuta con --discover primero')
    return { synced: 0, sin_datos: 0, errors: 0 }
  }

  console.log(`Fondos a actualizar: ${fondos.length}`)
  console.log()

  const from = dateStr(daysAgo(365 * 3 + 60))
  const to   = dateStr(new Date())
  const counters = { synced: 0, sin_datos: 0, errors: 0 }

  // Procesar en batches
  for (let i = 0; i < fondos.length; i += CONCURRENT_FUNDS) {
    const batch = fondos.slice(i, i + CONCURRENT_FUNDS)

    const results = await Promise.allSettled(batch.map(async fondo => {
      try {
        const dData = await fetchJson(
          `${FINTUAL_BASE}/real_assets/${fondo.real_asset_id}/days?from_date=${from}&to_date=${to}`
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const days: { date: string; price: number }[] = (dData.data ?? []).map((d: any) => {
          const a   = d.attributes ?? {}
          const raw = a.price ?? a.nav ?? a.net_asset_value ?? a.value ?? null
          return { date: String(a.date ?? ''), price: raw != null ? parseFloat(String(raw)) : 0 }
        }).filter((d: { date: string; price: number }) => d.date && d.price > 0)
          .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))

        if (days.length < 5) return { ...fondo, sinDatos: true }

        const nowP     = days[days.length - 1].price
        const rent_1m  = pct(nowP, priceAt(days, daysAgo(30))      ?? 0)
        const rent_3m  = pct(nowP, priceAt(days, daysAgo(90))      ?? 0)
        const rent_12m = pct(nowP, priceAt(days, daysAgo(365))     ?? 0)
        const rent_3a  = pct(nowP, priceAt(days, daysAgo(365 * 3)) ?? 0)

        return {
          id: fondo.id, agf_id: fondo.agf_id, nombre: fondo.nombre,
          symbol: fondo.symbol, real_asset_id: fondo.real_asset_id,
          categoria: fondo.categoria, tac: fondo.tac, moneda: 'CLP',
          rent_1m, rent_3m, rent_12m, rent_3a,
          ultimo_precio: nowP,
          ultima_fecha:  days[days.length - 1].date,
          activo: true,
          updated_at: new Date().toISOString(),
          synced: true,
        }
      } catch (e) {
        if (String(e).includes('PROVIDER_SKIP')) throw e
        return { ...fondo, err: true }
      }
    }))

    const upserts: Record<string, unknown>[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const v = r.value as Record<string, unknown>
        if (v.synced)    { upserts.push(v); counters.synced++ }
        else if (v.sinDatos) counters.sin_datos++
        else if (v.err)      counters.errors++
      } else {
        counters.errors++
      }
    }

    if (upserts.length > 0) {
      const { error: upErr } = await db.from('fondos_mutuos').upsert(upserts, { onConflict: 'id' })
      if (upErr) console.error(`  ⚠ Supabase: ${upErr.message}`)
    }

    // Log progreso cada 50 fondos
    const done = Math.min(i + CONCURRENT_FUNDS, fondos.length)
    if (done % 50 === 0 || done === fondos.length) {
      process.stdout.write(`  [${done}/${fondos.length}] ✓${counters.synced} ✗${counters.errors} sin_datos:${counters.sin_datos}\n`)
    }

    await sleep(FUND_DELAY_MS)
  }

  return counters
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODO DISCOVER — recorre providers, reintenta los saltados hasta que todos pasen
// ═══════════════════════════════════════════════════════════════════════════════

// Esperas entre reintentos de providers saltados: 5 min, 10 min, 20 min
const RETRY_WAITS_MS = [300_000, 600_000, 1_200_000]
const MAX_RETRIES    = RETRY_WAITS_MS.length

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processProvider(p: any, total: number, label: string, from: string, to: string, counters: { synced: number; sin_datos: number; errors: number }): Promise<boolean> {
  process.stdout.write(label)

  let conceptuals: { id: string; nombre: string; attrs: unknown }[] = []
  try {
    const cData = await fetchJson(`${FINTUAL_BASE}/asset_providers/${p.id}/conceptual_assets`, true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conceptuals = (cData.data ?? []).map((c: any) => ({
      id: String(c.id), nombre: c.attributes?.name ?? '', attrs: c.attributes,
    }))
  } catch (e) {
    console.log(`ERROR — ${e}`)
    counters.errors++
    await sleep(PROVIDER_DELAY_MS)
    return false
  }

  if (conceptuals.length === 0) {
    process.stdout.write('VACÍO\n')
    await sleep(PROVIDER_DELAY_MS)
    return true
  }

  let fondosSynced = 0, fondosSinDatos = 0, fondosErr = 0
  providerCooldowns = 0
  const fondoUpserts: Record<string, unknown>[] = []
  let providerSkipped = false

  for (let i = 0; i < conceptuals.length; i += CONCURRENT_FUNDS) {
    if (providerSkipped) break
    const batch = conceptuals.slice(i, i + CONCURRENT_FUNDS)

    const results = await Promise.allSettled(batch.map(async c => {
      let realAssetId: string | null  = null
      let ultimoPrecio: number | null = null
      let ultimaFecha:  string | null = null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let realAttrs: any              = null

      try {
        const rData = await fetchJson(`${FINTUAL_BASE}/conceptual_assets/${c.id}/real_assets`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const series: any[] = rData.data ?? []
        if (series.length > 0) {
          const serieA = series.find(s => String(s.attributes?.serie ?? '').toUpperCase() === 'A')
          const byDate = [...series].sort((a, b) =>
            (b.attributes?.last_day?.date ?? '').localeCompare(a.attributes?.last_day?.date ?? ''))
          const best   = serieA ?? byDate[0]
          realAssetId  = String(best.id)
          ultimoPrecio = best.attributes?.last_day?.price ?? null
          ultimaFecha  = best.attributes?.last_day?.date  ?? null
          realAttrs    = best.attributes
        }
        await sleep(FUND_DELAY_MS)
      } catch (e) {
        if (String(e).includes('PROVIDER_SKIP')) throw e
        await sleep(FUND_DELAY_MS)
      }

      let rent_1m: number | null = null, rent_3m: number | null = null
      let rent_12m: number | null = null, rent_3a: number | null = null
      let synced = false, sinDatos = false, err = false

      if (realAssetId) {
        try {
          const dData = await fetchJson(
            `${FINTUAL_BASE}/real_assets/${realAssetId}/days?from_date=${from}&to_date=${to}`
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const days: { date: string; price: number }[] = (dData.data ?? []).map((d: any) => {
            const a   = d.attributes ?? {}
            const raw = a.price ?? a.nav ?? a.net_asset_value ?? a.value ?? null
            return { date: String(a.date ?? ''), price: raw != null ? parseFloat(String(raw)) : 0 }
          }).filter((d: { date: string; price: number }) => d.date && d.price > 0)
            .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))

          if (days.length >= 5) {
            const nowP = days[days.length - 1].price
            ultimoPrecio = ultimoPrecio ?? nowP
            ultimaFecha  = ultimaFecha  ?? days[days.length - 1].date
            rent_1m  = pct(nowP, priceAt(days, daysAgo(30))      ?? 0)
            rent_3m  = pct(nowP, priceAt(days, daysAgo(90))      ?? 0)
            rent_12m = pct(nowP, priceAt(days, daysAgo(365))     ?? 0)
            rent_3a  = pct(nowP, priceAt(days, daysAgo(365 * 3)) ?? 0)
            synced = true
          } else { sinDatos = true }
          await sleep(FUND_DELAY_MS)
        } catch (e) {
          if (String(e).includes('PROVIDER_SKIP')) throw e
          err = true
          await sleep(FUND_DELAY_MS)
        }
      } else { sinDatos = true }

      return {
        upsert: {
          id: c.id, agf_id: String(p.id), nombre: c.nombre,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          symbol:        (c.attrs as any)?.symbol ?? null,
          real_asset_id: realAssetId,
          categoria:     inferCategoria(c.nombre, c.attrs),
          tac:           extractTac(realAttrs) ?? extractTac(c.attrs),
          moneda:        'CLP',
          rent_1m, rent_3m, rent_12m, rent_3a,
          ultimo_precio: ultimoPrecio,
          ultima_fecha:  ultimaFecha,
          activo:        true,
          updated_at:    new Date().toISOString(),
        },
        synced, sinDatos, err,
      }
    }))

    for (const r of results) {
      if (r.status === 'rejected' && String(r.reason).includes('PROVIDER_SKIP')) {
        process.stdout.write(`\n  ⏭ Provider saltado — se reintentará\n`)
        providerSkipped = true
        break
      }
      if (r.status === 'fulfilled') {
        fondoUpserts.push(r.value.upsert)
        if (r.value.synced)        { fondosSynced++;   counters.synced++    }
        else if (r.value.sinDatos) { fondosSinDatos++; counters.sin_datos++ }
        else if (r.value.err)      { fondosErr++;      counters.errors++    }
      } else {
        fondosErr++; counters.errors++
      }
    }
  }

  if (fondoUpserts.length > 0) {
    const { error: upErr } = await db.from('fondos_mutuos').upsert(fondoUpserts, { onConflict: 'id' })
    if (upErr) {
      process.stdout.write(`ERROR Supabase: ${upErr.message}\n`)
    } else {
      const parts = [`${conceptuals.length} fondos`]
      if (fondosSynced > 0)   parts.push(`${fondosSynced} con rent.`)
      if (fondosSinDatos > 0) parts.push(`${fondosSinDatos} sin datos`)
      if (fondosErr > 0)      parts.push(`${fondosErr} err`)
      process.stdout.write(`OK (${parts.join(', ')})\n`)
    }
  } else if (!providerSkipped) {
    process.stdout.write('VACÍO\n')
  }

  await sleep(PROVIDER_DELAY_MS)
  return !providerSkipped
}

async function runDiscover() {
  console.log('🔍 Modo DISCOVER — recorriendo todos los providers hasta completar')

  // Traer providers
  let providersData
  while (true) {
    try {
      providersData = await fetchJson(`${FINTUAL_BASE}/asset_providers`)
      break
    } catch (e) {
      if (String(e).includes('429')) {
        process.stdout.write(`\n⏸ Bloqueado → reintentando en ${COOLDOWN_MS / 1000}s... (${now()})\n`)
        await sleep(COOLDOWN_MS)
      } else throw e
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providers: any[] = providersData.data ?? []
  console.log(`Providers: ${providers.length}`)

  const agfUpserts = providers.map(p => ({ id: String(p.id), nombre: p.attributes?.name ?? 'Desconocido' }))
  await db.from('agf').upsert(agfUpserts, { onConflict: 'id' })
  console.log(`✓ ${agfUpserts.length} AGFs guardadas\n`)

  const from     = dateStr(daysAgo(365 * 3 + 60))
  const to       = dateStr(new Date())
  const counters = { synced: 0, sin_datos: 0, errors: 0 }

  // ── Pasada inicial ───────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pendientes: any[] = []
  for (let pi = 0; pi < providers.length; pi++) {
    const p     = providers[pi]
    const label = `[${String(pi + 1).padStart(3)}/${providers.length}] ${(p.attributes?.name ?? '?').slice(0, 32).padEnd(34)}`
    const ok    = await processProvider(p, providers.length, label, from, to, counters)
    if (!ok) pendientes.push(p)
  }

  // ── Reintentos de providers saltados ────────────────────────────────────────
  for (let retry = 0; retry < MAX_RETRIES && pendientes.length > 0; retry++) {
    const waitMs = RETRY_WAITS_MS[retry]
    console.log(`\n♻ ${pendientes.length} provider(s) pendiente(s) — esperando ${waitMs / 60_000} min antes de reintentar... (${now()})`)
    await sleep(waitMs)
    console.log(`♻ Reintento ${retry + 1}/${MAX_RETRIES} — ${pendientes.length} providers (${now()})\n`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aún: any[] = []
    for (let pi = 0; pi < pendientes.length; pi++) {
      const p     = pendientes[pi]
      const label = `  [retry ${retry + 1} · ${pi + 1}/${pendientes.length}] ${(p.attributes?.name ?? '?').slice(0, 28).padEnd(30)}`
      providerCooldowns = 0
      const ok = await processProvider(p, pendientes.length, label, from, to, counters)
      if (!ok) aún.push(p)
    }
    pendientes = aún
  }

  if (pendientes.length > 0) {
    console.log(`\n⚠ ${pendientes.length} provider(s) no pudieron completarse tras ${MAX_RETRIES} reintentos:`)
    pendientes.forEach(p => console.log(`   • ${p.attributes?.name ?? p.id}`))
  } else {
    console.log('\n✓ Todos los providers completados')
  }

  return counters
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  const startedAt = Date.now()
  const mode      = DISCOVER_MODE ? 'discover' : 'update'

  console.log('━━━ Sync Fondos Mutuos → Supabase ━━━')
  console.log(`Modo:   ${mode.toUpperCase()}`)
  console.log(`Inicio: ${now()}`)
  console.log()

  const counters = DISCOVER_MODE ? await runDiscover() : await runUpdate()

  // Contar total activos en Supabase
  const { count: totalFondos } = await db
    .from('fondos_mutuos').select('*', { count: 'exact', head: true }).eq('activo', true)

  const durationS = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log()
  console.log('━━━ Resumen ━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Fin:         ${now()}`)
  console.log(`Duración:    ${durationS}s`)
  console.log(`En Supabase: ${totalFondos ?? '?'} fondos activos`)
  console.log(`Con rent.:   ${counters.synced}`)
  console.log(`Sin datos:   ${counters.sin_datos}`)
  console.log(`Errores:     ${counters.errors}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await sendNotification(counters, durationS, totalFondos ?? 0, mode)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
