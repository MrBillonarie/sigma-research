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
  // El motor pide `${sym}USDT`. Validar duro para evitar SSRF hacia Binance.
  if (!/^[A-Z0-9]{4,15}$/.test(raw)) {
    return NextResponse.json({ price: null, error: 'bad symbol' }, { status: 200 })
  }
  const base = raw.endsWith('USDT') ? raw.slice(0, -4) : raw

  let price: number | null = null
  let source = 'none'

  // Prioridad por clase de activo (correctitud financiera):
  //  - Stocks M3: yfinance real. En Futures {SYM}USDT existe pero CVXUSDT es
  //    "Convex Finance" (cripto), NO Chevron → NUNCA usar fapi de primario aquí.
  //  - Commodities M2: cache yfinance del motor (no tienen par en spot v3).
  //  - Resto (cripto + índices SPY/QQQ/IWM/XLE): perp de Binance Futures, que sí
  //    lista los perps tradfi que el spot v3 del motor no tenía.
  if (M3_SET.has(base)) {
    price = await motorPrice(base); source = 'motor'
    if (price === null) { price = await binanceFapi(raw); source = 'fapi' }
  } else if (M2_SET.has(base)) {
    price = await motorPrice(base); source = 'motor'
    if (price === null) { price = await binanceFapi(raw); source = 'fapi' }
  } else {
    price = await binanceFapi(raw); source = 'fapi'
    if (price === null) { price = await motorPrice(base); source = 'motor' }
  }

  return NextResponse.json(
    { symbol: raw, price, source: price === null ? 'none' : source },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
