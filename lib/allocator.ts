import type { Asset, AssetClass, Allocation, PortfolioMetrics, Profile } from '@/types/decision-engine'

const RF_RATE = 4.5

const BASE_VOL: Record<AssetClass, number> = {
  fondos: 8, etfs: 14, renta_fija: 3, crypto: 65,
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

  // Retorno esperado ponderado
  let expectedReturn = 0
  classes.forEach(cls => {
    const group = assets.filter(a => a.assetClass === cls)
    const avg   = group.length ? group.reduce((s, a) => s + a.return1y, 0) / group.length : 0
    expectedReturn += w[cls] * avg
  })

  // Volatilidad anualizada simplificada (suma cuadrática de varianzas)
  const annualVolatility = Math.sqrt(
    classes.reduce((sum, cls) => {
      const group  = assets.filter(a => a.assetClass === cls)
      const avgVol = group.length
        ? group.reduce((s, a) => s + a.volatility, 0) / group.length
        : BASE_VOL[cls]
      return sum + Math.pow(w[cls] * avgVol, 2)
    }, 0)
  )

  const sharpeRatio = annualVolatility > 0
    ? (expectedReturn - RF_RATE) / annualVolatility
    : 0
  const maxDrawdown = -(annualVolatility * 1.4)

  return {
    expectedReturn:   Math.round(expectedReturn   * 100) / 100,
    annualVolatility: Math.round(annualVolatility * 100) / 100,
    sharpeRatio:      Math.round(sharpeRatio      * 100) / 100,
    maxDrawdown:      Math.round(maxDrawdown       * 100) / 100,
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
