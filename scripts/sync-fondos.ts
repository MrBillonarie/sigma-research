/**
 * Sincronización Fintual → Supabase (script standalone)
 * Uso: npx tsx scripts/sync-fondos.ts
 * Al terminar envía email de notificación a EMAIL_ADMIN_TO
 */

import { loadEnvConfig } from '@next/env'
import { createClient }  from '@supabase/supabase-js'
import { Resend }        from 'resend'

loadEnvConfig(process.cwd())

const FINTUAL_BASE    = 'https://fintual.com/api'
const FINTUAL_HEADERS = { Accept: 'application/json' }

// ─── Delays mejorados para no saturar la API ──────────────────────────────────
const FUND_DELAY_MS     = 800   // entre cada fondo de un provider
const PROVIDER_DELAY_MS = 2000  // entre providers
const RETRY_DELAYS      = [5_000, 15_000, 30_000] // backoff exponencial para 429

// ─── Clientes ─────────────────────────────────────────────────────────────────
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
const resend = new Resend(process.env.RESEND_API_KEY)

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep    = (ms: number) => new Promise(r => setTimeout(r, ms))
const dateStr  = (d: Date)    => d.toISOString().split('T')[0]
const daysAgo  = (n: number)  => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const now      = ()           => new Date().toLocaleTimeString('es-CL')

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
        process.stdout.write(` [429 → ${wait / 1000}s]`)
        await sleep(wait)
        continue
      }
      throw new Error('HTTP 429 (rate-limit agotado)')
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
    if (apiCat.includes('renta fija') || apiCat.includes('fixed') || apiCat.includes('deuda'))     return 'renta fija'
    if (apiCat.includes('conservador') || apiCat.includes('conservative'))                          return 'conservador'
    if (apiCat.includes('balanceado')  || apiCat.includes('mixto') || apiCat.includes('moderate')) return 'moderado'
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

