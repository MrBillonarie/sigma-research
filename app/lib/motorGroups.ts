// Agrupación de activos por motor para la matriz nativa del HUD. Coincide con
// los symbols reales que trae /api/vps/champions ahora mismo (16 activos:
// 5 M1 + 6 M2 + 5 M3) y con la arquitectura descrita en el proyecto (M1: 5
// cripto, M2: XAU/XAG/WTI/NG/HG/PL, M3: 5 S&P500).
export interface MotorGroup {
  id: 'M1' | 'M2' | 'M3'
  label: string
  assets: string[]
}

export const MOTOR_GROUPS: MotorGroup[] = [
  { id: 'M1', label: 'Motor 1 — Cripto',      assets: ['BTC', 'ETH', 'SOL', 'BNB', 'LTC'] },
  { id: 'M2', label: 'Motor 2 — Commodities',  assets: ['XAU', 'XAG', 'WTI', 'NG', 'HG', 'PL'] },
  { id: 'M3', label: 'Motor 3 — S&P 500',      assets: ['AAPL', 'NVDA', 'TSLA', 'JPM', 'XOM'] },
]
