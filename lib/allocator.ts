import type { Asset, AssetClass, Allocation, PortfolioMetrics, Profile, TradeStatus } from '@/types/decision-engine'

const RF_RATE = 4.5

const BASE_VOL: Record<AssetClass, number> = {
  fondos: 8, etfs: 14, renta_fija: 3, crypto: 65,
}

// ─── Matriz de correlación entre clases (empírica, largo plazo) ───────────────
// equity↔bond negativa en crisis; crypto tiene correlación baja con bonos.
const RHO: Record<AssetClass, Record<AssetClass, number>> = {
  fondos:     { fondos: 1.00, etfs:  0.75, renta_fija: -0.10, crypto: 0.20 },
  etfs:       { fondos: 0.75, etfs:  1.00, renta_fija: -0.15, crypto: 0.25 },
  renta_fija: { fondos:-0.10, etfs: -0.15, renta_fija:  1.00, crypto: 0.05 },
  crypto:     { fondos: 0.20, etfs:  0.25, renta_fija:  0.05, crypto: 1.00 },
}

// ─── Retorno forward-looking por clase (más preciso que solo return1y) ────────
// Bonos:   yield actual ≈ retorno esperado (Gordon para bonos)
// Equity:  yield + prima de crecimiento histórica (~5.5%)
// Crypto:  media-reversión hacia 15% (muy especulativo)
// Fondos:  media-reversión hacia 7% histórico cuando no hay yield disponible
function forwardReturn(cls: AssetClass, histReturn: number, yield_: number): number {
  switch (cls) {
    case 'renta_fija':
      return yield_ > 0
        ? yield_
        : Math.max(3.0, Math.min(8.0, histReturn * 0.6 + RF_RATE * 0.4))
    case 'etfs':
    case 'fondos':
      if (yield_ > 0) return Math.min(18, yield_ + 5.5)
      return Math.min(15, Math.max(4, histReturn * 0.4 + 7))
    case 'crypto':
      return Math.min(50, Math.max(-20, histReturn * 0.5))
  }
}

// ─── Vol-target por perfil (anualizado %) ─────────────────────────────────────
// Equivale al [M3] VOL TGT del HUD: scalar = min(1, targetVol / realVol)
const VOL_TARGETS: Record<string, number> = {
  retail: 10, institucional: 15, trader: 25,
}

// ─── Umbral de Sharpe para verificación de edge por perfil ───────────────────
// El HUD rechaza la operación si SR < thr. Aquí desactiva Kelly si no se cumple.
const SHARPE_THRESHOLDS: Record<string, number> = {
  retail: 0.5, institucional: 0.4, trader: 0.3,
}

// ─── Sizing ajustado por perfil: Kelly + vol scalar + edge gate ───────────────
// Enriquece cada activo con kellyPct, volScalar, edgeVerified y status.
// Se llama tras el pipeline completo (cross-section + correlación + cambios).
export function applyProfileSizing(asset: Asset, profile: Profile): Asset {
  const targetVol    = VOL_TARGETS[profile.type] ?? 15
  const shrThreshold = SHARPE_THRESHOLDS[profile.type] ?? 0.4

  // Vol scalar: encoge la posición cuando la vol real supera el objetivo
  const volScalar = Math.min(100, Math.round((targetVol / Math.max(asset.volatility, 1)) * 100))

  // Edge: Sharpe proxy del activo individual debe superar el umbral del perfil
  const sharpeProxy  = asset.volatility > 0 ? (asset.return1y - RF_RATE) / asset.volatility : 0
  const edgeVerified = sharpeProxy >= shrThreshold

  // Kelly fracción: f* = p - (1-p)/b; b = payoff ratio (ganancia/pérdida esperada)
  // p = conditionsMet/conditionsTotal como estimado de win-rate
  const p        = asset.conditionsMet / Math.max(asset.conditionsTotal, 1)
  const b        = Math.max(0.5, asset.return1y) / Math.max(asset.volatility / 2, 5)
  const kellyRaw = edgeVerified && asset.evNeto > 0 ? Math.max(0, p - (1 - p) / b) : 0
  const kellyPct = Math.min(20, Math.round(kellyRaw * 100))

  // Status: replica la lógica ENTRY / WATCH / NO SETUP del HUD
  let status: TradeStatus
  if (asset.signal === 'mantener' || asset.signal === 'neutral') {
    status = 'no-setup'
  } else if (edgeVerified && asset.evNeto > 0 && asset.conditionsMet >= Math.ceil(asset.conditionsTotal * 0.6)) {
    status = 'entry'
  } else {
    status = 'watch'
  }

  return { ...asset, volScalar, edgeVerified, kellyPct, status }
}

