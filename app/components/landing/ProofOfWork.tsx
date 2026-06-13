'use client'

import { useEffect, useState } from 'react'

interface EngineStats {
  total:      number
  rate_hr:    number
  timeframes: number
  assets:     number
  live:       boolean
  by_tf:      Record<string, number>
}

const FALLBACK: EngineStats = {
  total:      16_386_795,
  rate_hr:    124_075,
  timeframes: 7,
  assets:     5,
  live:       false,
  by_tf: { '4h': 3_472_285, '1h': 5_672_653, '15m': 5_696_032, '5m': 1_279_475, '1d': 194_571, '2h': 71_282, '1m': 498 },
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K'
  return n.toLocaleString('es-CL')
}

const TF_ORDER = ['4h', '1h', '15m', '5m', '1d', '2h']

// Static CSS — safe, not user input
const ANIM_CSS = `
@keyframes pow-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
`

export default function ProofOfWork() {
  const [stats, setStats] = useState<EngineStats>(FALLBACK)

  useEffect(() => {
    const load = () =>
      fetch('/api/public/engine-stats')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setStats(d) })
        .catch(() => {})

    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  const tfEntries = TF_ORDER
    .filter(k => (stats.by_tf[k] ?? 0) >= 1_000)
    .map(k => ({
      label: k.toUpperCase(),
      value: stats.by_tf[k] ?? 0,
      pct:   stats.total > 0 ? ((stats.by_tf[k] ?? 0) / stats.total) * 100 : 0,
    }))

  const maxPct  = Math.max(...tfEntries.map(t => t.pct), 1)
  const rateVel = Math.min((stats.rate_hr / 200_000) * 100, 100)

  return (
    <div className="relative bg-surface border border-gold/25 overflow-hidden border-t-0">
      <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />

      {/* Corner brackets */}
      <div className="absolute top-0    left-0  w-5 h-5 pointer-events-none" style={{ borderTop:    '2px solid rgba(212,175,55,0.5)', borderLeft:  '2px solid rgba(212,175,55,0.5)' }} />
      <div className="absolute top-0    right-0 w-5 h-5 pointer-events-none" style={{ borderTop:    '2px solid rgba(212,175,55,0.5)', borderRight: '2px solid rgba(212,175,55,0.5)' }} />
      <div className="absolute bottom-0 left-0  w-5 h-5 pointer-events-none" style={{ borderBottom: '2px solid rgba(212,175,55,0.5)', borderLeft:  '2px solid rgba(212,175,55,0.5)' }} />
      <div className="absolute bottom-0 right-0 w-5 h-5 pointer-events-none" style={{ borderBottom: '2px solid rgba(212,175,55,0.5)', borderRight: '2px solid rgba(212,175,55,0.5)' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gold/10">
        <span className="terminal-text text-xs text-gold tracking-[0.3em] uppercase">
          {'// Distribución por Timeframe'}
        </span>
        <span className={`terminal-text text-[10px] flex items-center gap-2 ${stats.live ? 'text-emerald-400' : 'text-text-dim'}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${stats.live ? 'bg-emerald-400 animate-pulse' : 'bg-muted'}`} />
          {stats.live ? 'MOTOR EN VIVO' : 'ÚLTIMA LECTURA'}
        </span>
      </div>

      {/* TF grid + rate column */}
      <div
        className="grid gap-px bg-gold/8"
        style={{ gridTemplateColumns: `repeat(${tfEntries.length}, minmax(0,1fr)) minmax(120px, auto)` }}
      >
        {tfEntries.map(({ label, value, pct }) => {
          const relativeOpacity = 0.35 + (pct / maxPct) * 0.65
          const isTop = pct >= maxPct * 0.9
          return (
            <div key={label} className="bg-surface px-4 pt-5 pb-4 flex flex-col gap-2.5">
              {/* Label */}
              <div className={`terminal-text text-[10px] tracking-[0.25em] uppercase font-bold ${isTop ? 'text-gold' : 'text-muted'}`}>
                {label}
              </div>

              {/* Value */}
              <div className={`num text-xl font-bold tabular-nums leading-none ${isTop ? 'text-gold' : 'text-text'}`}>
                {fmt(value)}
              </div>

              {/* Proportion bar */}
              <div className="h-[3px] bg-gold/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(pct / maxPct) * 100}%`,
                    background: isTop
                      ? 'linear-gradient(90deg,rgba(212,175,55,0.5) 0%,rgba(255,245,180,1) 50%,rgba(212,175,55,0.5) 100%)'
                      : `rgba(212,175,55,${relativeOpacity * 0.6})`,
                    backgroundSize: isTop ? '200% 100%' : undefined,
                    animation: isTop ? 'pow-shimmer 2.5s linear infinite' : undefined,
                  }}
                />
              </div>

              {/* Percentage */}
              <div className={`terminal-text text-[10px] tabular-nums ${isTop ? 'text-gold/70' : 'text-muted'}`}>
                {pct.toFixed(1)}%
              </div>
            </div>
          )
        })}

        {/* Rate column */}
        <div className="bg-emerald-400/5 px-5 pt-5 pb-4 flex flex-col justify-between">
          <div className="terminal-text text-[10px] text-emerald-400/70 tracking-[0.25em] uppercase font-bold">
            VELOCIDAD
          </div>

          <div>
            <div className="flex items-baseline gap-0.5">
              <span className="terminal-text text-xs text-emerald-400/60">+</span>
              <span className="num text-xl font-bold text-emerald-400 tabular-nums">
                {fmt(stats.rate_hr)}
              </span>
            </div>
            <div className="terminal-text text-[10px] text-muted mt-0.5 tracking-widest">/ HORA</div>
          </div>

          {/* Velocity mini-bar */}
          <div className="h-[3px] bg-gold/8 rounded-full overflow-hidden mt-1">
            <div
              className="h-full rounded-full"
              style={{
                width: `${rateVel}%`,
                background: 'linear-gradient(90deg,rgba(52,211,153,0.4) 0%,rgba(52,211,153,0.9) 100%)',
                transition: 'width 1s ease',
              }}
            />
          </div>

          <div className="terminal-text text-[10px] text-emerald-400/50 tabular-nums">
            {rateVel.toFixed(0)}% cap.
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
    </div>
  )
}
