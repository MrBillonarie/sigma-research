import { NextResponse } from 'next/server'

const VPS = process.env.VPS_URL ?? 'http://178.104.10.97:8080'

export async function GET() {
  try {
    const res = await fetch(`${VPS}/api/v2/champions`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`VPS ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'VPS no disponible', details: String(e) },
      { status: 503 }
    )
  }
}
