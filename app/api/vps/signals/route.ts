export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPlanInfo, stripActionableFields } from '@/lib/plan'

const VPS = process.env.VPS_URL ?? process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'

export async function GET() {
  try {
    const [{ isPro }, res] = await Promise.all([
      getPlanInfo(),
      fetch(`${VPS}/api/public`, { signal: AbortSignal.timeout(8000) }),
    ])
    if (!res.ok) throw new Error(`VPS ${res.status}`)
    const data = await res.json()

    // Gating por plan: el proof-of-work (portfolio, open_trades, history,
    // regime) es libre — es lo que vende. Lo accionable (entrada/SL/TP y
    // sizing en señales y modelos) es PRO.
    if (!isPro) {
      data.top_models = stripActionableFields(data.top_models)
      data.signals    = stripActionableFields(data.signals)
      data.gated      = true   // hint para que la UI muestre el upsell PRO
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'VPS no disponible', details: String(e) },
      { status: 503 }
    )
  }
}
