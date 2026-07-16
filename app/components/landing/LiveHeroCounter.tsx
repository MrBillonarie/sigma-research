'use client'

import { useEffect, useRef, useState } from 'react'

// Static CSS injected once — not user input
const ANIM_CSS = `
@keyframes sigma-digit-up {
  0%   { transform: translateY(60%); opacity: 0; filter: blur(3px); }
  60%  { filter: blur(0); }
  100% { transform: translateY(0);   opacity: 1; filter: blur(0); }
}
@keyframes sigma-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200%  center; }
}
@keyframes sigma-pulse-glow {
  0%, 100% { box-shadow: 0 0 0px rgba(57,226,230,0); }
  50%       { box-shadow: 0 0 12px rgba(57,226,230,0.25); }
}
`

function RollingDigit({ char }: { char: string }) {
  const [animKey, setAnimKey] = useState(0)
  const prev = useRef(char)

  useEffect(() => {
    if (char !== prev.current && /\d/.test(char)) {
      prev.current = char
      setAnimKey(k => k + 1)
    }
  }, [char])

  // Separator — muted, no animation
  if (!/\d/.test(char)) {
    return (
      <span style={{ color: 'rgba(57,226,230,0.3)', display: 'inline-block' }}>
        {char}
      </span>
    )
  }

  return (
    <span
      key={animKey}
      style={{
        display: 'inline-block',
        animation: animKey > 0
          ? 'sigma-digit-up 0.45s cubic-bezier(0.22,1,0.36,1) both'
          : 'none',
      }}
    >
      {char}
    </span>
  )
}

const FALLBACK_TOTAL   = 16_386_795
const FALLBACK_RATE_HR = 124_075

export default function LiveHeroCounter() {
  const [count, setCount]   = useState(FALLBACK_TOTAL)
  const [rateHr, setRateHr] = useState(FALLBACK_RATE_HR)
  const [live, setLive]     = useState(false)
  const [ready, setReady]   = useState(false)

  useEffect(() => {
    const load = () =>
      fetch('/api/public/engine-stats')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.total) {
            setCount(d.total)
            setRateHr(d.rate_hr ?? FALLBACK_RATE_HR)
            setLive(d.live ?? false)
            setReady(true)
          }
        })
        .catch(() => setReady(true))

    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  const ratePerSec  = Math.round(rateHr / 3600)
  const formatted   = count.toLocaleString('es-CL')
  // Fill bar: 200K/hr = theoretical max
  const velocityPct = Math.min((rateHr / 200_000) * 100, 100).toFixed(1)

  return (
    <div
      className="relative bg-surface border border-gold/25 overflow-hidden"
      style={{ animation: 'sigma-pulse-glow 4s ease-in-out infinite' }}
    >
      <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />

      {/* Top scan line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />

      {/* Corner brackets */}
      <div className="absolute top-0 left-0 w-5 h-5 pointer-events-none"
        style={{ borderTop: '2px solid rgba(57,226,230,0.5)', borderLeft: '2px solid rgba(57,226,230,0.5)' }} />
      <div className="absolute top-0 right-0 w-5 h-5 pointer-events-none"
        style={{ borderTop: '2px solid rgba(57,226,230,0.5)', borderRight: '2px solid rgba(57,226,230,0.5)' }} />
      <div className="absolute bottom-0 left-0 w-5 h-5 pointer-events-none"
        style={{ borderBottom: '2px solid rgba(57,226,230,0.5)', borderLeft: '2px solid rgba(57,226,230,0.5)' }} />
      <div className="absolute bottom-0 right-0 w-5 h-5 pointer-events-none"
        style={{ borderBottom: '2px solid rgba(57,226,230,0.5)', borderRight: '2px solid rgba(57,226,230,0.5)' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gold/10">
        <span className="terminal-text text-xs text-gold tracking-[0.3em] uppercase">
          {'// Motor Cuantitativo'}
        </span>
        <span className={`terminal-text text-[10px] flex items-center gap-2 ${live ? 'text-emerald-400' : 'text-text-dim'}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-400 animate-pulse' : 'bg-muted'}`} />
          {live ? 'EN VIVO' : 'ÚLTIMA LECTURA'}
        </span>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto]">

        {/* Rolling number */}
        <div className="px-8 py-8">
          <div
            className="num font-bold text-gold tabular-nums leading-none tracking-tight"
            style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)' }}
          >
            {ready
              ? formatted.split('').map((ch, i) => <RollingDigit key={i} char={ch} />)
              : formatted
            }
          </div>
          <div className="terminal-text text-xs text-text-dim mt-3 tracking-[0.25em] uppercase">
            Backtests ejecutados
          </div>
        </div>

        {/* Rate stats */}
        <div className="grid grid-cols-2 sm:grid-cols-1 border-t sm:border-t-0 sm:border-l border-gold/10 divide-x sm:divide-x-0 sm:divide-y divide-gold/10">

          <div className="flex flex-col items-center sm:items-end justify-center px-7 py-5 sm:py-6">
            <div className="flex items-baseline gap-0.5">
              <span className="terminal-text text-xs text-emerald-400/60">+</span>
              <span className="num text-3xl font-bold text-emerald-400 tabular-nums">
                {ratePerSec}
              </span>
            </div>
            <span className="terminal-text text-[10px] text-muted mt-1 tracking-widest uppercase">por segundo</span>
          </div>

          <div className="flex flex-col items-center sm:items-end justify-center px-7 py-5 sm:py-6">
            <div className="flex items-baseline gap-0.5">
              <span className="terminal-text text-xs text-gold/50">+</span>
              <span className="num text-3xl font-bold text-gold tabular-nums">
                {rateHr.toLocaleString('es-CL')}
              </span>
            </div>
            <span className="terminal-text text-[10px] text-muted mt-1 tracking-widest uppercase">por hora</span>
          </div>

        </div>
      </div>

      {/* Velocity bar with shimmer */}
      <div className="border-t border-gold/10 px-8 py-3 flex items-center gap-4">
        <span className="terminal-text text-[10px] text-muted tracking-[0.25em] uppercase whitespace-nowrap">
          Velocidad
        </span>
        <div className="flex-1 h-[3px] bg-gold/8 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${velocityPct}%`,
              background: 'linear-gradient(90deg, rgba(57,226,230,0.3) 0%, rgba(57,226,230,0.8) 40%, rgba(255,245,180,1) 50%, rgba(57,226,230,0.8) 60%, rgba(57,226,230,0.3) 100%)',
              backgroundSize: '200% 100%',
              animation: 'sigma-shimmer 2.5s linear infinite',
              transition: 'width 1.5s ease',
            }}
          />
        </div>
        <span className="terminal-text text-[10px] text-gold/50 tracking-widest whitespace-nowrap">
          {velocityPct}%
        </span>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
    </div>
  )
}
