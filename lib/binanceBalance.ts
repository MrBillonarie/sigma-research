import crypto from 'crypto'

const SPOT_BASE = 'https://api.binance.com'
const FAPI_BASE = 'https://fapi.binance.com'

function sign(secret: string, query: string): string {
  return crypto.createHmac('sha256', secret).update(query).digest('hex')
}

interface BinanceCreds { apiKey: string; apiSecret: string }
type BalanceResult = { ok: true; usd: number } | { ok: false; error: string }

async function signedGet(base: string, path: string, creds: BinanceCreds): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const timestamp = Date.now()
    const query = `timestamp=${timestamp}`
    const signature = sign(creds.apiSecret, query)
    const res = await fetch(`${base}${path}?${query}&signature=${signature}`, {
      headers: { 'X-MBX-APIKEY': creds.apiKey },
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    if (data?.code) {
      const msg = data.code === -2015 || data.code === -1102
        ? 'API key inválida o sin permisos de lectura'
        : data.code === -1021 ? 'Error de sincronización de tiempo con Binance'
        : `Binance ${data.code}: ${data.msg ?? 'error desconocido'}`
      return { ok: false, error: msg }
    }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// Wallet total de Binance Futures (USDT-margined) — campo balance del activo USDT.
export async function getFuturesBalanceUSD(creds: BinanceCreds): Promise<BalanceResult> {
  const res = await signedGet(FAPI_BASE, '/fapi/v2/balance', creds)
  if (!res.ok) return res
  const rows = res.data as { asset: string; balance: string }[]
  const usdt = rows.find(r => r.asset === 'USDT')
  return { ok: true, usd: usdt ? parseFloat(usdt.balance) : 0 }
}

// Wallet total de Binance Spot, convertido a USD vía precios públicos en vivo.
// Asume USDT/USDC/BUSD ≈ 1 USD; el resto se valoriza contra USDT.
export async function getSpotBalanceUSD(creds: BinanceCreds): Promise<BalanceResult> {
  const accRes = await signedGet(SPOT_BASE, '/api/v3/account', creds)
  if (!accRes.ok) return accRes

  const balances = (accRes.data as { balances: { asset: string; free: string; locked: string }[] }).balances
    .map(b => ({ asset: b.asset, total: parseFloat(b.free) + parseFloat(b.locked) }))
    .filter(b => b.total > 0)

  if (balances.length === 0) return { ok: true, usd: 0 }

  const STABLES = new Set(['USDT', 'USDC', 'BUSD', 'FDUSD'])
  const nonStable = balances.filter(b => !STABLES.has(b.asset))

  let prices: Record<string, number> = {}
  if (nonStable.length > 0) {
    try {
      const res = await fetch(`${SPOT_BASE}/api/v3/ticker/price`, { signal: AbortSignal.timeout(8000) })
      const all = await res.json() as { symbol: string; price: string }[]
      prices = Object.fromEntries(all.map(p => [p.symbol, parseFloat(p.price)]))
    } catch { /* si falla, los activos no-estables se valorizan en 0 */ }
  }

  const usd = balances.reduce((sum, b) => {
    if (STABLES.has(b.asset)) return sum + b.total
    const price = prices[`${b.asset}USDT`] ?? 0
    return sum + b.total * price
  }, 0)

  return { ok: true, usd }
}
