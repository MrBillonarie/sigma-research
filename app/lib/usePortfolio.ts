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

const TRM_FALLBACK = 950

type PortfolioRow = Record<string, number>
interface PassivePosition { capital: number }

// Single source of truth for portfolio total.
// Priority:
//   1. sigma_portfolio_total — written by /portfolio page after live-TRM conversion (most accurate)
//   2. Compute from sigma_portfolio + sigma_positions with TRM fallback
export function usePortfolio() {
  const [totalFromStorage, setTotalFromStorage] = useState(0)
  const [portfolio,        setPortfolio]        = useState<PortfolioRow>({})
  const [positions,        setPositions]        = useState<PassivePosition[]>([])
  const [ready,            setReady]            = useState(false)

  useEffect(() => {
    // Priority 1: pre-computed total from Portfolio page (includes live TRM)
    try {
      const n = Number(localStorage.getItem('sigma_portfolio_total'))
      if (n > 0) setTotalFromStorage(n)
    } catch {}

    // Priority 2: raw platform values (fallback if Portfolio page never ran)
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

  const computedTotal = useMemo(() => {
    const platformTotal = PLATFORMS.reduce((sum, p) => {
      const raw = portfolio[p.id] ?? 0
      return sum + (p.isCLP ? raw / TRM_FALLBACK : raw)
    }, 0)
    const passiveCapital = positions.reduce((sum, p) => sum + (p.capital ?? 0), 0)
    return platformTotal + passiveCapital
  }, [portfolio, positions])

  const totalUSD = totalFromStorage > 0 ? totalFromStorage : computedTotal

  return { totalUSD, ready }
}
