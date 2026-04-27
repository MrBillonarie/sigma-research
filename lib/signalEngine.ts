import type { Asset, AssetClass, SignalType, FlowSignal } from '@/types/decision-engine'

// ─── RSI suavizado con función continua (tanh) ────────────────────────────────
// Antes: tabla de lookup. Ahora: curva S continua centrada en 50 cuando r1m=0
function simRSI(r1m: number): number {
  return Math.round(50 + 45 * Math.tanh(r1m / 8))
}

// ─── Consistencia entre plazos (-1 = todos negativos, 1 = todos positivos) ───
// Si 1m, 3m y 1y apuntan en la misma dirección la señal es más fiable
function timeframeConsistency(r1m: number, r3m: number, r1y: number): number {
  const signs = [Math.sign(r1m), Math.sign(r3m / 3), Math.sign(r1y / 12)]
  return signs.reduce((a, b) => a + b, 0) / 3
}

// ─── Flujo neto proxy: aceleración reciente vs tendencia 3m ──────────────────
function simNetFlow(r1m: number, r3m: number): number {
  const avg3m = r3m / 3
  const diff  = r1m - avg3m
  return Math.max(-100, Math.min(100, diff * 8))
}

// ─── Momentum: aceleración respecto a tendencias de fondo ────────────────────
function simMomentum(r1m: number, r3m: number, r1y: number): number {
  const avg3m = r3m / 3
  const avg1y = r1y / 12
  return r1m - avg3m * 0.5 - avg1y * 0.5
}

// ─── Volatilidad anualizada proxy ────────────────────────────────────────────
function simVolatility(r1m: number, r3m: number, r1y: number, ac: AssetClass): number {
  const BASE: Record<AssetClass, number> = {
    fondos: 8, etfs: 14, renta_fija: 3, crypto: 60,
  }
  const spread = Math.abs(r1m - r3m / 3) + Math.abs(r3m / 3 - r1y / 12)
  return Math.round((BASE[ac] + spread * 0.5) * 100) / 100
}

// ─── Señal con confirmación multi-plazo ──────────────────────────────────────
// Las señales fuertes requieren que todos los plazos estén alineados
function getSignal(rsi: number, netFlow: number, r1m: number, mom: number, consistency: number): SignalType {
  // Comprar: sobreventa + flujo positivo + tendencia confirmada
  if (rsi < 35 && netFlow > 0 && consistency > 0)     return 'comprar'
  // Reducir: sobrecompra + flujo negativo + tendencia confirmada
  if (rsi > 70 && netFlow < 0 && consistency < 0)     return 'reducir'
  // Momentum fuerte con al menos 2 de 3 plazos alineados
  if (r1m > 4 && mom > 1 && consistency >= 0)         return 'comprar'
  if (r1m < -4 && mom < -1 && consistency <= 0)       return 'reducir'
  // Señales de oversold/overbought sin confirmación completa
  if (rsi < 40 && netFlow > 15)                       return 'comprar'
  if (rsi > 75 && netFlow < -15)                      return 'reducir'
  if (Math.abs(r1m) < 1 && Math.abs(mom) < 0.3)      return 'neutral'
  return 'mantener'
}

// ─── Score 0-100 con proxy Sharpe y bonus de consistencia temporal ────────────
// Pesos: 25% momentum, 20% RSI, 20% flujo, 20% retorno, 15% Sharpe proxy
// + bonus ±12 según alineación de los tres plazos
function calcScore(
  rsi: number, netFlow: number, mom: number,
  r1m: number, r1y: number, vol: number, consistency: number,
): number {
  const momScore    = Math.min(100, Math.max(0, mom * 6 + 50))
  const rsiScore    = rsi < 30 ? 85 : rsi < 50 ? 70 : rsi < 65 ? 65 : rsi < 75 ? 45 : 20
  const flowScore   = Math.min(100, Math.max(0, netFlow + 50))
  const retScore    = Math.min(100, Math.max(0, (r1y / 12 + 1.5) * 12))
  // Sharpe proxy: retorno ajustado por riesgo relativo a tasa libre (4.5%)
  const sharpeProxy = vol > 0 ? Math.min(100, Math.max(0, ((r1y - 4.5) / vol) * 30 + 50)) : 50

  const raw   = momScore * 0.25 + rsiScore * 0.20 + flowScore * 0.20 + retScore * 0.20 + sharpeProxy * 0.15
  const bonus = consistency * 12  // -12 a +12 según alineación de plazos
  return Math.round(Math.min(100, Math.max(0, raw + bonus)))
}

