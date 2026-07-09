import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { verifyEngineMonitorSession } from '@/lib/engineMonitorAuth'

export const dynamic = 'force-dynamic'

const VPS = process.env.VPS_INTERNAL ?? process.env.VPS_URL ?? 'http://127.0.0.1:8080'

// Símbolos base que NO existen como {SYM}USDT en Binance Futures (fapi) — se
// resuelven desde los caches yfinance del motor (M2 commodities / M3 stocks).
// NG (gas natural) es el caso conocido: fapi responde -1121 "Invalid symbol".
const M2_SET = new Set(['XAU', 'XAG', 'HG', 'NG', 'WTI', 'PL', 'XPD', 'URNM'])
const M3_SET = new Set(['AAPL', 'NVDA', 'TSLA', 'JPM', 'CVX'])

function makeClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

function priceOf(raw: unknown): number | null {
  const n = typeof raw === 'string' ? parseFloat(raw) : typeof raw === 'number' ? raw : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

// Cache corto de los mapas del motor para no golpear yfinance en cada render.
async function motorPrice(base: string): Promise<number | null> {
  const path = M2_SET.has(base) ? '/api/m2_prices' : M3_SET.has(base) ? '/api/m3_prices' : null
  if (!path) return null
  try {
    const res = await fetch(`${VPS}${path}`, { signal: AbortSignal.timeout(6000), cache: 'no-store' })
    if (!res.ok) return null
    const map = await res.json()
    return priceOf(map?.[base])
  } catch {
    return null
  }
}

async function binanceFapi(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
      { signal: AbortSignal.timeout(6000), cache: 'no-store' }
    )
    if (!res.ok) return null
    const d = await res.json()
    return priceOf(d?.price) // símbolos inválidos traen {code,msg} → price undefined → null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  // Puerta de auth coherente con /api/vps/*. Los precios son públicos, así que
  // ante no-auth devolvemos price:null (el motor cae a `entry`, sin regresión).
  const { data: { user } } = await makeClient().auth.getUser()
  const engineCookie = cookies().get('sigma_engine_session')?.value
  if (!user && !verifyEngineMonitorSession(engineCookie)) {
    return NextResponse.json({ price: null }, { status: 200 })
  }

  const raw = (req.nextUrl.searchParams.get('symbol') ?? '').toUpperCase()
  // El motor pide `${sym}USDT`. Validar duro para evitar SSRF hacia fapi.
  if (!/^[A-Z0-9]{4,15}$/.test(raw)) {
    return NextResponse.json({ price: null, error: 'bad symbol' }, { status: 200 })
  }

  // 1) Binance Futures (fuente primaria, igual que el motor original).
  let price = await binanceFapi(raw)
  let source = 'fapi'

  // 2) Fallback: símbolos sin par en fapi (NG, y cualquier otro M2/M3) →
  //    caches yfinance del motor. Base = símbolo sin sufijo USDT.
  if (price === null && raw.endsWith('USDT')) {
    const base = raw.slice(0, -4)
    price = await motorPrice(base)
    source = 'motor'
  }

  return NextResponse.json(
    { symbol: raw, price, source: price === null ? 'none' : source },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
