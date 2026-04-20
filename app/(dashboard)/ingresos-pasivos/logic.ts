export function calcMonthlyIncome(capital: number, apyPct: number): number {
  return (capital * apyPct) / 100 / 12
}

export function calcCompoundGrowth(capital: number, apyPct: number, months: number): number {
  return capital * Math.pow(1 + apyPct / 100 / 12, months)
}

export function calcWeightedAPY(positions: { capital: number; apy: number }[]): number {
  const total = positions.reduce((s, p) => s + p.capital, 0)
  if (total === 0) return 0
  return positions.reduce((s, p) => s + (p.capital / total) * p.apy, 0)
}

export function calcIL(priceRatio: number): number {
  // Impermanent loss for a 50/50 pool given price ratio k = p1/p0
  return (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1
}

export function calcBreakEvenDays(capital: number, apyPct: number, ilPct: number): number {
  if (apyPct <= 0) return Infinity
  const dailyRate = apyPct / 100 / 365
  return Math.abs(ilPct / 100) / dailyRate
}
