'use client'

import { useEffect, useState } from 'react'

const ANIM_CSS = `
@keyframes ent-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
`

interface LiveData {
  regime:  string
  by_tf:   Record<string, number>
  rate_hr: number
  total:   number
  live:    boolean
}

const FALLBACK: LiveData = {
  regime:  'BEAR',
  by_tf:   { '4h': 3_472_285, '1h': 5_672_653, '15m': 5_696_032, '5m': 1_279_475 },
  rate_hr: 124_075,
  total:   16_386_795,
  live:    false,
}

const STATIC_ROW1 = [
  { label: 'ENTIDAD',     value: 'Sigma Research / SQuantDesk' },
  { label: 'CATEGORÍA',   value: 'Quantitative Research Platform' },
  { label: 'FUNDADO',     value: '2023' },
]
const ACTIVOS = 'BTC · ETH · SOL · BNB · LTC · XAU · XAG · WTI · HG · NG · PL'

const TF_ORDER = ['4h', '1h', '15m', '5m']

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K'
  return n.toLocaleString('es-CL')
}

export default function EntityProfile() {
  const [data, setData]    = useState<LiveData>(FALLBACK)
  const [fetchedAt, setAt] = useState<number | null>(null)
  const [, tick]           = useState(0)

  useEffect(() => {
    const load = () =>
      fetch('/api/public/engine-stats')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) {
            setData({ regime: d.regime ?? '–', by_tf: d.by_tf ?? FALLBACK.by_tf, rate_hr: d.rate_hr ?? 124_075, total: d.total ?? 0, live: d.live ?? false })
            setAt(Date.now())
          }
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  function timeAgo() {
    if (!fetchedAt) return '...'
    const mins = Math.floor((Date.now() - fetchedAt) / 60_000)
    if (mins < 1) return 'ahora mismo'
    if (mins === 1) return 'hace 1 min'
    return `hace ${mins} min`
  }

  const isBull       = data.regime === 'BULL'
  const isBear       = data.regime === 'BEAR'
  const regimeColor  = isBull ? 'text-emerald-400' : isBear ? 'text-amber-400' : 'text-text'
  const regimeDot    = isBull ? 'bg-emerald-400'   : isBear ? 'bg-amber-400'   : 'bg-muted'

  const tfEntries = TF_ORDER
    .map(k => ({ label: k.toUpperCase(), value: data.by_tf[k] ?? 0, pct: data.total > 0 ? ((data.by_tf[k] ?? 0) / data.total) * 100 : 0 }))
    .filter(t => t.value >= 1_000)

  const maxPct  = Math.max(...tfEntries.map(t => t.pct), 1)
  const rateVel = Math.min((data.rate_hr / 200_000) * 100, 100)

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

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gold/10">
        <span className="terminal-text text-xs text-gold tracking-[0.3em] uppercase">
          {'// Perfil Operacional'}
        </span>
        <span className="terminal-text text-xs text-muted tracking-widest">SIGMA_RESEARCH_001</span>
      </div>

      {/* ── Profile rows ── */}
      {/* Row 1: 3 static + MOTOR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gold/8">
        {STATIC_ROW1.map(({ label, value }) => (
          <div key={label} className="bg-surface px-6 py-4">
            <div className="terminal-text text-[10px] text-muted tracking-[0.25em] uppercase mb-1.5">{label}</div>
            <div className="terminal-text text-sm text-text font-medium leading-snug">{value}</div>
          </div>
        ))}
        <div className="bg-surface px-6 py-4">
          <div className="terminal-text text-[10px] text-muted tracking-[0.25em] uppercase mb-1.5">MOTOR</div>
          <div className="terminal-text text-sm font-medium leading-snug">
            <span className="text-text">Sigma Engine v13</span>{' '}
            <span className="text-emerald-400 text-xs font-bold tracking-wider">· ACTIVO</span>
          </div>
        </div>
      </div>

      {/* Row 2: ACTIVOS (col-span-2) + RÉGIMEN + ACTUALIZACIÓN */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gold/8 border-t border-gold/8">
        <div className="bg-surface px-6 py-4 col-span-2">
          <div className="terminal-text text-[10px] text-muted tracking-[0.25em] uppercase mb-1.5">ACTIVOS</div>
          <div className="terminal-text text-sm text-text font-medium leading-snug tracking-wide">
            {ACTIVOS}
          </div>
        </div>
        <div className="bg-surface px-6 py-4">
          <div className="terminal-text text-[10px] text-muted tracking-[0.25em] uppercase mb-1.5">RÉGIMEN</div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${regimeDot} ${fetchedAt ? 'animate-pulse' : ''}`} />
            <span className={`terminal-text text-sm font-bold ${regimeColor}`}>{data.regime}</span>
          </div>
        </div>
        <div className="bg-surface px-6 py-4">
          <div className="terminal-text text-[10px] text-muted tracking-[0.25em] uppercase mb-1.5">ACTUALIZACIÓN</div>
          <div className="terminal-text text-sm text-text font-medium">{timeAgo()}</div>
        </div>
      </div>

      {/* ── Timeframe sub-divider ── */}
      <div className="flex items-center gap-3 px-6 py-2 border-t border-gold/10">
        <div className="h-px flex-1 bg-gold/10" />
        <span className="terminal-text text-[10px] text-gold/35 tracking-[0.45em] uppercase">Distribución por Timeframe</span>
        <div className="h-px flex-1 bg-gold/10" />
      </div>

      {/* ── TF grid ── */}
      <div
        className="grid gap-px bg-gold/8"
        style={{ gridTemplateColumns: `repeat(${tfEntries.length}, minmax(0,1fr)) minmax(110px,auto)` }}
      >
        {tfEntries.map(({ label, value, pct }) => {
          const isTop = pct >= maxPct * 0.9
          return (
            <div key={label} className="bg-surface px-4 pt-4 pb-3 flex flex-col gap-2">
              <div className={`terminal-text text-[10px] tracking-[0.25em] uppercase font-bold ${isTop ? 'text-gold' : 'text-muted'}`}>
                {label}
              </div>
              <div className={`num text-xl font-bold tabular-nums leading-none ${isTop ? 'text-gold' : 'text-text'}`}>
                {fmt(value)}
              </div>
              <div className="h-[3px] bg-gold/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(pct / maxPct) * 100}%`,
                    background: isTop
                      ? 'linear-gradient(90deg,rgba(57,226,230,0.5) 0%,rgba(255,245,180,1) 50%,rgba(57,226,230,0.5) 100%)'
                      : `rgba(57,226,230,${0.25 + (pct / maxPct) * 0.45})`,
                    backgroundSize: isTop ? '200% 100%' : undefined,
                    animation: isTop ? 'ent-shimmer 2.5s linear infinite' : undefined,
                  }}
                />
              </div>
              <div className={`terminal-text text-[10px] tabular-nums ${isTop ? 'text-gold/70' : 'text-muted'}`}>
                {pct.toFixed(1)}%
              </div>
            </div>
          )
        })}

        {/* Rate column */}
        <div className="bg-emerald-400/5 px-5 pt-4 pb-3 flex flex-col justify-between gap-2">
          <div className="terminal-text text-[10px] text-emerald-400/70 tracking-[0.25em] uppercase font-bold">VELOCIDAD</div>
          <div>
            <div className="flex items-baseline gap-0.5">
              <span className="terminal-text text-xs text-emerald-400/60">+</span>
              <span className="num text-xl font-bold text-emerald-400 tabular-nums">{fmt(data.rate_hr)}</span>
            </div>
            <div className="terminal-text text-[10px] text-muted mt-0.5 tracking-widest">/ HORA</div>
          </div>
          <div className="h-[3px] bg-gold/8 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${rateVel}%`, background: 'linear-gradient(90deg,rgba(52,211,153,0.4) 0%,rgba(52,211,153,0.9) 100%)', transition: 'width 1s ease' }} />
          </div>
          <div className="terminal-text text-[10px] text-emerald-400/50 tabular-nums">{rateVel.toFixed(0)}% cap.</div>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
    </div>
  )
}
