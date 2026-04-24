'use client'
import { useEffect, useRef, useState } from 'react'

const stats = [
  { label: 'Años de datos',        value: 25,     suffix: '+',  decimals: 0 },
  { label: 'Tickers cubiertos',    value: 3500,   suffix: '+',  decimals: 0 },
  { label: 'Modelos en producción',value: 4,      suffix: '',   decimals: 0 },
  { label: 'Sharpe OOS promedio',  value: 2.17,   suffix: '',   decimals: 2 },
  { label: 'Uptime plataforma',    value: 99.7,   suffix: '%',  decimals: 1 },
  { label: 'Simulaciones MC',      value: 2000,   suffix: '',   decimals: 0 },
]

function Counter({ target, decimals, suffix }: { target: number; decimals: number; suffix: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const duration = 1600
        const start = Date.now()
        const tick = () => {
          const p = Math.min((Date.now() - start) / duration, 1)
          const eased = 1 - Math.pow(1 - p, 3)
          setVal(parseFloat((eased * target).toFixed(decimals)))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        observer.disconnect()
      }
    }, { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, decimals])

  return (
    <span ref={ref} className="tabular-nums">
      {val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  )
}

export default function StatBar() {
  return (
    <div className="bg-surface border-y border-border">
      <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border">
        {stats.map(s => (
          <div key={s.label} className="bg-surface px-6 py-4 flex flex-col gap-1">
            <span className="section-label text-text-dim text-xs leading-tight">{s.label}</span>
            <span className="display-heading text-3xl text-gold">
              <Counter target={s.value} decimals={s.decimals} suffix={s.suffix} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
