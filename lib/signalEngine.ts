import type { Asset, AssetClass, SignalType, FlowSignal, MarketRegime, TradeStatus } from '@/types/decision-engine'

// ─── RSI real de Wilder (14 períodos) ────────────────────────────────────────
// Requiere al menos 15 cierres. Con 28 cierres: 14 para SMA inicial + 13 de
// suavizado Wilder → resultado más preciso que la curva tanh.
function realRSI(closes: number[]): number {
  if (closes.length < 15) return -1
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  let avgGain = 0, avgLoss = 0
  for (let i = 0; i < 14; i++) {
    if (changes[i] >= 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= 14
  avgLoss /= 14
  for (let i = 14; i < changes.length; i++) {
    const g = changes[i] >= 0 ? changes[i] : 0
    const l = changes[i] <  0 ? Math.abs(changes[i]) : 0
    avgGain = (avgGain * 13 + g) / 14
    avgLoss = (avgLoss * 13 + l) / 14
  }
  if (avgLoss === 0) return 100
  return Math.round(100 - 100 / (1 + avgGain / avgLoss))
}

// ─── Volatilidad real anualizada desde cierres diarios ───────────────────────
// std(daily_returns) * sqrt(252) * 100 → porcentaje anualizado
// Con closes28 tenemos 27 retornos → estimación razonable
export function realVolatility(closes: number[]): number {
  if (closes.length < 10) return -1
  const rets = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i])
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1)
  return Math.round(Math.sqrt(variance * 252) * 100 * 100) / 100
}

// ─── RSI aproximado con tanh (fallback cuando no hay precio histórico) ────────
function simRSI(r1m: number): number {
  return Math.round(50 + 45 * Math.tanh(r1m / 8))
}

// ─── Consistencia entre plazos (-1 = todos negativos, 1 = todos positivos) ───
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
function getSignal(rsi: number, netFlow: number, r1m: number, mom: number, consistency: number): SignalType {
  if (rsi < 35 && netFlow > 0 && consistency > 0)     return 'comprar'
  if (rsi > 70 && netFlow < 0 && consistency < 0)     return 'reducir'
  if (r1m > 4 && mom > 1 && consistency >= 0)         return 'comprar'
  if (r1m < -4 && mom < -1 && consistency <= 0)       return 'reducir'
  if (rsi < 40 && netFlow > 15)                       return 'comprar'
  if (rsi > 75 && netFlow < -15)                      return 'reducir'
  if (Math.abs(r1m) < 1 && Math.abs(mom) < 0.3)      return 'neutral'
  return 'mantener'
}

// ─── Score 0-100 ──────────────────────────────────────────────────────────────
function calcScore(
  rsi: number, netFlow: number, mom: number,
  r1m: number, r1y: number, vol: number, consistency: number,
): number {
  const momScore    = Math.min(100, Math.max(0, mom * 6 + 50))
  const rsiScore    = rsi < 30 ? 85 : rsi < 50 ? 70 : rsi < 65 ? 65 : rsi < 75 ? 45 : 20
  const flowScore   = Math.min(100, Math.max(0, netFlow + 50))
  const retScore    = Math.min(100, Math.max(0, (r1y / 12 + 1.5) * 12))
  const sharpeProxy = vol > 0 ? Math.min(100, Math.max(0, ((r1y - 4.5) / vol) * 30 + 50)) : 50
  const raw   = momScore * 0.25 + rsiScore * 0.20 + flowScore * 0.20 + retScore * 0.20 + sharpeProxy * 0.15
  const bonus = consistency * 12
  return Math.round(Math.min(100, Math.max(0, raw + bonus)))
}

