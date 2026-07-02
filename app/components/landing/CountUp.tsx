'use client'
import { useEffect, useRef, useState } from 'react'

// Número que cuenta de 0 a `value` (ease-out cúbico) la primera vez que entra
// en viewport. El formato replica toFixed/toLocaleString del render estático.
export default function CountUp({ value, decimals = 0, suffix = '', prefix = '', duration = 1400 }: {
  value: number
  decimals?: number
  suffix?: string
  prefix?: string
  duration?: number
}) {
  const ref     = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  const [n, setN] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setN(value); return }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started.current) return
      started.current = true
      io.disconnect()
      const t0 = performance.now()
      function tick(t: number) {
        const p     = Math.min((t - t0) / duration, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        setN(value * eased)
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [value, duration])

  return (
    <span ref={ref}>
      {prefix}
      {n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  )
}
