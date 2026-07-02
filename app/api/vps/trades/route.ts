import { NextResponse } from 'next/server'

const VPS = process.env.VPS_URL ?? process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'

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
