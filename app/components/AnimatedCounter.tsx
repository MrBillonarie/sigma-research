'use client'
import { useEffect, useRef, useState } from 'react'

interface Props { value: string; label: string }

function parseNum(v: string): { num: number; suffix: string; prefix: string } {
  const prefix = v.startsWith('$') ? '$' : ''
  const clean  = v.replace('$', '').replace('%', '').replace('x', '')
  const suffix = v.endsWith('%') ? '%' : v.endsWith('x') ? 'x' : ''
  return { num: parseFloat(clean) || 0, suffix, prefix }
}

export default function AnimatedCounter({ value, label }: Props) {
  const [display, setDisplay] = useState('0')
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { num, suffix, prefix } = parseNum(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); obs.disconnect() } },
      { threshold: 0.5 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    const duration = 1800
    const start    = performance.now()
    const isInt    = Number.isInteger(num)

    function step(now: number) {
      const pct  = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - pct, 3)
      const cur  = num * ease
      setDisplay(isInt ? Math.round(cur).toString() : cur.toFixed(2))
      if (pct < 1) requestAnimationFrame(step)
      else setDisplay(value.replace(prefix, '').replace(suffix, ''))
    }
    requestAnimationFrame(step)
  }, [started, num, value, prefix, suffix])

  return (
    <div ref={ref} className="bg-bg p-10 text-center group">
      <div className="display-heading text-5xl sm:text-6xl gold-text mb-2 tabular-nums">
        {prefix}{display}{suffix}
      </div>
      <div className="terminal-text text-xs text-text-dim tracking-widest uppercase">{label}</div>
    </div>
  )
}
