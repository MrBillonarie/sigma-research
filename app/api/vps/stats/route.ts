import { NextResponse } from 'next/server'

const VPS = process.env.VPS_URL ?? 'http://178.104.10.97:8080'

export async function GET() {
  try {
    const res = await fetch(`${VPS}/api/stats`, {
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ total: 0, optuna_rate_hr: 0, by_tf: {} }, { status: 200 })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ total: 0, optuna_rate_hr: 0, by_tf: {} })
  }
}
