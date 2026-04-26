export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const BASE = 'https://fintual.cl/api'

async function getFintualToken(): Promise<string> {
  const res = await fetch(`${BASE}/users/sign_in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      user: {
        email:    process.env.FINTUAL_EMAIL,
        password: process.env.FINTUAL_PASSWORD,
      },
    }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`auth ${res.status}: ${await res.text()}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json()
  // Token might be in body or in Set-Cookie / Authorization header
  const token =
    json?.data?.attributes?.access_token ??
    json?.access_token ??
    json?.token ??
    res.headers.get('authorization') ??
    null
  if (!token) throw new Error(`no token found. keys: ${Object.keys(json?.data?.attributes ?? json ?? {})}`)
  return String(token)
}

export async function GET() {
  const out: Record<string, unknown> = {}

  if (!process.env.FINTUAL_EMAIL || !process.env.FINTUAL_PASSWORD) {
    return NextResponse.json({ error: 'FINTUAL_EMAIL / FINTUAL_PASSWORD not set in .env.local' })
  }

  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  let token = ''
  try {
    token = await getFintualToken()
    out.auth = 'OK'
    out.token_preview = token.slice(0, 20) + '...'
  } catch (e) {
    out.auth_error = String(e)
    return NextResponse.json(out)
  }

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  }

  // ── 2. Real assets with auth ─────────────────────────────────────────────────
  try {
    const res  = await fetch(`${BASE}/real_assets?page[size]=20`, { headers, cache: 'no-store' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json()
    out.real_assets_status  = res.status
    out.real_assets_total   = json?.data?.length ?? 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    out.real_assets_sample  = (json?.data ?? []).slice(0, 5).map((d: any) => ({
      id: d.id, name: d.attributes?.name, provider_id: d.relationships?.asset_provider?.data?.id,
    }))
    out.real_assets_meta    = json?.meta
  } catch (e) { out.real_assets_error = String(e) }

  // ── 3. Search for our specific funds ─────────────────────────────────────────
  const targetFunds = ['Risky Norris', 'LarrainVial', 'BTG Pactual', 'Sura', 'Security']
  await Promise.all(targetFunds.map(async name => {
    try {
      const res  = await fetch(
        `${BASE}/real_assets?q=${encodeURIComponent(name)}&page[size]=5`,
        { headers, cache: 'no-store' }
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json()
      out[`search_${name.split(' ')[0].toLowerCase()}`] = {
        status: res.status,
        count:  json?.data?.length ?? 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hits:   (json?.data ?? []).map((d: any) => ({
          id: d.id, name: d.attributes?.name,
          provider: d.relationships?.asset_provider?.data?.id,
        })),
      }
    } catch (e) { out[`search_${name}_error`] = String(e) }
  }))

  // ── 4. Try goals (authenticated user's portfolio) ───────────────────────────
  try {
    const res  = await fetch(`${BASE}/goals?page[size]=5`, { headers, cache: 'no-store' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json()
    out.goals_status = res.status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    out.goals_sample = (json?.data ?? []).slice(0, 3).map((d: any) => ({
      id: d.id, name: d.attributes?.name,
    }))
  } catch (e) { out.goals_error = String(e) }

  // ── 5. Try fetching days for first real_asset found ──────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstId = (out.real_assets_sample as any[])?.[0]?.id
  if (firstId) {
    try {
      const to   = new Date().toISOString().split('T')[0]
      const from = new Date(Date.now() - 5 * 86400_000).toISOString().split('T')[0]
      const res  = await fetch(
        `${BASE}/real_assets/${firstId}/days?from_date=${from}&to_date=${to}`,
        { headers, cache: 'no-store' }
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json()
      out.days_sample = {
        status: res.status,
        count:  json?.data?.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        first:  (json?.data ?? [])[0]?.attributes,
      }
    } catch (e) { out.days_error = String(e) }
  }

  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
