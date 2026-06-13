'use client'

import { useEffect, useState } from 'react'

export default function TerminalLive() {
  const [regime, setRegime] = useState<string>('–')
  const [fetchedAt, setAt]  = useState<number | null>(null)
  const [, tick]            = useState(0)

  useEffect(() => {
    const load = () =>
      fetch('/api/public/engine-stats')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) { setRegime(d.regime ?? '–'); setAt(Date.now()) }
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
    if (fetchedAt === null) return '...'
    const mins = Math.floor((Date.now() - fetchedAt) / 60_000)
    if (mins < 1) return 'ahora mismo'
    if (mins === 1) return 'hace 1 min'
    return `hace ${mins} min`
  }

  const isBull = regime === 'BULL'
  const isBear = regime === 'BEAR'
  const valueColor = isBull ? 'text-emerald-400' : isBear ? 'text-amber-400' : 'text-text'
  const dotColor   = isBull ? 'bg-emerald-400'   : isBear ? 'bg-amber-400'   : 'bg-muted'

  return (
    <>
      <div className="bg-surface px-6 py-5">
        <div className="terminal-text text-[10px] text-muted tracking-[0.25em] uppercase mb-2">
          RÉGIMEN MERCADO
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor} ${fetchedAt ? 'animate-pulse' : ''}`} />
          <span className={`terminal-text text-sm font-bold ${valueColor}`}>{regime}</span>
        </div>
      </div>

      <div className="bg-surface px-6 py-5">
        <div className="terminal-text text-[10px] text-muted tracking-[0.25em] uppercase mb-2">
          ÚLTIMA ACTUALIZACIÓN
        </div>
        <div className="terminal-text text-sm text-text font-medium">{timeAgo()}</div>
      </div>
    </>
  )
}
