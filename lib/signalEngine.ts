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
// Con closes60 tenemos 27 retornos → estimación razonable
export function realVolatility(closes: number[]): number {
  if (closes.length < 10) return -1
  const rets = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i])
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1)
  return Math.round(Math.sqrt(variance * 252) * 100 * 100) / 100
}

// ─── EMA helper ───────────────────────────────────────────────────────────────
function ema(src: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out = [src[0]]
  for (let i = 1; i < src.length; i++) out.push(src[i] * k + out[i - 1] * (1 - k))
  return out
}

// ─── MACD(12,26,9) ────────────────────────────────────────────────────────────
// Requiere ≥35 cierres. Con 60 tenemos señal bien convergida.
// crossover/crossunder = histograma cambia de signo → señal de entrada/salida.
interface MACDResult { bullish: boolean; crossover: boolean; crossunder: boolean; hist: number }
function calcMACD(closes: number[]): MACDResult | null {
  if (closes.length < 35) return null
  const e12    = ema(closes, 12)
  const e26    = ema(closes, 26)
  const macdLine   = closes.map((_, i) => e12[i] - e26[i])
  const signalLine = ema(macdLine, 9)
  const hist   = macdLine.map((v, i) => v - signalLine[i])
  const n = hist.length - 1
  return {
    bullish:   hist[n] > 0,
    crossover:  hist[n] > 0 && hist[n - 1] <= 0,
    crossunder: hist[n] < 0 && hist[n - 1] >= 0,
    hist:      hist[n],
  }
}

// ─── EMA 20/50 — tendencia de fondo ──────────────────────────────────────────
interface EMATrendResult { ema20AboveEma50: boolean; priceAboveEma20: boolean; bullish: boolean }
function calcEMATrend(closes: number[]): EMATrendResult | null {
  if (closes.length < 50) return null
  const e20 = ema(closes, 20)
  const e50 = ema(closes, 50)
  const n   = closes.length - 1
  return {
    ema20AboveEma50: e20[n] > e50[n],
    priceAboveEma20: closes[n] > e20[n],
    bullish:         closes[n] > e20[n] && e20[n] > e50[n],
  }
}

// ─── Bollinger Bands(20,2) ────────────────────────────────────────────────────
// position 0-100: 0 = en banda inferior, 100 = en banda superior.
// width: % de expansión de las bandas (alto = alta volatilidad).
interface BBResult { position: number; width: number }
function calcBB(closes: number[], period = 20): BBResult | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const mean  = slice.reduce((a, b) => a + b, 0) / period
  const std   = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period)
  if (std === 0) return null
  const upper = mean + 2 * std
  const lower = mean - 2 * std
  const price = closes[closes.length - 1]
  return {
    position: Math.round(Math.min(100, Math.max(0, ((price - lower) / (upper - lower)) * 100))),
    width:    Math.round((upper - lower) / mean * 1000) / 10,
  }
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

// ─── Pesos de scoring dinámicos por régimen ───────────────────────────────────
// risk-on  → más peso en momentum y MACD (tendencia).
// risk-off → más peso en RSI/Sharpe (calidad y protección).
// neutral  → pesos equilibrados.
const SCORE_WEIGHTS: Record<MarketRegime, {
  mom: number; rsi: number; macd: number; flow: number; ret: number; sharpe: number
}> = {
  'risk-on':  { mom: 0.25, rsi: 0.12, macd: 0.22, flow: 0.15, ret: 0.12, sharpe: 0.14 },
  'risk-off': { mom: 0.12, rsi: 0.22, macd: 0.15, flow: 0.18, ret: 0.12, sharpe: 0.21 },
  'neutral':  { mom: 0.20, rsi: 0.17, macd: 0.18, flow: 0.16, ret: 0.14, sharpe: 0.15 },
}

// ─── Señal con confirmación multi-plazo + MACD + EMA ─────────────────────────
function getSignal(
  rsi: number, netFlow: number, r1m: number, mom: number, consistency: number,
  macd: MACDResult | null, emaTrend: EMATrendResult | null,
): SignalType {
  const macdBull = macd?.bullish ?? true   // si no hay datos MACD → no penalizar

  // Compra fuerte: sobreventa + flujo + plazos alineados + MACD confirma
  if (rsi < 35 && netFlow > 0 && consistency > 0 && macdBull)      return 'comprar'
  // Cruce alcista MACD con tendencia EMA de fondo
  if (macd?.crossover && (emaTrend?.ema20AboveEma50 ?? false) && netFlow > 0) return 'comprar'
  // Sobrecompra + flujo negativo + MACD bearish
  if (rsi > 70 && netFlow < 0 && consistency < 0 && !macdBull)     return 'reducir'
  // Cruce bajista MACD = inicio de tendencia bajista
  if (macd?.crossunder && consistency < 0 && netFlow < 0)          return 'reducir'
  // Continuación momentum alcista
  if (r1m > 4 && mom > 1 && consistency >= 0 && macdBull)          return 'comprar'
  // Continuación momentum bajista
  if (r1m < -4 && mom < -1 && consistency <= 0)                    return 'reducir'
  // RSI extremo con flujo
  if (rsi < 40 && netFlow > 15 && macdBull)                        return 'comprar'
  if (rsi > 75 && netFlow < -15)                                   return 'reducir'
  if (Math.abs(r1m) < 1 && Math.abs(mom) < 0.3)                   return 'neutral'
  return 'mantener'
}