// ─── Detección de régimen de mercado ─────────────────────────────────────────
// SPY 1m vs TLT 1m + volatilidad implícita → risk-on / risk-off / neutral.
// risk-on  : renta variable sube, bonos bajan → apetito por riesgo.
// risk-off : renta variable cae, bonos suben o vol elevada → vuelo a calidad.
export function detectMarketRegime(
  spyCloses: number[],
  spyR1m:    number,
  tltR1m:    number,
): MarketRegime {
  const spyVol      = spyCloses.length >= 10 ? realVolatility(spyCloses) : 15
  const equitiesUp  = spyR1m >  2
  const equitiesDown= spyR1m < -2
  const bondsUp     = tltR1m >  1
  const bondsDown   = tltR1m < -1
  const highVol     = spyVol > 22
  if (equitiesDown && (bondsUp  || highVol)) return 'risk-off'
  if (equitiesUp   &&  bondsDown)            return 'risk-on'
  if (highVol)                               return 'risk-off'
  return 'neutral'
}

// ─── Confianza de señal: % de indicadores que coinciden con la señal ─────────
// 4 votos: RSI, netFlow, momentum, consistency. Cada uno vale 0 / 0.5 / 1.
function calcConfidence(
  rsi: number, netFlow: number, mom: number,
  consistency: number, signal: SignalType,
): number {
  if (signal === 'neutral') return 50
  const buy = signal === 'comprar'
  const votes = [
    buy ? (rsi < 50 ? 1 : rsi < 60 ? 0.5 : 0)       : (rsi > 60 ? 1 : rsi > 50 ? 0.5 : 0),
    buy ? (netFlow > 10 ? 1 : netFlow > 0 ? 0.5 : 0) : (netFlow < -10 ? 1 : netFlow < 0 ? 0.5 : 0),
    buy ? (mom > 1 ? 1 : mom > 0 ? 0.5 : 0)          : (mom < -1 ? 1 : mom < 0 ? 0.5 : 0),
    buy ? (consistency > 0.33 ? 1 : consistency > 0 ? 0.5 : 0)
        : (consistency < -0.33 ? 1 : consistency < 0 ? 0.5 : 0),
  ]
  return Math.round(votes.reduce((a, b) => a + b, 0) / 4 * 100)
}

// ─── Contador de condiciones cumplidas (estilo HUD X/8) ───────────────────────
// 8 condiciones binarias que reflejan calidad de la tesis según la dirección.
function calcConditions(
  rsi: number, netFlow: number, mom: number, consistency: number,
  r1m: number, r1y: number, confidence: number, score: number,
  signal: SignalType,
): { met: number; total: number } {
  const total = 8
  if (signal === 'comprar') {
    return { total, met: [
      rsi < 55,          // no sobrecomprado
      netFlow > 0,       // flujo positivo
      mom > 0.5,         // momentum significativo
      consistency > 0,   // todos los plazos alineados
      r1m > 0,           // retorno reciente positivo
      r1y > 4.5,         // supera tasa libre de riesgo
      confidence > 50,   // mayoría de indicadores coinciden
      score > 55,        // puntuación robusta post-pipeline
    ].filter(Boolean).length }
  }
  if (signal === 'reducir') {
    return { total, met: [
      rsi > 55,
      netFlow < 0,
      mom < -0.5,
      consistency < 0,
      r1m < 0,
      r1y < 4.5,
      confidence > 50,
      score > 55,
    ].filter(Boolean).length }
  }
  return { met: 0, total }
}

// ─── EV neto mensual estimado ──────────────────────────────────────────────────
// EV = p × E[ganancia_mensual] - (1-p) × E[pérdida_mensual]
// p = confidence/100; ganancia proxy = r1y/12; pérdida proxy = vol/√12
// Positivo = edge existe; negativo = EV desfavorable (WATCH, no ENTRY)
function calcEV(confidence: number, r1y: number, vol: number): number {
  const p           = confidence / 100
  const monthlyWin  = Math.max(0, r1y / 12)
  const monthlyLoss = vol / Math.sqrt(12)
  return Math.round((p * monthlyWin - (1 - p) * monthlyLoss) * 10) / 10
}

// ─── Ajuste de score según régimen de mercado ─────────────────────────────────
// risk-on favorece equity/crypto; risk-off favorece renta fija.
const REGIME_ADJ: Record<MarketRegime, Record<AssetClass, number>> = {
  'risk-on':  { etfs:  5, fondos:  3, crypto:   4, renta_fija:  -8 },
  'risk-off': { etfs: -8, fondos: -5, crypto: -15, renta_fija:  10 },
  'neutral':  { etfs:  0, fondos:  0, crypto:   0, renta_fija:   0 },
}

