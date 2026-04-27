export type AssetClass   = 'fondos' | 'etfs' | 'renta_fija' | 'crypto'
export type SignalType   = 'comprar' | 'mantener' | 'reducir' | 'neutral'
export type ProfileType  = 'retail' | 'trader' | 'institucional'
export type MarketRegime = 'risk-on' | 'risk-off' | 'neutral'
export type TradeStatus  = 'entry' | 'watch' | 'no-setup'

export interface Asset {
  id:            string
  name:          string
  ticker?:       string
  assetClass:    AssetClass
  category?:     string
  return30d:     number
  return90d:     number
  return1y:      number
  netFlow:       number
  rsi:           number
  momentum:      number
  volatility:    number
  signal:        SignalType
  score:         number
  confidence:      number        // 0-100: acuerdo entre sub-señales (RSI, flow, mom, consistency)
  conditionsMet:   number        // condiciones cumplidas (ej. 6)
  conditionsTotal: number        // total de condiciones evaluadas (8)
  evNeto:          number        // EV mensual esperado en % (positivo = edge existe)
  kellyPct:        number        // fracción Kelly recomendada 0-20%
  volScalar:       number        // scalar vol-target 0-100 (shrinkage por vol elevada)
  edgeVerified:    boolean       // Sharpe proxy >= umbral del perfil
  status:          TradeStatus   // 'entry' | 'watch' | 'no-setup'
  dividendYield?:  number        // yield anual en % (1.8 = 1.8%), null si no distribuye
  priceAtSignal?:  number        // precio spot al emitir la señal (para medir accuracy futura)
  signalChanged?:  boolean       // true si la señal cambió respecto a la última guardada
  prevSignal?:     SignalType    // señal anterior (cuando cambió)
}

export interface Profile {
  type:             ProfileType
  label:            string
  maxCrypto:        number
  maxEquity:        number
  minFixedIncome:   number
  riskTolerance:    number
  benchmarkReturn:  number
  description:      string
  horizonte:        string
}

export interface Allocation {
  fondos:     number
  etfs:       number
  renta_fija: number
  crypto:     number
}

export interface PortfolioMetrics {
  expectedReturn:   number   // retorno anual forward-looking (yield-based para bonos/equity)
  annualVolatility: number   // vol ajustada por correlaciones entre clases
  sharpeRatio:      number   // (expectedReturn - 4.5%) / vol
  maxDrawdown:      number   // estimado según peso equity/crypto
  portfolioYield:   number   // yield promedio ponderado del portafolio (dividendos)
}

export interface FlowSignal {
  market:  string
  inflow:  number
  outflow: number
  net:     number
  trend:   'entrando' | 'saliendo' | 'neutro'
  color:   string
}

export interface TopMove {
  asset:      string
  assetClass: AssetClass
  action:     SignalType
  reason:     string
  score:      number
  return1y:   number
}

export interface Report {
  generatedAt:    string
  profile:        Profile
  topMoves:       TopMove[]
  sigmaIASignal:  string
  flowScore:      number
  summary:        string
  allocation:     Allocation
  metrics:        PortfolioMetrics
  flowSignals:    FlowSignal[]
}

export interface SignalsResponse {
  ok:           boolean
  profile:      Profile
  signals:      Asset[]
  allocation:   Allocation
  metrics:      PortfolioMetrics
  flowSignals:  FlowSignal[]
  flowScore:    number
  totalAssets:  number
  buyCount:     number
  sellCount:    number
  holdCount:    number
  generatedAt:  string
  regime:       MarketRegime
  regimeLabel:  string
}
