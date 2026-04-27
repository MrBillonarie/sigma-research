import type { Asset, AssetClass, SignalType, FlowSignal } from '@/types/decision-engine'

// ─── RSI proxy desde retorno 1m ──────────────────────────────────────────────
function simRSI(r1m: number): number {
  if (r1m > 10) return 85
  if (r1m > 7)  return 78
  if (r1m > 4)  return 68
  if (r1m > 2)  return 60
  if (r1m > 0)  return 53
  if (r1m > -2) return 46
  if (r1m > -5) return 37
  if (r1m > -8) return 30
  return 22
}

// ─── Flujo neto proxy: 1m vs tendencia 3m ────────────────────────────────────
function simNetFlow(r1m: number, r3m: number): number {
  const avg3m = r3m / 3
  const diff  = r1m - avg3m
  return Math.max(-100, Math.min(100, diff * 8))
}

// ─── Momentum: aceleración del retorno ───────────────────────────────────────
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

// ─── Reglas de señal ─────────────────────────────────────────────────────────
function getSignal(rsi: number, netFlow: number, r1m: number, mom: number): SignalType {
  if (rsi > 70 && netFlow < 0)   return 'reducir'
  if (rsi < 40 && netFlow > 0)   return 'comprar'
  if (r1m > 3  && mom > 0.5)    return 'comprar'
  if (r1m < -3 && mom < -0.5)   return 'reducir'
  if (Math.abs(r1m) < 1 && Math.abs(mom) < 0.3) return 'neutral'
  return 'mantener'
}

// ─── Score 0-100 (mayor = más atractivo) ─────────────────────────────────────
function calcScore(rsi: number, netFlow: number, mom: number, r1m: number, r1y: number): number {
  const momScore  = Math.min(100, Math.max(0, mom * 6 + 50))
  const rsiScore  = rsi < 30 ? 85 : rsi < 50 ? 70 : rsi < 65 ? 65 : rsi < 75 ? 45 : 20
  const flowScore = Math.min(100, Math.max(0, netFlow + 50))
  const retScore  = Math.min(100, Math.max(0, (r1y / 12 + 1.5) * 12))
  return Math.round(momScore * 0.30 + rsiScore * 0.25 + flowScore * 0.25 + retScore * 0.20)
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
  const rsi     = simRSI(raw.r1m)
  const netFlow = simNetFlow(raw.r1m, raw.r3m)
  const mom     = simMomentum(raw.r1m, raw.r3m, raw.r1y)
  const vol     = simVolatility(raw.r1m, raw.r3m, raw.r1y, raw.assetClass)
  const signal  = getSignal(rsi, netFlow, raw.r1m, mom)
  const score   = calcScore(rsi, netFlow, mom, raw.r1m, raw.r1y)

  return {
    id: raw.id, name: raw.name, ticker: raw.ticker,
    assetClass: raw.assetClass, category: raw.category,
    return30d: raw.r1m, return90d: raw.r3m, return1y: raw.r1y,
    netFlow, rsi, momentum: mom, volatility: vol, signal, score,
  }
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

// ─── Score global de flujo del mercado (0-100) ───────────────────────────────
export function computeFlowScore(assets: Asset[]): number {
  const total = assets.length
  if (!total) return 50
  const buys  = assets.filter(a => a.signal === 'comprar').length
  const holds = assets.filter(a => a.signal === 'mantener').length
  return Math.round(((buys * 2 + holds) / (total * 2)) * 100)
}
