// El motor opera sobre activos que no todos tienen equivalente en Binance
// Futures (ej. WTI petróleo, XAU oro vía CFD). Solo se puede copytradear lo
// que de verdad existe como par USDT-perpetuo en Binance.
const SYM_TO_BINANCE: Record<string, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  BNB: 'BNBUSDT',
  LTC: 'LTCUSDT',
}

export function toBinanceSymbol(motorSym: string): string | null {
  return SYM_TO_BINANCE[motorSym.toUpperCase()] ?? null
}

export function directionToSide(direction: string): 'BUY' | 'SELL' {
  return direction.toLowerCase() === 'short' ? 'SELL' : 'BUY'
}

// Tamaño en USD a copytradear para un usuario: el motor ya expresa kelly_pct
// como % de su propio equity a asignar a esa posición — se aplica la misma
// fracción sobre el capital que el usuario destinó a copytrading.
export function computeSizeUsd(kellyPct: number, userCapitalUsd: number): number {
  return Math.max(0, (kellyPct / 100) * userCapitalUsd)
}
