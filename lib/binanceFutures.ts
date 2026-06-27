import crypto from 'crypto'

const BASE = 'https://fapi.binance.com'

function sign(secret: string, query: string): string {
  return crypto.createHmac('sha256', secret).update(query).digest('hex')
}

interface BinanceCreds {
  apiKey:    string
  apiSecret: string
}

// Orden MARKET real en Binance Futures — usada por el cron de copytrading.
// side: 'BUY' (entrada long) | 'SELL' (entrada short)
export async function placeFuturesMarketOrder(
  creds: BinanceCreds,
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: number
): Promise<{ ok: true; orderId: number | string } | { ok: false; error: string }> {
  try {
    const timestamp = Date.now()
    const query = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`
    const signature = sign(creds.apiSecret, query)

    const res = await fetch(`${BASE}/fapi/v1/order?${query}&signature=${signature}`, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': creds.apiKey },
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()

    if (data.code) {
      return { ok: false, error: `Binance ${data.code}: ${data.msg ?? 'error desconocido'}` }
    }
    return { ok: true, orderId: data.orderId }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// Info del símbolo (precio + stepSize) — necesario para redondear quantity
// al múltiplo válido que acepta Binance Futures para ese par.
export async function getSymbolInfo(symbol: string): Promise<{ price: number; stepSize: number } | null> {
  try {
    const [priceRes, exchangeRes] = await Promise.all([
      fetch(`${BASE}/fapi/v1/ticker/price?symbol=${symbol}`, { signal: AbortSignal.timeout(8000) }),
      fetch(`${BASE}/fapi/v1/exchangeInfo`, { signal: AbortSignal.timeout(8000), cache: 'no-store' }),
    ])
    const priceData = await priceRes.json()
    const exchangeData = await exchangeRes.json()

    const price = parseFloat(priceData.price)
    const symbolInfo = exchangeData.symbols?.find((s: { symbol: string }) => s.symbol === symbol)
    const lotSizeFilter = symbolInfo?.filters?.find((f: { filterType: string }) => f.filterType === 'LOT_SIZE')
    const stepSize = lotSizeFilter ? parseFloat(lotSizeFilter.stepSize) : 0.001

    if (!price || isNaN(price)) return null
    return { price, stepSize }
  } catch {
    return null
  }
}

// Redondea quantity hacia abajo al múltiplo de stepSize que acepta Binance.
export function roundToStepSize(quantity: number, stepSize: number): number {
  const precision = Math.max(0, Math.round(-Math.log10(stepSize)))
  const rounded = Math.floor(quantity / stepSize) * stepSize
  return parseFloat(rounded.toFixed(precision))
}
