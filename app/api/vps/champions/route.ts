import { NextResponse } from 'next/server'

const VPS = process.env.VPS_URL ?? 'http://178.104.10.97:8080'

export async function GET() {
  // Primary: /api/v2/champions — full champion list with all metrics
  // Fallback: /api/public top_models — always available
  try {
    const r1 = await fetch(`${VPS}/api/v2/champions`, {
      signal: AbortSignal.timeout(6000),
    })
    if (r1.ok) {
      const data = await r1.json()
      const list = Array.isArray(data) ? data : Object.values(data as Record<string, unknown>)
      if (list.length > 0) {
        return NextResponse.json(list, {
          headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=30' },
        })
      }
    }
  } catch { /* fall through */ }

  // Fallback: public endpoint top_models
  try {
    const r2 = await fetch(`${VPS}/api/public`, {
      signal: AbortSignal.timeout(8000),
    })
    if (r2.ok) {
      const d = await r2.json()
      const list = d?.top_models ?? []
      return NextResponse.json(list, {
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=30' },
      })
    }
  } catch { /* fall through */ }

  return NextResponse.json([], { status: 200 })
}
