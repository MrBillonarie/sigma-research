'use client'
import { useState, useEffect } from 'react'

interface OpenTrade {
  sym: string
  direction: string
  grade: string
  entry: number
  strategy?: string
}

interface PanelData {
  regime: string
  equity: number
  equity_initial: number
  open_trades: OpenTrade[]
  promoted_today: number
  last_decision_at: string | null
  backtests: number
  coverage_active: number
  wr: number
}

function relativeTime(iso: string | null): string {
  if (!iso) return '--'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diff < 1)  return 'hace <1m'
  if (diff < 60) return `hace ${diff}m`
  return `hace ${Math.floor(diff / 60)}h ${diff % 60}m`
}

const REGIME_COLOR: Record<string, string> = {
  BEAR:    '#f87171',
  BULL:    '#34d399',
  NEUTRAL: '#d4af37',
  UNKNOWN: '#7a7f9a',
}

const GRADE_COLOR: Record<string, string> = {
  'A+': '#d4af37',
  'A':  '#4a9eff',
  'B':  '#8b8fa8',
  'C':  '#f87171',
}

export default function EngineHeroPanel() {
  const [data,       setData]       = useState<PanelData | null>(null)
  const [updateTime, setUpdateTime] = useState('--')

  async function load() {
    try {
      const r = await fetch('/api/public/landing-data', { cache: 'no-store' })
      if (!r.ok) return
      const d: PanelData = await r.json()
      setData(d)
      setUpdateTime(new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }))
    } catch {}
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  const regimeColor = REGIME_COLOR[data?.regime ?? 'UNKNOWN']
  const returnPct   = data
    ? (((data.equity - data.equity_initial) / data.equity_initial) * 100).toFixed(2)
    : '--'
  const openTrade   = data?.open_trades?.[0] ?? null

  return (
    <div className="relative border border-gold/20 bg-surface/60 backdrop-blur-sm overflow-hidden">
      {/* Top scan line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gold/10">
        <span className="terminal-text text-[9px] text-gold/60 tracking-[0.3em]">{'// SIGMA ENGINE · LIVE'}</span>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="terminal-text text-[9px] text-muted">{updateTime}</span>
        </div>
      </div>

      {/* Regime + Return */}
      <div className="grid grid-cols-2 gap-px bg-gold/8 border-b border-gold/10">
        <div className="bg-surface px-5 py-5">
          <div className="terminal-text text-[9px] text-muted tracking-[0.25em] uppercase mb-2">Régimen</div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: regimeColor }} />
            <span className="terminal-text text-sm font-bold" style={{ color: regimeColor }}>
              {data?.regime ?? '---'}
            </span>
          </div>
        </div>
        <div className="bg-surface px-5 py-5">
          <div className="terminal-text text-[9px] text-muted tracking-[0.25em] uppercase mb-2">Paper Equity</div>
          <div className="num text-sm font-bold text-gold tabular-nums leading-none">
            ${data ? data.equity.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '---'}
          </div>
          <div className="num text-xs text-emerald-400 tabular-nums mt-1">
            {returnPct !== '--' ? `+${returnPct}%` : '--'}
          </div>
        </div>
      </div>

      {/* Open trade */}
      <div className="px-5 py-4 border-b border-gold/10 min-h-[72px]">
        <div className="terminal-text text-[9px] text-muted tracking-[0.25em] uppercase mb-3">Trade activo</div>
        {openTrade ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="terminal-text text-xs px-2 py-0.5 border font-bold"
              style={{ color: GRADE_COLOR[openTrade.grade] ?? '#7a7f9a', borderColor: (GRADE_COLOR[openTrade.grade] ?? '#7a7f9a') + '40' }}
            >
              {openTrade.grade}
            </span>
            <span className="display-heading text-lg text-text">{openTrade.sym}</span>
            <span
              className="terminal-text text-[9px] px-2 py-0.5 border"
              style={{
                color:        openTrade.direction === 'short' ? '#f87171' : '#34d399',
                borderColor: (openTrade.direction === 'short' ? '#f87171' : '#34d399') + '30',
                background:  (openTrade.direction === 'short' ? 'rgba(248,113,113,' : 'rgba(52,211,153,') + '0.08)',
              }}
            >
              {openTrade.direction.toUpperCase()}
            </span>
            <span className="terminal-text text-[9px] text-muted ml-auto">@ {openTrade.entry}</span>
          </div>
        ) : (
          <span className="terminal-text text-xs text-muted">Sin posición abierta</span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-px bg-gold/8 border-b border-gold/10">
        <div className="bg-surface px-4 py-4 text-center">
          <div className="num text-xl font-bold text-text tabular-nums">
            {data ? `${data.wr.toFixed(0)}%` : '--'}
          </div>
          <div className="terminal-text text-[8px] text-muted tracking-[0.2em] mt-1 uppercase">Win Rate</div>
        </div>
        <div className="bg-surface px-4 py-4 text-center">
          <div className="num text-xl font-bold text-text tabular-nums">
            {data?.coverage_active ?? '--'}
          </div>
          <div className="terminal-text text-[8px] text-muted tracking-[0.2em] mt-1 uppercase">Modelos</div>
        </div>
        <div className="bg-surface px-4 py-4 text-center">
          <div className="num text-xl font-bold text-gold tabular-nums">
            {data ? `${(data.backtests / 1_000_000).toFixed(1)}M` : '--'}
          </div>
          <div className="terminal-text text-[8px] text-muted tracking-[0.2em] mt-1 uppercase">Backtests</div>
        </div>
      </div>

      {/* Last decision */}
      <div className="px-5 py-3 flex items-center justify-between">
        <span className="terminal-text text-[9px] text-muted">última decisión del motor</span>
        <span className="terminal-text text-[9px] text-gold">{data ? relativeTime(data.last_decision_at) : '--'}</span>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
    </div>
  )
}
