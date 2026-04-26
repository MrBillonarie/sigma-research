export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const BASE = 'https://fintual.com/api'
const HEADERS = { Accept: 'application/json' }
const FUND_NAMES = ['Risky Norris', 'Moderate Pitt', 'Conservative Clooney', 'Very Conservative Streep']

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {}

  // ── Step 1: asset_providers → find Fintual id ────────────────────────────────
  let fintualId: string | null = null
  try {
    const res  = await fetch(`${BASE}/asset_providers`, { headers: HEADERS, cache: 'no-store' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json()
    out.step1_status   = res.status
    out.step1_total    = json?.data?.length ?? 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    out.step1_providers = (json?.data ?? []).map((p: any) => ({ id: p.id, name: p.attributes?.name }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fintual = (json?.data ?? []).find((p: any) =>
      (p.attributes?.name ?? '').toLowerCase() === 'fintual'
    )
    if (fintual) {
      fintualId = String(fintual.id)
      out.step1_fintual_id = fintualId
    } else {
      out.step1_error = 'Provider "Fintual" not found — check step1_providers for actual names'
    }
  } catch (e) {
    out.step1_error = String(e)
  }

  if (!fintualId) {
    out.stopped_at = 'step1 — could not resolve Fintual provider id'
    return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
  }

  // ── Step 2: conceptual_assets → find the 4 Fintual funds ────────────────────
  const conceptualIds: Record<string, string> = {}
  try {
    const res  = await fetch(`${BASE}/asset_providers/${fintualId}/conceptual_assets`, { headers: HEADERS, cache: 'no-store' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json()
    out.step2_status = res.status
    out.step2_total  = json?.data?.length ?? 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    out.step2_all_conceptual = (json?.data ?? []).map((c: any) => ({ id: c.id, name: c.attributes?.name }))

    for (const name of FUND_NAMES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const match = (json?.data ?? []).find((c: any) =>
        (c.attributes?.name ?? '').toLowerCase() === name.toLowerCase()
      )
      if (match) {
        conceptualIds[name] = String(match.id)
      } else {
        out[`step2_not_found_${name}`] = `"${name}" missing — check step2_all_conceptual for actual names`
      }
    }
    out.step2_found_ids = conceptualIds
  } catch (e) {
    out.step2_error = String(e)
  }

  // ── Step 3: real_assets → resolve serie-A id for each fund ──────────────────
  const realIds: Record<string, string> = {}
  out.step3_real_assets = {}

  await Promise.all(FUND_NAMES.map(async (name) => {
    const cId = conceptualIds[name]
    if (!cId) {
      out.step3_real_assets[name] = { error: 'no conceptual_id from step 2' }
      return
    }
    try {
      const res  = await fetch(`${BASE}/conceptual_assets/${cId}/real_assets`, { headers: HEADERS, cache: 'no-store' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all = (json?.data ?? []).map((r: any) => ({
        id: r.id, name: r.attributes?.name, serie: r.attributes?.serie,
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serieA = all.find((r: any) => String(r.serie ?? '').toUpperCase() === 'A') ?? all[0]
      if (serieA) realIds[name] = String(serieA.id)
      out.step3_real_assets[name] = { status: res.status, all, selected: serieA ?? null }
    } catch (e) {
      out.step3_real_assets[name] = { error: String(e) }
    }
  }))

  out.step3_real_ids = realIds

  // ── Step 4: price sample for first resolved fund ─────────────────────────────
  const firstName = FUND_NAMES.find(n => realIds[n])
  const firstRealId = firstName ? realIds[firstName] : null

  if (firstRealId && firstName) {
    try {
      const to   = new Date().toISOString().split('T')[0]
      const from = new Date(Date.now() - 35 * 86_400_000).toISOString().split('T')[0]
      const url  = `${BASE}/real_assets/${firstRealId}/days?from_date=${from}&to_date=${to}`
      const res  = await fetch(url, { headers: HEADERS, cache: 'no-store' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json()
      out.step4_fund      = firstName
      out.step4_url       = url
      out.step4_status    = res.status
      out.step4_days_total = json?.data?.length ?? 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      out.step4_oldest_3  = (json?.data ?? []).slice(0, 3).map((d: any) => ({
        date: d.attributes?.date, price: d.attributes?.price,
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      out.step4_latest_3  = (json?.data ?? []).slice(-3).map((d: any) => ({
        date: d.attributes?.date, price: d.attributes?.price,
      }))
    } catch (e) {
      out.step4_error = String(e)
    }
  } else {
    out.step4_skipped = 'no real_id resolved in step 3'
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  out.summary = {
    fintual_provider_id: fintualId,
    conceptual_ids_found: Object.keys(conceptualIds).length,
    real_ids_found: Object.keys(realIds).length,
    funds_ready: FUND_NAMES.filter(n => realIds[n]),
    funds_missing: FUND_NAMES.filter(n => !realIds[n]),
  }

  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