// ─── Interface de entrada ─────────────────────────────────────────────────────
export interface RawAsset {
  id:         string
  name:       string
  ticker?:    string
  assetClass: AssetClass
  category?:  string
  r1m:        number
  r3m:        number
  r1y:        number
}

// ─── Procesar un activo raw → Asset con señal y score ────────────────────────
export function processAsset(raw: RawAsset): Asset {
  const rsi         = simRSI(raw.r1m)
  const netFlow     = simNetFlow(raw.r1m, raw.r3m)
  const mom         = simMomentum(raw.r1m, raw.r3m, raw.r1y)
  const vol         = simVolatility(raw.r1m, raw.r3m, raw.r1y, raw.assetClass)
  const consistency = timeframeConsistency(raw.r1m, raw.r3m, raw.r1y)
  const signal      = getSignal(rsi, netFlow, raw.r1m, mom, consistency)
  const score       = calcScore(rsi, netFlow, mom, raw.r1m, raw.r1y, vol, consistency)

  return {
    id: raw.id, name: raw.name, ticker: raw.ticker,
    assetClass: raw.assetClass, category: raw.category,
    return30d: raw.r1m, return90d: raw.r3m, return1y: raw.r1y,
    netFlow, rsi, momentum: mom, volatility: vol, signal, score,
  }
}

// ─── Ranking cross-seccional dentro de cada clase de activo ──────────────────
// Factor momentum comprobado empíricamente (Fama-French, Carhart 1997)
// Un activo con score 70 dentro de su clase es más relevante que uno con 70
// en otra clase donde todos tienen 80+. El rank relativo importa.
export function applyCrossSection(assets: Asset[]): Asset[] {
  const classes: AssetClass[] = ['fondos', 'etfs', 'renta_fija', 'crypto']
  const byClass = new Map<AssetClass, Asset[]>()
  classes.forEach(cls => byClass.set(cls, assets.filter(a => a.assetClass === cls)))

  return assets.map(asset => {
    const group = byClass.get(asset.assetClass) ?? []
    if (group.length <= 1) return asset

    const sorted = [...group].sort((a, b) => b.score - a.score)
    const idx    = sorted.findIndex(a => a.id === asset.id)
    const pct    = idx / (sorted.length - 1)   // 0 = top, 1 = bottom
    const rank   = Math.round((1 - pct) * 100) // 100 = top de clase, 0 = bottom

    // 50% score absoluto + 50% ranking relativo dentro de la clase
    return { ...asset, score: Math.round(asset.score * 0.5 + rank * 0.5) }
  })
}

// ─── Flujo neto por mercado ───────────────────────────────────────────────────
const FLOW_LABELS: Record<AssetClass, string> = {
  fondos:     'Fondos Mutuos',
  etfs:       'ETFs Globales',
  renta_fija: 'Renta Fija',
  crypto:     'Crypto',
}

const FLOW_COLORS: Record<AssetClass, string> = {
  fondos:     '#1D9E75',
  etfs:       '#378ADD',
  renta_fija: '#d4af37',
  crypto:     '#a78bfa',
}

export function computeFlowSignals(assets: Asset[]): FlowSignal[] {
  const classes: AssetClass[] = ['fondos', 'etfs', 'renta_fija', 'crypto']

  return classes.map(cls => {
    const group   = assets.filter(a => a.assetClass === cls)
    const avgFlow = group.length
      ? group.reduce((s, a) => s + a.netFlow, 0) / group.length
      : 0

    const inflow  = Math.round(Math.min(100, Math.max(0, 50 + avgFlow * 0.5)))
    const outflow = 100 - inflow
    const net     = inflow - outflow
    const trend: FlowSignal['trend'] = net > 5 ? 'entrando' : net < -5 ? 'saliendo' : 'neutro'

    return {
      market:  FLOW_LABELS[cls],
      inflow, outflow, net, trend,
      color: FLOW_COLORS[cls],
    }
  })
}

// ─── Score global de flujo ponderado por convicción ───────────────────────────
// Antes: conteo simple de señales. Ahora: ponderado por score de cada activo
export function computeFlowScore(assets: Asset[]): number {
  if (!assets.length) return 50
  const totalScore = assets.reduce((s, a) => s + a.score, 0) || 1
  const bullScore  = assets.filter(a => a.signal === 'comprar').reduce((s, a) => s + a.score, 0)
  const holdScore  = assets.filter(a => a.signal === 'mantener').reduce((s, a) => s + a.score, 0)
  return Math.round(((bullScore * 2 + holdScore) / (totalScore * 2)) * 100)
}
