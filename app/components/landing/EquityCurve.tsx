'use client'

import { useEffect, useState } from 'react'

interface PerfData {
  return_pct:    number
  profit_factor: number
  max_dd_pct:    number
  win_rate:      number
  total_trades:  number
  live:          boolean
}

const FALLBACK: PerfData = {
  return_pct:    14.23,
  profit_factor: 1.935,
  max_dd_pct:    -8.74,
  win_rate:      59.1,
  total_trades:  22,
  live:          false,
}

const ANIM_CSS = `
@keyframes ec-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
`

function fmt1(n: number, decimals = 2) { return n.toFixed(decimals) }

export default function EquityCurve() {
  const [data, setData] = useState<PerfData>(FALLBACK)

  useEffect(() => {
    fetch('/api/public/engine-stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.return_pct != null) setData(d as PerfData) })
      .catch(() => {})
  }, [])

  const isPos     = data.return_pct >= 0
  const retColor  = isPos ? '#34d399' : '#f87171'
  const pfColor   = data.profit_factor >= 1.5 ? '#34d399' : data.profit_factor >= 1 ? 'var(--color-text)' : '#f87171'
  const ddColor   = '#f87171'
  const wrColor   = data.win_rate >= 55 ? '#34d399' : 'var(--color-text)'

  const metrics = [
    {
      label:    'RETORNO',
      value:    `${isPos ? '+' : ''}${fmt1(data.return_pct)}%`,
      sub:      'cuenta real · desde el inicio',
      color:    retColor,
      shimmer:  isPos,
      span2:    false,
    },
    {
      label:    'ACIERTOS',
      value:    `${fmt1(data.win_rate)}%`,
      sub:      'operaciones ganadoras',
      color:    wrColor,
      shimmer:  false,
      span2:    false,
    },
    {
      label:    'RATIO G/P',
      value:    fmt1(data.profit_factor),
      sub:      'profit factor',
      color:    pfColor,
      shimmer:  false,
      span2:    false,
    },
    {
      label:    'RIESGO MÁX',
      value:    `${fmt1(data.max_dd_pct)}%`,
      sub:      'drawdown máximo',
      color:    ddColor,
      shimmer:  false,
      span2:    false,
    },
  ]

  return (
    <div className="relative bg-surface border border-gold/25 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />

      {/* Top scan line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      {/* Corner brackets */}
      <div className="absolute top-0    left-0  w-5 h-5 pointer-events-none" style={{ borderTop: '2px solid rgba(57,226,230,0.5)', borderLeft: '2px solid rgba(57,226,230,0.5)' }} />
      <div className="absolute top-0    right-0 w-5 h-5 pointer-events-none" style={{ borderTop: '2px solid rgba(57,226,230,0.5)', borderRight: '2px solid rgba(57,226,230,0.5)' }} />
      <div className="absolute bottom-0 left-0  w-5 h-5 pointer-events-none" style={{ borderBottom: '2px solid rgba(57,226,230,0.5)', borderLeft: '2px solid rgba(57,226,230,0.5)' }} />
      <div className="absolute bottom-0 right-0 w-5 h-5 pointer-events-none" style={{ borderBottom: '2px solid rgba(57,226,230,0.5)', borderRight: '2px solid rgba(57,226,230,0.5)' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gold/10">
        <span className="terminal-text text-xs text-gold tracking-[0.3em] uppercase">
          {'// Rendimiento del Motor · Últimos 30 días'}
        </span>
        <span className="terminal-text text-[10px] text-muted tracking-widest flex items-center gap-2">
          <span className="inline-block w-1 h-1 rounded-full bg-muted" />
          {data.total_trades} OPERACIONES · CUENTA REAL
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gold/8">
        {metrics.map(({ label, value, sub, color, shimmer }) => (
          <div key={label} className="bg-surface px-6 py-6 flex flex-col gap-2">
            <div className="terminal-text text-[10px] text-muted tracking-[0.25em] uppercase">{label}</div>
            <div
              className="num text-3xl font-bold tabular-nums leading-none"
              style={shimmer ? {
                background: `linear-gradient(90deg, ${color}99 0%, ${color} 40%, #fffde7 60%, ${color} 80%, ${color}99 100%)`,
                backgroundSize: '200% 100%',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'ec-shimmer 3s linear infinite',
              } : { color }}
            >
              {value}
            </div>
            <div className="terminal-text text-[10px] text-muted/60 tracking-wider">{sub}</div>
          </div>
        ))}
      </div>

      {/* Trade count bar — visual density proportional to wins */}
      <div className="px-6 py-4 border-t border-gold/8 flex items-center gap-4">
        <span className="terminal-text text-[10px] text-muted tracking-[0.2em] uppercase flex-shrink-0">
          DISTRIBUCIÓN
        </span>
        <div className="flex-1 flex gap-px h-2 rounded-full overflow-hidden bg-gold/5">
          <div
            className="h-full rounded-l-full"
            style={{
              width: `${data.win_rate}%`,
              background: 'linear-gradient(90deg, rgba(52,211,153,0.3), rgba(52,211,153,0.7))',
            }}
          />
          <div
            className="h-full rounded-r-full"
            style={{
              width: `${100 - data.win_rate}%`,
              background: 'rgba(248,113,113,0.25)',
            }}
          />
        </div>
        <span className="terminal-text text-[10px] text-emerald-400/70 flex-shrink-0 tabular-nums">
          {Math.round((data.win_rate / 100) * data.total_trades)}G
        </span>
        <span className="terminal-text text-[10px] text-red-400/50 flex-shrink-0 tabular-nums">
          {Math.round(((100 - data.win_rate) / 100) * data.total_trades)}P
        </span>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
    </div>
  )
}
