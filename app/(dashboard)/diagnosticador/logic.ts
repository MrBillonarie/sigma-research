// Pure math functions for the Diagnosticador — all testable in isolation

export interface RiskParams {
  patrimonio:    number  // trading capital in USD
  rr:            number  // reward/risk ratio
  riskPerOp:     number  // % risk per operation (e.g. 2 for 2%)
  riskPortfolio: number  // % portfolio risk (e.g. 2 for 2%)
}

export interface ScenarioParams {
  opsPerDay:  number
  daysPerMonth: number
  riskPerOp:  number  // % (e.g. 2)
}

export interface RiskCalcs {
  patrimonioMinRec: number   // patrimonio / 0.20
  patrimonioMaxRec: number   // patrimonio / 0.10
  retornoPorOp:     number   // $ return targeted per op
  riesgoPerOp:      number   // $ risked per op
  maxSimultaneous:  number   // max open ops
  riesgoCartera:    number   // $ portfolio risk
  minWinRate:       number   // % minimum win rate to be profitable
}

export function calcRisk(p: RiskParams): RiskCalcs {
  const riskFrac   = p.riskPerOp     / 100
  const portFrac   = p.riskPortfolio / 100
  return {
    patrimonioMinRec: p.rr > 0 ? p.patrimonio / 0.20 : 0,
    patrimonioMaxRec: p.rr > 0 ? p.patrimonio / 0.10 : 0,
    retornoPorOp:     p.patrimonio * p.rr * riskFrac,
    riesgoPerOp:      p.patrimonio * riskFrac,
    maxSimultaneous:  riskFrac > 0 ? Math.floor(portFrac / riskFrac) : 0,
    riesgoCartera:    p.patrimonio * portFrac,
    minWinRate:       p.rr > 0 ? (1 / (1 + p.rr)) * 100 : 0,
  }
}

// Returns monthly return as a PERCENTAGE (e.g. 40 means 40%)
export function scenarioReturn(
  winRate:   number,  // 0–1 decimal
  rr:        number,
  totalOps:  number,
  riskPct:   number,  // e.g. 2
): number {
  return (winRate * rr - (1 - winRate)) * totalOps * (riskPct / 100) * 100
}

export const WIN_RATES = Array.from({ length: 20 }, (_, i) => (i + 1) * 5)   // 5…100
export const RR_VALUES  = Array.from({ length: 16 }, (_, i) => (i + 1) * 0.5) // 0.5…8

export function cellColor(value: number): string {
  if (value < -20) return '#3b0a0a'
  if (value <   0) return '#7f1d1d'
  if (value <  10) return '#713f12'
  if (value <  30) return '#14532d'
  if (value <  60) return '#166534'
  return '#052e16'
}

export function cellTextColor(value: number): string {
  if (value < -20) return '#fca5a5'
  if (value <   0) return '#fca5a5'
  if (value <  10) return '#fde68a'
  if (value <  30) return '#86efac'
  if (value <  60) return '#4ade80'
  return '#bbf7d0'
}

export function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
