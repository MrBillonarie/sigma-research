'use client'
import { useState, useEffect, useMemo } from 'react'

const PLATFORMS = [
  { id: 'ibkr',            isCLP: false },
  { id: 'binance_spot',    isCLP: false },
  { id: 'binance_futures', isCLP: false },
  { id: 'fintual',         isCLP: true  },
  { id: 'santander',       isCLP: true  },
  { id: 'cash',            isCLP: false },
] as const

const TRM = 950

type PortfolioRow = Record<string, number>
interface PassivePosition { capital: number }

// Mirrors the formula in /portfolio page exactly:
//   totalUSD = platformTotal (sigma_portfolio) + passiveCapital (sigma_positions)
export function usePortfolio() {
  const [portfolio,  setPortfolio]  = useState<PortfolioRow>({})
  const [positions,  setPositions]  = useState<PassivePosition[]>([])
  const [ready,      setReady]      = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sigma_portfolio')
      if (raw) setPortfolio(JSON.parse(raw) as PortfolioRow)
    } catch {}

    try {
      const raw = localStorage.getItem('sigma_positions')
      if (raw) setPositions(JSON.parse(raw) as PassivePosition[])
    } catch {}

    setReady(true)
  }, [])

  const totalUSD = useMemo(() => {
    const platformTotal = PLATFORMS.reduce((sum, p) => {
      const raw = portfolio[p.id] ?? 0
      return sum + (p.isCLP ? raw / TRM : raw)
    }, 0)
    const passiveCapital = positions.reduce((sum, p) => sum + (p.capital ?? 0), 0)
    return platformTotal + passiveCapital
  }, [portfolio, positions])

  return { totalUSD, ready }
}
