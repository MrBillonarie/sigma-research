export interface Position {
  sym: string
  tf: string
  direction: 'long' | 'short'
  entry: number
  sl: number
  tp: number
  tp2?: number
  sl_dist_pct_at_open?: number
  strategy: string
  grade?: string
  wr?: number
  cagr?: number
  kelly_pct?: number
  mode?: 'LIVE' | 'PAPER'
  opened_at: string
  status: string
  live_contracts?: number
  pnl_pct?: number
  binance_order_id?: string
  contracts?: number
  notional?: number
}

export interface TradeStats {
  total: number
  wins: number
  losses: number
  win_rate: number
  total_pnl: number
  avg_win: number
  avg_loss: number
  best: number
  worst: number
  profit_factor: number
}

export interface Portfolio {
  initial: number
  equity: number
  float_equity: number
  return_pct: number
  cagr_live: number
  max_dd: number
  calmar: number
  sharpe: number
  days_active: number
  commission_paid: number
  funding_received: number
  peak: number
  risk_of_ruin: number
  kelly_avg: number
}

export interface TradesResponse {
  open: Position[]
  cooldowns: unknown[]
  history: unknown[]
  stats: TradeStats
  portfolio: Portfolio
}

export interface SignalModel {
  sym: string
  tf: string
  strategy: string
  type: string
  grade: string
  score: number
  cagr: number
  wr: number
  dd: number
  trades: number
  recommendation: string
  reason: string
  signal: boolean
  price: number
  sl: number
  tp: number
  regime_ok: boolean
}

export interface SignalsResponse {
  regime: string
  signals: SignalModel[]
}

// Nota: /api/vps/champions normaliza /api/v2/champions del motor, pero cae a
// /api/public.top_models (forma distinta: 'type' en vez de 'direction', sin
// slot/wft/mc) si el primario falla -- todos los campos opcionales a proposito.
export interface Champion {
  slot?: string
  sym?: string
  tf?: string
  strategy?: string
  direction?: 'long' | 'short'
  type?: 'long' | 'short'
  grade?: string
  cagr?: number
  wr?: number
  dd?: number
  trades?: number
  wft_verdict?: string
  val_wft?: number
  wft_windows?: number
  val_mc?: number
  mc_confidence?: number
  mc_cagr_p05?: number
  mc_dd_p95?: number
  val_confidence?: string
  eff_risk_pct?: number
  n_live_trades?: number
  live_wr?: number
  robustness_gates?: string[]
  saved_at?: string
}

export interface ModelStats {
  cagr?: number
  wr?: number
  trades?: number
  strategy?: string
  score?: number
}

export interface CombinedEstimate {
  source?: 'adaptive' | 'estimate'
  cagr?: number
  wr?: number
  trades?: number
}

// Generado por dashboard.py build_matrix_data() cada 5 min (via regen_dashboard()),
// servido por /api/matrix_data (web_server.py) -> /api/vps/matrix-data (Next.js).
export interface MatrixCellData {
  motor?: 'M1' | 'M2' | 'M3'
  sym?: string
  tf?: string
  long?: ModelStats | null
  short?: ModelStats | null
  combined?: CombinedEstimate | null
}