// ─── Asignación óptima dentro de restricciones del perfil ────────────────────
export function computeAllocation(assets: Asset[], profile: Profile): Allocation {
  const classes: AssetClass[] = ['fondos', 'etfs', 'renta_fija', 'crypto']

  // Score promedio por clase
  const classScores = {} as Record<AssetClass, number>
  classes.forEach(cls => {
    const group = assets.filter(a => a.assetClass === cls)
    classScores[cls] = group.length
      ? group.reduce((s, a) => s + a.score, 0) / group.length
      : 30
  })

  const totalScore = Object.values(classScores).reduce((a, b) => a + b, 0) || 1

  // Pesos crudos proporcionales al score
  const raw = {} as Record<AssetClass, number>
  classes.forEach(cls => { raw[cls] = (classScores[cls] / totalScore) * 100 })

  // Aplicar restricciones del perfil
  raw.crypto     = Math.min(raw.crypto, profile.maxCrypto)
  raw.renta_fija = Math.max(raw.renta_fija, profile.minFixedIncome)
  const equity   = raw.fondos + raw.etfs
  if (equity > profile.maxEquity) {
    const f = profile.maxEquity / equity
    raw.fondos *= f
    raw.etfs   *= f
  }

  // Normalizar a 100%
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1
  const alloc: Allocation = {
    fondos:     Math.round(raw.fondos     / total * 100),
    etfs:       Math.round(raw.etfs       / total * 100),
    renta_fija: Math.round(raw.renta_fija / total * 100),
    crypto:     Math.round(raw.crypto     / total * 100),
  }

  // Ajuste de redondeo
  const sum = Object.values(alloc).reduce((a, b) => a + b, 0)
  if (sum !== 100) alloc.fondos += (100 - sum)

  return alloc
}

// ─── Métricas del portafolio ──────────────────────────────────────────────────
export function computeMetrics(allocation: Allocation, assets: Asset[]): PortfolioMetrics {
  const classes: AssetClass[] = ['fondos', 'etfs', 'renta_fija', 'crypto']
  const w: Record<AssetClass, number> = {
    fondos:     allocation.fondos     / 100,
    etfs:       allocation.etfs       / 100,
    renta_fija: allocation.renta_fija / 100,
    crypto:     allocation.crypto     / 100,
  }

  // Vol y yield promedio por clase
  const avgVol:   Record<AssetClass, number> = {} as Record<AssetClass, number>
  const avgYield: Record<AssetClass, number> = {} as Record<AssetClass, number>
  classes.forEach(cls => {
    const group = assets.filter(a => a.assetClass === cls)
    avgVol[cls]   = group.length ? group.reduce((s, a) => s + a.volatility, 0) / group.length : BASE_VOL[cls]
    const withYield = group.filter(a => (a.dividendYield ?? 0) > 0)
    avgYield[cls] = withYield.length ? withYield.reduce((s, a) => s + (a.dividendYield ?? 0), 0) / withYield.length : 0
  })

  // Retorno forward-looking por clase (yield-based para bonos/equity; no solo historial)
  let expectedReturn = 0
  classes.forEach(cls => {
    const group    = assets.filter(a => a.assetClass === cls)
    const histRet  = group.length ? group.reduce((s, a) => s + a.return1y, 0) / group.length : 0
    expectedReturn += w[cls] * forwardReturn(cls, histRet, avgYield[cls])
  })

  // Vol con matriz de correlaciones (más precisa que suma cuadrática independiente)
  let varPortfolio = 0
  for (const i of classes) {
    for (const j of classes) {
      varPortfolio += w[i] * w[j] * avgVol[i] * avgVol[j] * RHO[i][j]
    }
  }
  const annualVolatility = Math.sqrt(Math.max(0, varPortfolio))

  // Sharpe con retorno forward-looking
  const sharpeRatio = annualVolatility > 0 ? (expectedReturn - RF_RATE) / annualVolatility : 0

  // Max drawdown ajustado por composición: más equity/crypto = caída potencial mayor
  const ddMult  = 1.2 + (w.fondos + w.etfs) * 0.8 + w.crypto * 1.5
  const maxDrawdown = -(annualVolatility * ddMult)

  // Yield promedio ponderado del portafolio (ingreso pasivo)
  const portfolioYield = classes.reduce((s, cls) => s + w[cls] * avgYield[cls], 0)

  return {
    expectedReturn:   Math.round(expectedReturn   * 100) / 100,
    annualVolatility: Math.round(annualVolatility * 100) / 100,
    sharpeRatio:      Math.round(sharpeRatio      * 100) / 100,
    maxDrawdown:      Math.round(maxDrawdown       * 100) / 100,
    portfolioYield:   Math.round(portfolioYield    * 100) / 100,
  }
}

// ─── Retorno esperado por clase (para reporte) ────────────────────────────────
export function avgReturnByClass(assets: Asset[]): Record<AssetClass, number> {
  const classes: AssetClass[] = ['fondos', 'etfs', 'renta_fija', 'crypto']
  const result = {} as Record<AssetClass, number>
  classes.forEach(cls => {
    const group = assets.filter(a => a.assetClass === cls)
    result[cls] = group.length
      ? Math.round(group.reduce((s, a) => s + a.return1y, 0) / group.length * 100) / 100
      : 0
  })
  return result
}