// ─── Score 0-100 con MACD + pesos dinámicos por régimen ──────────────────────
function calcScore(
  rsi: number, netFlow: number, mom: number,
  r1m: number, r1y: number, vol: number, consistency: number,
  macd: MACDResult | null,
  emaTrend: EMATrendResult | null,
  regime: MarketRegime,
): number {
  const w = SCORE_WEIGHTS[regime]

  const momScore    = Math.min(100, Math.max(0, mom * 6 + 50))
  const rsiScore    = rsi < 30 ? 85 : rsi < 50 ? 70 : rsi < 65 ? 65 : rsi < 75 ? 45 : 20
  const flowScore   = Math.min(100, Math.max(0, netFlow + 50))
  const retScore    = Math.min(100, Math.max(0, (r1y / 12 + 1.5) * 12))
  const sharpeProxy = vol > 0 ? Math.min(100, Math.max(0, ((r1y - 4.5) / vol) * 30 + 50)) : 50
  // MACD score: crossover alcista = máxima convicción; crossunder = mínima
  const macdScore   = macd
    ? (macd.crossover ? 85 : macd.bullish ? 65 : macd.crossunder ? 18 : 35)
    : 50

  const raw = momScore * w.mom + rsiScore * w.rsi + macdScore * w.macd +
              flowScore * w.flow + retScore * w.ret + sharpeProxy * w.sharpe

  // Bonus por alineación EMA (tendencia de fondo confirmada)
  const emaBonus = emaTrend
    ? (emaTrend.bullish ? 8 : emaTrend.ema20AboveEma50 ? 3 : emaTrend.priceAboveEma20 ? 1 : -4)
    : 0

  return Math.round(Math.min(100, Math.max(0, raw + consistency * 10 + emaBonus)))
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
// 8 condiciones técnicas: RSI, flujo, momentum, consistencia, retornos, MACD, EMA.
function calcConditions(
  rsi: number, netFlow: number, mom: number, consistency: number,
  r1m: number, r1y: number, macd: MACDResult | null, emaTrend: EMATrendResult | null,
  signal: SignalType,
): { met: number; total: number } {
  const total = 8
  if (signal === 'comprar') {
    return { total, met: [
      rsi < 55,                                    // no sobrecomprado
      netFlow > 0,                                 // flujo de capital positivo
      mom > 0.5,                                   // momentum significativo
      consistency > 0,                             // todos los plazos alineados
      r1m > 0,                                     // retorno reciente positivo
      r1y > 4.5,                                   // supera tasa libre de riesgo
      macd?.bullish ?? false,                      // MACD en zona alcista
      emaTrend?.ema20AboveEma50 ?? false,          // EMA20 > EMA50 (tendencia de fondo)
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
      !(macd?.bullish ?? true),
      !(emaTrend?.ema20AboveEma50 ?? true),
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
  closes60?:      number[]   // últimos 28 cierres diarios para RSI real de Wilder
  dividendYield?: number    // yield anual en % (ej. 1.8 = 1.8%), de Yahoo Finance
  priceAtSignal?: number    // precio spot actual (para fondos/crypto donde no hay closes60)
}

// ─── Procesar un activo raw → Asset completo ─────────────────────────────────
// kellyPct / volScalar / edgeVerified / status se calculan después en
// applyProfileSizing() (allocator.ts) porque dependen del perfil del inversor.
export function processAsset(raw: RawAsset, regime: MarketRegime = 'neutral'): Asset {
  const closes     = raw.closes60 ?? []
  const rsiReal    = closes.length >= 15 ? realRSI(closes) : -1
  const rsi        = rsiReal >= 0 ? rsiReal : simRSI(raw.r1m)
  const netFlow    = simNetFlow(raw.r1m, raw.r3m)
  const mom        = simMomentum(raw.r1m, raw.r3m, raw.r1y)
  const volReal    = closes.length >= 10 ? realVolatility(closes) : -1
  const vol        = volReal >= 0 ? volReal : simVolatility(raw.r1m, raw.r3m, raw.r1y, raw.assetClass)
  const consist    = timeframeConsistency(raw.r1m, raw.r3m, raw.r1y)

  // Indicadores técnicos avanzados (requieren ≥35 / ≥50 cierres)
  const macd       = calcMACD(closes)
  const emaTrend   = calcEMATrend(closes)
  const bb         = calcBB(closes)

  const signal     = getSignal(rsi, netFlow, raw.r1m, mom, consist, macd, emaTrend)
  // Score con pesos dinámicos por régimen (MACD incluido, sin REGIME_ADJ separado)
  const score      = calcScore(rsi, netFlow, mom, raw.r1m, raw.r1y, vol, consist, macd, emaTrend, regime)
  const confidence = calcConfidence(rsi, netFlow, mom, consist, signal)
  const { met, total } = calcConditions(rsi, netFlow, mom, consist, raw.r1m, raw.r1y, macd, emaTrend, signal)
  const evNeto     = calcEV(confidence, raw.r1y, vol)

  return {
    id: raw.id, name: raw.name, ticker: raw.ticker,
    assetClass: raw.assetClass, category: raw.category,
    return30d: raw.r1m, return90d: raw.r3m, return1y: raw.r1y,
    netFlow, rsi, momentum: mom, volatility: vol, signal, score,
    confidence, conditionsMet: met, conditionsTotal: total, evNeto,
    macdBullish:    macd?.bullish,
    emaBullish:     emaTrend?.bullish,
    bbPosition:     bb?.position,
    dividendYield:  raw.dividendYield,
    priceAtSignal:  raw.priceAtSignal ?? closes[closes.length - 1],
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
