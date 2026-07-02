import { NextResponse } from 'next/server'

const VPS = process.env.VPS_URL ?? process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'

export async function GET() {
  try {
    const res = await fetch(`${VPS}/api/v2/portfolio`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 60 },
    })
    if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: 502 })
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch {
    return NextResponse.json({ error: 'timeout' }, { status: 504 })
  }
}