// ─── Interface de entrada ─────────────────────────────────────────────────────
export interface RawAsset {
  id:            string
  name:          string
  ticker?:       string
  assetClass:    AssetClass
  category?:     string
  r1m:           number
  r3m:           number
  r1y:           number
  closes28?:      number[]   // últimos 28 cierres diarios para RSI real de Wilder
  dividendYield?: number    // yield anual en % (ej. 1.8 = 1.8%), de Yahoo Finance
  priceAtSignal?: number    // precio spot actual (para fondos/crypto donde no hay closes28)
}

// ─── Procesar un activo raw → Asset completo ─────────────────────────────────
// kellyPct / volScalar / edgeVerified / status se calculan después en
// applyProfileSizing() (allocator.ts) porque dependen del perfil del inversor.
export function processAsset(raw: RawAsset, regime: MarketRegime = 'neutral'): Asset {
  const rsiReal    = raw.closes28 && raw.closes28.length >= 15 ? realRSI(raw.closes28) : -1
  const rsi        = rsiReal >= 0 ? rsiReal : simRSI(raw.r1m)
  const netFlow    = simNetFlow(raw.r1m, raw.r3m)
  const mom        = simMomentum(raw.r1m, raw.r3m, raw.r1y)
  const volReal    = raw.closes28 && raw.closes28.length >= 10 ? realVolatility(raw.closes28) : -1
  const vol        = volReal >= 0 ? volReal : simVolatility(raw.r1m, raw.r3m, raw.r1y, raw.assetClass)
  const consist    = timeframeConsistency(raw.r1m, raw.r3m, raw.r1y)
  const signal     = getSignal(rsi, netFlow, raw.r1m, mom, consist)
  const base       = calcScore(rsi, netFlow, mom, raw.r1m, raw.r1y, vol, consist)
  const score      = Math.round(Math.min(100, Math.max(0, base + REGIME_ADJ[regime][raw.assetClass])))
  const confidence = calcConfidence(rsi, netFlow, mom, consist, signal)
  const { met, total } = calcConditions(rsi, netFlow, mom, consist, raw.r1m, raw.r1y, confidence, score, signal)
  const evNeto     = calcEV(confidence, raw.r1y, vol)

  return {
    id: raw.id, name: raw.name, ticker: raw.ticker,
    assetClass: raw.assetClass, category: raw.category,
    return30d: raw.r1m, return90d: raw.r3m, return1y: raw.r1y,
    netFlow, rsi, momentum: mom, volatility: vol, signal, score,
    confidence, conditionsMet: met, conditionsTotal: total, evNeto,
    dividendYield:  raw.dividendYield,
    // Precio al momento de la señal: último cierre real o valor pasado explícitamente
    priceAtSignal:  raw.priceAtSignal ?? raw.closes28?.[raw.closes28.length - 1],
    // applyProfileSizing() los sobreescribe con valores reales
    kellyPct: 0, volScalar: 100, edgeVerified: false, status: 'no-setup' as TradeStatus,
  }
}

// ─── Ranking cross-seccional dentro de cada clase de activo ──────────────────
export function applyCrossSection(assets: Asset[]): Asset[] {
  const classes: AssetClass[] = ['fondos', 'etfs', 'renta_fija', 'crypto']
  const byClass = new Map<AssetClass, Asset[]>()
  classes.forEach(cls => byClass.set(cls, assets.filter(a => a.assetClass === cls)))

  return assets.map(asset => {
    const group = byClass.get(asset.assetClass) ?? []
    if (group.length <= 1) return asset
    const sorted = [...group].sort((a, b) => b.score - a.score)
    const idx    = sorted.findIndex(a => a.id === asset.id)
    const pct    = idx / (sorted.length - 1)
    const rank   = Math.round((1 - pct) * 100)
    return { ...asset, score: Math.round(asset.score * 0.5 + rank * 0.5) }
  })
}

