export type AssetClass  = 'fondos' | 'etfs' | 'renta_fija' | 'crypto'
export type SignalType  = 'comprar' | 'mantener' | 'reducir' | 'neutral'
export type ProfileType = 'retail' | 'trader' | 'institucional'

export interface Asset {
  id:         string
  name:       string
  ticker?:    string
  assetClass: AssetClass
  category?:  string
  return30d:  number
  return90d:  number
  return1y:   number
  netFlow:    number
  rsi:        number
  momentum:   number
  volatility: number
  signal:     SignalType
  score:      number
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
  expectedReturn:   number
  annualVolatility: number
  sharpeRatio:      number
  maxDrawdown:      number
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
  ok:          boolean
  profile:     Profile
  signals:     Asset[]
  allocation:  Allocation
  metrics:     PortfolioMetrics
  flowSignals: FlowSignal[]
  flowScore:   number
  totalAssets: number
  buyCount:    number
  sellCount:   number
  holdCount:   number
  generatedAt: string
}
