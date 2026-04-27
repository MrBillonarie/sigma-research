import { NextRequest, NextResponse } from 'next/server'
import { generateReport }            from '@/lib/reportGen'
import type { Asset, Allocation, PortfolioMetrics, FlowSignal, Profile } from '@/types/decision-engine'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      profile:     Profile
      assets:      Asset[]
      allocation:  Allocation
      metrics:     PortfolioMetrics
      flowSignals: FlowSignal[]
      flowScore:   number
    }

    const { profile, assets, allocation, metrics, flowSignals, flowScore } = body

    if (!profile || !assets?.length) {
      return NextResponse.json({ ok: false, error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const report = generateReport(profile, assets, allocation, metrics, flowSignals, flowScore)
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[motor/report]', err)
    return NextResponse.json({ ok: false, error: 'Error generando reporte' }, { status: 500 })
  }
}
