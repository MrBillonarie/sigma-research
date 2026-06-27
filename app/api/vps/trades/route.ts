import { NextResponse } from 'next/server'

const VPS = process.env.VPS_URL ?? 'http://178.104.10.97:8080'

export async function GET() {
  try {
    const res = await fetch(`${VPS}/api/trades`, {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ open: [], history: [], stats: {}, portfolio: {} })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ open: [], history: [], stats: {}, portfolio: {} })
  }
}
