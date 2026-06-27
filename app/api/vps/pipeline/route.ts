import { NextResponse } from 'next/server'

const VPS = process.env.VPS_URL ?? 'http://178.104.10.97:8080'

export async function GET() {
  try {
    const res = await fetch(`${VPS}/api/pipeline_events`, {
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ events: [] })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ events: [] })
  }
}