// ─── Penalización por correlación: max 2 BUYs por categoría similar ───────────
// Evita recomendar SPY + IVV + VOO juntos, o 5 ETFs de tecnología al mismo tiempo.
// Los excedentes bajan su score en 18 pts; si caen bajo 52 pasan a 'mantener'.
function normalizeCategory(cat: string): string {
  const c = (cat ?? '').toLowerCase()
  if (c.includes('tecnolog') || c.includes('tech') || c.includes('nasdaq') || c.includes('semiconductor')) return 'tech'
  if (c.includes('s&p') || c.includes('mercado total') || c.includes('usa market') || c.includes('renta variable usa')) return 'usa-broad'
  if (c.includes('small cap') || c.includes('russell')) return 'small-cap'
  if (c.includes('emerg')) return 'emerging'
  if (c.includes('europa') || c.includes('europe') || c.includes('alemania') || c.includes('germany')) return 'europe'
  if (c.includes('asia') || c.includes('japan') || c.includes('china') || c.includes('corea') || c.includes('taiwan')) return 'asia'
  if (c.includes('latam') || c.includes('latinoam') || c.includes('brasil')) return 'latam'
  if (c.includes('bond') || c.includes('renta fija') || c.includes('tbond') || c.includes('btp')) return 'bonds'
  if (c.includes('oro') || c.includes('gold') || c.includes('plata') || c.includes('silver')) return 'metals'
  if (c.includes('commodity') || c.includes('commodit')) return 'commodities'
  if (c.includes('real estate') || c.includes('reit')) return 'realestate'
  if (c.includes('energ')) return 'energy'
  if (c.includes('salud') || c.includes('health')) return 'health'
  if (c.includes('financ')) return 'financials'
  if (c.includes('factor') || c.includes('momentum') || c.includes('valor') || c.includes('calidad') || c.includes('crecim')) return 'factor'
  if (c.includes('innov') || c.includes('ark') || c.includes('robotic') || c.includes('cloud') || c.includes('cyber') || c.includes('ev') || c.includes('electr')) return 'thematic'
  if (c.includes('bitcoin') || c.includes('btc') || c.includes('eth') || c.includes('sol')) return 'crypto-major'
  return c.substring(0, 20)
}

export function applyCorrelationPenalty(assets: Asset[]): Asset[] {
  const groupKey = (a: Asset) => `${a.assetClass}::${normalizeCategory(a.category ?? '')}`
  const byGroup  = new Map<string, Asset[]>()
  assets.forEach(a => {
    const k = groupKey(a)
    if (!byGroup.has(k)) byGroup.set(k, [])
    byGroup.get(k)!.push(a)
  })

  const penalized = new Set<string>()
  byGroup.forEach(group => {
    const buyers = group
      .filter(a => a.signal === 'comprar')
      .sort((a, b) => b.score - a.score)
    // los primeros 2 por categoría normalizda se quedan full score
    buyers.slice(2).forEach(a => penalized.add(a.id))
  })

  return assets.map(a => {
    if (!penalized.has(a.id)) return a
    const newScore: number  = Math.max(0, a.score - 18)
    const newSignal: SignalType = newScore < 52 ? 'mantener' : a.signal
    return { ...a, score: newScore, signal: newSignal }
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
    return { market: FLOW_LABELS[cls], inflow, outflow, net, trend, color: FLOW_COLORS[cls] }
  })
}

// ─── Score global de flujo ponderado por convicción ───────────────────────────
export function computeFlowScore(assets: Asset[]): number {
  if (!assets.length) return 50
  const totalScore = assets.reduce((s, a) => s + a.score, 0) || 1
  const bullScore  = assets.filter(a => a.signal === 'comprar').reduce((s, a) => s + a.score, 0)
  const holdScore  = assets.filter(a => a.signal === 'mantener').reduce((s, a) => s + a.score, 0)
  return Math.round(((bullScore * 2 + holdScore) / (totalScore * 2)) * 100)
}
