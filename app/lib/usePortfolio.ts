'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/app/lib/supabase'

const PLATFORMS = [
  { id: 'ibkr',            isCLP: false },
  { id: 'binance_spot',    isCLP: false },
  { id: 'binance_futures', isCLP: false },
  { id: 'fintual',         isCLP: true  },
  { id: 'santander',       isCLP: true  },
  { id: 'cash',            isCLP: false },
] as const

const TRM_FALLBACK = 960

type PortfolioRow = Record<string, number>
interface PassivePosition { capital: number }

function loadFromStorage(setPortfolio: (v: PortfolioRow) => void, setPositions: (v: PassivePosition[]) => void, setTotalFromStorage: (v: number) => void) {
  try {
    const n = Number(localStorage.getItem('sigma_portfolio_total'))
    if (n > 0) setTotalFromStorage(n)
  } catch {}
  try {
    const raw = localStorage.getItem('sigma_portfolio')
    if (raw) setPortfolio(JSON.parse(raw) as PortfolioRow)
  } catch {}
  try {
    const raw = localStorage.getItem('sigma_positions')
    if (raw) setPositions(JSON.parse(raw) as PassivePosition[])
  } catch {}
}

// Fuente de verdad del portfolio total:
//   1. Supabase (multi-dispositivo, más preciso)
//   2. localStorage como cache/fallback inmediato
export function usePortfolio() {
  const [totalFromStorage, setTotalFromStorage] = useState(0)
  const [portfolio,        setPortfolio]        = useState<PortfolioRow>({})
  const [positions,        setPositions]        = useState<PassivePosition[]>([])
  const [trm,              setTrm]              = useState(TRM_FALLBACK)
  const [ready,            setReady]            = useState(false)

  useEffect(() => {
    // TRM en vivo
    fetch('/api/trm')
      .then(r => r.json())
      .then(j => { if (j.clpPerUsd > 0) setTrm(j.clpPerUsd) })
      .catch(() => {})

    // Carga localStorage inmediata (mientras llega Supabase)
    loadFromStorage(setPortfolio, setPositions, setTotalFromStorage)

    // Luego Supabase como fuente autoritativa
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setReady(true); return }

      const [pRes, posRes] = await Promise.all([
        supabase.from('portfolio').select('*').eq('user_id', data.user.id).maybeSingle(),
        supabase.from('passive_positions').select('capital').eq('user_id', data.user.id),
      ])

      if (pRes.data) {
        const row = pRes.data as PortfolioRow
        setPortfolio(row)
        try { localStorage.setItem('sigma_portfolio', JSON.stringify(row)) } catch {}
      }

      if (posRes.data?.length) {
        setPositions(posRes.data as PassivePosition[])
        try { localStorage.setItem('sigma_positions', JSON.stringify(posRes.data)) } catch {}
      }

      setReady(true)
    }).catch(() => setReady(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const computedTotal = useMemo(() => {
    const platformTotal = PLATFORMS.reduce((sum, p) => {
      const raw = portfolio[p.id] ?? 0
      return sum + (p.isCLP ? raw / trm : raw)
    }, 0)
    const passiveCapital = positions.reduce((sum, p) => sum + (p.capital ?? 0), 0)
    return platformTotal + passiveCapital
  }, [portfolio, positions, trm])

  const totalUSD = totalFromStorage > 0 ? totalFromStorage : computedTotal

  return { totalUSD, trm, ready }
}
