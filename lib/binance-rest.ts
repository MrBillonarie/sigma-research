export async function getBtcPrice(): Promise<number> {
  const res  = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', {
    cache: 'no-store',
  })
  const data = await res.json()
  return parseFloat(data.price)
}

export interface Kline {
  open:  number
  high:  number
  low:   number
  close: number
}

// Últimas 24 velas de 1h para cálculo de régimen
export async function getBtcKlines24h(): Promise<Kline[]> {
  const res  = await fetch(
    'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24',
    { cache: 'no-store' }
  )
  const raw = await res.json()
  console.log('[binance-rest] klines raw:', JSON.stringify(raw).slice(0, 200))
  const data: string[][] = Array.isArray(raw) ? raw : []
  return data.map((k) => ({
    open:  parseFloat(k[1]),
    high:  parseFloat(k[2]),
    low:   parseFloat(k[3]),
    close: parseFloat(k[4]),
  }))
}
