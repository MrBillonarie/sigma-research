import { getBtcKlines24h } from './binance-rest'

export interface RegimeResult {
  regime:           'ranging' | 'compression' | 'trending' | 'none'
  score:            number      // 0–100: 0 = trending fuerte, 100 = lateral puro
  atr24hPct:        number      // ATR 24h como % del precio actual
  rangeWidth24hPct: number      // (high - low) / precio, últimas 24h
  description:      string
}

export async function detectRegime(btcPrice: number): Promise<RegimeResult> {
  const raw    = await getBtcKlines24h()
  const klines = Array.isArray(raw) && raw.length > 0 ? raw : []

  if (klines.length === 0) {
    console.warn('[regime-detector] klines empty, returning neutral regime')
    return { regime: 'none', score: 0, atr24hPct: 0, rangeWidth24hPct: 0, description: 'Sin datos de klines.' }
  }

  // ATR proxy: promedio de (high - low) por vela 1h
  const atrRaw   = klines.reduce((sum, k) => sum + (k.high - k.low), 0) / klines.length
  const atrPct   = (atrRaw / btcPrice) * 100

  // Rango total 24h
  const high24         = Math.max(...(Array.isArray(klines) ? klines : []).map((k) => k.high))
  const low24          = Math.min(...(Array.isArray(klines) ? klines : []).map((k) => k.low))
  const rangeWidth24hPct = ((high24 - low24) / btcPrice) * 100

  // ADX proxy: alternancia de velas (up/down) → alta = lateral, baja = tendencia
  let dirChanges = 0
  for (let i = 1; i < klines.length; i++) {
    const prevDir = klines[i - 1].close > klines[i - 1].open ? 1 : -1
    const currDir = klines[i].close     > klines[i].open     ? 1 : -1
    if (prevDir !== currDir) dirChanges++
  }
  const directionScore = klines.length > 1 ? dirChanges / (klines.length - 1) : 0

  // Score 0–100 (100 = completamente lateral)
  const score = Math.round(
    directionScore * 40 +
    Math.max(0, 1 - rangeWidth24hPct / 8) * 40 +   // rango < 8% aporta pts
    Math.max(0, 1 - atrPct / 1.5) * 20              // ATR < 1.5% aporta pts
  )

  let regime:      RegimeResult['regime']
  let description: string

  if (score >= 65) {
    regime      = 'ranging'
    description = `BTC lateral confirmado. Rango 24h: ${rangeWidth24hPct.toFixed(1)}%. ATR: ${atrPct.toFixed(2)}%. Setup LP óptimo.`
  } else if (score >= 45) {
    regime      = 'compression'
    description = `BTC en compresión. Score ${score}/100. Posible impulso inminente. Esperar confirmación.`
  } else {
    regime      = 'trending'
    description = `BTC en tendencia. Rango 24h: ${rangeWidth24hPct.toFixed(1)}%. IL riesgo alto. Capital en futuros.`
  }

  return { regime, score, atr24hPct: atrPct, rangeWidth24hPct, description }
}
