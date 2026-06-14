'use client'
import { useEffect, useRef, useState } from 'react'

const G   = '#d4af37'
const BG  = '#04050a'
const B   = '#1a1d2e'
const DIM = '#5a6080'

const STATS = [
  { raw: 85.2,  display: '85.2%', label: 'Win Rate',      detail: 'backtesting OOS',    suffix: '%',  decimals: 1 },
  { raw: 4.16,  display: '4.16×', label: 'Profit Factor', detail: 'PRO.MACD v116',       suffix: '×',  decimals: 2 },
  { raw: 1.87,  display: '1.87',  label: 'Sharpe Ratio',  detail: '12M rolling',         suffix: '',   decimals: 2 },
  { raw: 12.4,  display: '−12.4%',label: 'Max Drawdown',  detail: 'Ene 22 – Dic 24',    suffix: '%',  decimals: 1, negative: true },
]

function useCounter(target: number, decimals: number, active: boolean) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    const duration = 1800
    const steps    = 60
    let current    = 0
    let frame      = 0
    const id = setInterval(() => {
      frame++
      const ease = 1 - Math.pow(1 - frame / steps, 3)
      current = target * ease
      setVal(parseFloat(current.toFixed(decimals)))
      if (frame >= steps) { setVal(target); clearInterval(id) }
    }, duration / steps)
    return () => clearInterval(id)
  }, [active, target, decimals])
  return val
}

function StatCard({ s, active }: { s: typeof STATS[0]; active: boolean }) {
  const val = useCounter(s.raw, s.decimals, active)
  const display = `${s.negative ? '−' : ''}${val.toFixed(s.decimals)}${s.suffix}`
  return (
    <div style={{ background: BG, padding: '48px 36px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${G}, transparent)` }} />
      <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.28em', color: DIM, textTransform: 'uppercase', marginBottom: 16 }}>{s.label}</div>
      <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 62, color: G, lineHeight: 1, letterSpacing: '0.02em', marginBottom: 8, transition: 'all 0.1s' }}>
        {active ? display : s.display}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: DIM, letterSpacing: '0.1em' }}>{s.detail}</div>
    </div>
  )
}

export default function StatsCounter() {
  const ref    = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setActive(true); obs.disconnect() } }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref}>
      <div className="landing-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: B, gap: 1 }}>
        {STATS.map(s => <StatCard key={s.label} s={s} active={active} />)}
      </div>
      <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: DIM, letterSpacing: '0.08em' }}>* Backtesting out-of-sample · Pasados no garantizan futuros</span>
      </div>
    </div>
  )
}
