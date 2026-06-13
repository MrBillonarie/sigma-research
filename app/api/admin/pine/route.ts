import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'

// Motor definitions served via proxy to Python backend
const MOTORS: Record<string, { label: string; endpoint: string }> = {
  '1': { label: 'SIGMA K1 — Motor 1 (Multi-TF Production)',   endpoint: 'pine_motor1' },
  '2': { label: 'SIGMA v13 COMPLETO — Motor 2 (Multi-Asset)', endpoint: 'pine_motor2' },
}

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const motor = searchParams.get('motor')
  const action = searchParams.get('action') ?? 'info'

  // List available motors
  if (action === 'list' || !motor) {
    try {
      const res = await fetch('http://localhost:8080/api/pine_status', {
        headers: { 'X-Internal-Proxy': 'next-sigma' },
        signal: AbortSignal.timeout(5000),
      })
      const status = res.ok ? await res.json() : {}
      return NextResponse.json({
        ok: true,
        motors: [
          {
            id: '1',
            label: 'Motor 1 — SIGMA K1 Multi-TF',
            description: 'Estrategias de producción por timeframe (1m/5m/15m/1h/4h)',
            files: status?.motor1_files ?? [],
            lastUpdate: status?.motor1_updated ?? null,
            validationStatus: status?.motor1_valid ?? 'unknown',
          },
          {
            id: '2',
            label: 'Motor 2 — SIGMA v13 COMPLETO',
            description: 'Script completo multi-activo con 20 modelos (BTC/ETH/SOL/XAU/etc)',
            files: status?.motor2_files ?? ['SIGMA_v13_COMPLETO.pine'],
            lastUpdate: status?.motor2_updated ?? null,
            validationStatus: status?.motor2_valid ?? 'unknown',
          },
        ],
      })
    } catch {
      return NextResponse.json({ ok: true, motors: [] })
    }
  }

  // Download a specific motor's Pine file
  if (action === 'download') {
    const motorDef = MOTORS[motor]
    if (!motorDef) {
      return NextResponse.json({ error: 'Motor no válido' }, { status: 400 })
    }

    try {
      const res = await fetch(`http://localhost:8080/api/${motorDef.endpoint}`, {
        headers: { 'X-Internal-Proxy': 'next-sigma' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`backend ${res.status}`)
      const data = await res.json() as { content?: string; filename?: string }
      const content  = data.content  ?? ''
      const filename = data.filename ?? `sigma_motor${motor}.pine`
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, no-cache',
        },
      })
    } catch {
      return NextResponse.json({ error: 'Backend no disponible. Intenta de nuevo.' }, { status: 502 })
    }
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}

// Trigger Pine validation
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const res = await fetch('http://localhost:8080/api/pine_validate', {
      method: 'POST',
      headers: { 'X-Internal-Proxy': 'next-sigma', 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`backend ${res.status}`)
    const result = await res.json()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