// ─── Notificación email al terminar ──────────────────────────────────────────
async function sendNotification(counters: Record<string, number>, durationS: string, totalFondos: number) {
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
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.3em;color:#d4af37">// SYNC COMPLETADO</p>
      <h1 style="margin:0 0 20px;font-size:28px;font-weight:bold;color:#22c55e">✓ FONDOS MUTUOS ACTUALIZADOS</h1>
      <p style="font-size:12px;color:#777">${fecha}</p>
    </td></tr>
    <tr><td style="padding:8px 32px 32px">
      <table style="width:100%;border-collapse:collapse">
        ${[
          ['Total fondos en Supabase', totalFondos.toString(), '#d4af37'],
          ['Con rentabilidades',       counters.synced.toString(),    '#22c55e'],
          ['Sin datos históricos',     counters.sin_datos.toString(), '#777'],
          ['Errores API',              counters.errors.toString(),    counters.errors > 10 ? '#ef4444' : '#777'],
          ['Duración',                 durationS + 's',               '#e5e5e5'],
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
      <p style="margin:0;font-size:11px;color:#555">Sync automático diario 2am UTC · Sigma Research</p>
    </td></tr>
  </table>
</body></html>`

  try {
    await resend.emails.send({
      from,
      to,
      subject: `✓ Sync Fondos Mutuos — ${counters.synced} fondos con rentabilidad · ${fecha}`,
      html,
    })
    console.log(`\n📧 Email enviado a ${to}`)
  } catch (e) {
    console.error('\n⚠ Email no enviado:', e)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now()
  const counters  = { synced: 0, sin_datos: 0, errors: 0 }
  const processedIds = new Set<string>()

  console.log('━━━ Sync Fondos Mutuos → Supabase ━━━')
  console.log(`Inicio: ${now()}`)
  console.log(`URL:    ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
  console.log()

  // ── PASO 1: Providers ────────────────────────────────────────────────────────
  const providersData = await fetchJson(`${FINTUAL_BASE}/asset_providers`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providers: any[] = providersData.data ?? []
  console.log(`Providers encontrados: ${providers.length}`)

  const agfUpserts = providers.map(p => ({ id: String(p.id), nombre: p.attributes?.name ?? 'Desconocido' }))
  const { error: agfErr } = await db.from('agf').upsert(agfUpserts, { onConflict: 'id' })
  if (agfErr) console.error('  ⚠ Error guardando AGFs:', agfErr.message)
  else console.log(`  ✓ ${agfUpserts.length} AGFs guardadas`)
  console.log()

  // ── PASO 2–4: Por cada provider ──────────────────────────────────────────────
  const from = dateStr(daysAgo(365 * 3 + 60))
  const to   = dateStr(new Date())

  for (let pi = 0; pi < providers.length; pi++) {
    const p      = providers[pi]
    const label  = (p.attributes?.name ?? '?').slice(0, 32).padEnd(34)
    const prefix = `[${String(pi + 1).padStart(3)}/${providers.length}] ${label}`
    process.stdout.write(prefix)

    // Conceptual assets
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
      continue
    }

    if (conceptuals.length === 0) {
      process.stdout.write('VACÍO\n')
      await sleep(PROVIDER_DELAY_MS)
      continue
    }

    let fondosSynced = 0, fondosSinDatos = 0, fondosErr = 0
    const fondoUpserts: Record<string, unknown>[] = []

    for (const c of conceptuals) {
      processedIds.add(c.id)

      // Real assets (series)
      let realAssetId: string | null  = null
      let ultimoPrecio: number | null = null
      let ultimaFecha: string | null  = null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let realAttrs: any              = null

      try {
        const rData = await fetchJson(`${FINTUAL_BASE}/conceptual_assets/${c.id}/real_assets`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const series: any[] = rData.data ?? []
        if (series.length > 0) {
          const serieA = series.find(s => String(s.attributes?.serie ?? '').toUpperCase() === 'A')
          const byDate = [...series].sort((a, b) =>
            (b.attributes?.last_day?.date ?? '').localeCompare(a.attributes?.last_day?.date ?? '')
          )
          const best   = serieA ?? byDate[0]
          realAssetId  = String(best.id)
          ultimoPrecio = best.attributes?.last_day?.price ?? null
          ultimaFecha  = best.attributes?.last_day?.date  ?? null
          realAttrs    = best.attributes
        }
        await sleep(FUND_DELAY_MS)
      } catch {
        await sleep(FUND_DELAY_MS)
      }

      // Price history → rentabilidades
      let rent_1m: number | null = null, rent_3m: number | null = null
      let rent_12m: number | null = null, rent_3a: number | null = null

      if (realAssetId) {
        try {
          const dData = await fetchJson(
            `${FINTUAL_BASE}/real_assets/${realAssetId}/days?from_date=${from}&to_date=${to}`
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const days: { date: string; price: number }[] = (dData.data ?? []).map((d: any) => {
            const a = d.attributes ?? {}
            const raw = a.price ?? a.nav ?? a.value ?? a.close ?? null
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
            fondosSynced++
            counters.synced++
          } else {
            fondosSinDatos++
            counters.sin_datos++
          }
          await sleep(FUND_DELAY_MS)
        } catch {
          fondosErr++
          counters.errors++
          await sleep(FUND_DELAY_MS)
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
        tac:           extractTac(realAttrs) ?? extractTac(c.attrs),
        moneda:        'CLP',
        rent_1m, rent_3m, rent_12m, rent_3a,
        ultimo_precio: ultimoPrecio,
        ultima_fecha:  ultimaFecha,
        activo:        true,
        updated_at:    new Date().toISOString(),
      })
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
    } else {
      process.stdout.write('VACÍO\n')
    }

    await sleep(PROVIDER_DELAY_MS)
  }

  // ── Marcar inactivos SOLO si el sync fue limpio (>=80% fondos resueltos) ────
  const { count: totalActivos } = await db
    .from('fondos_mutuos').select('*', { count: 'exact', head: true }).eq('activo', true)
  const threshold = Math.max(500, Math.floor((totalActivos ?? 0) * 0.8))
  if (processedIds.size >= threshold) {
    await db.from('fondos_mutuos')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .not('id', 'in', `(${Array.from(processedIds).join(',')})`)
    console.log(`✓ Marcados inactivos (${processedIds.size} >= threshold ${threshold})`)
  } else {
    console.log(`⚠ Inactivos omitidos: ${processedIds.size} resueltos < threshold ${threshold} — datos protegidos`)
  }

  // ── Contar total en Supabase ───────────────────────────────────────────────
  const { count: totalFondos } = await db
    .from('fondos_mutuos').select('*', { count: 'exact', head: true }).eq('activo', true)

  // ── Resumen ────────────────────────────────────────────────────────────────
  const durationS = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log()
  console.log('━━━ Resumen ━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Fin:           ${now()}`)
  console.log(`Duración:      ${durationS}s`)
  console.log(`Providers:     ${providers.length}`)
  console.log(`En Supabase:   ${totalFondos ?? '?'} fondos activos`)
  console.log(`Con rent.:     ${counters.synced}`)
  console.log(`Sin datos:     ${counters.sin_datos}`)
  console.log(`Errores:       ${counters.errors}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // ── Email de notificación ──────────────────────────────────────────────────
  await sendNotification(counters, durationS, totalFondos ?? 0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
