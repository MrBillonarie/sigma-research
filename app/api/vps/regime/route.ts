import { NextResponse } from 'next/server'

const VPS = process.env.VPS_URL ?? process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'

export async function GET() {
  try {
    const res = await fetch(`${VPS}/api/regime`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 300 },
    })
    if (!res.ok) return NextResponse.json({}, { status: 200 })
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch {
    return NextResponse.json({})
  }
}
