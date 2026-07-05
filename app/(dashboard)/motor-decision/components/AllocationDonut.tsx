'use client'
import { useEffect, useRef, useState } from 'react'
import type { Allocation, PortfolioMetrics } from '@/types/decision-engine'

// Anillo orbital propio (sin Chart.js): los segmentos barren al cargar,
// al hover se expanden y el centro se vuelve vivo — muestra el monto
// sugerido del segmento o, en reposo, el retorno esperado y tu capital.

const COLORS = {
  fondos:     '#1D9E75',
  etfs:       '#378ADD',
  renta_fija: '#d4af37',
  crypto:     '#a78bfa',
}

const LABELS = {
  fondos:     'Fondos Mutuos',
  etfs:       'ETFs Globales',
  renta_fija: 'Renta Fija',
  crypto:     'Crypto',
}

function fmt(n: number, cur: 'CLP' | 'USD'): string {
  if (cur === 'CLP') {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
    return `$${Math.round(n).toLocaleString('es-CL')}`
  }
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function useCountUp(target: number, dur = 1300) {
  const [v, setV] = useState(0)
  const fromRef = useRef(0)
  const vRef = useRef(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target); fromRef.current = target; vRef.current = target
      return
    }
    const from = fromRef.current
    let raf = 0
    let t0: number | null = null
    const tick = (t: number) => {
      if (t0 === null) t0 = t
      const p = Math.min(1, (t - t0) / dur)
      const val = from + (target - from) * (1 - Math.pow(1 - p, 3))
      vRef.current = val
      setV(val)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); fromRef.current = vRef.current }
  }, [target, dur])
  return v
}

interface Props {
  allocation: Allocation
  metrics:    PortfolioMetrics
  capital?:   number
  currency?:  'CLP' | 'USD'
}

export default function AllocationDonut({ allocation, metrics, capital = 0, currency = 'CLP' }: Props) {
  const keys = Object.keys(allocation) as (keyof Allocation)[]
  const [hovered, setHovered] = useState<keyof Allocation | null>(null)

  // Barrido de apertura: 0 → 100 controla cuánto del anillo está desplegado
  const sweep = useCountUp(100, 1300) / 100
  const animCapital = useCountUp(capital, 1400)

  const SIZE = 210
  const R = 76
  const CIRC = 2 * Math.PI * R
  const GAP = 3 // px de separación entre segmentos

  let acc = 0
  const segments = keys.map(k => {
    const frac = allocation[k] / 100
    const seg = { key: k, frac, start: acc }
    acc += frac
    return seg
  })

  const hoveredAmount = hovered && capital > 0 ? capital * allocation[hovered] / 100 : 0

  return (
    <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10, padding: 20 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 12, color: '#7a7f9a', fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }}>
        ASIGNACIÓN ÓPTIMA
        {capital > 0 && (
          <span style={{ marginLeft: 8, color: '#1D9E75' }}>
            · {fmt(animCapital, currency)} total
          </span>
        )}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        {/* Anillo orbital */}
        <div style={{ width: SIZE, height: SIZE, position: 'relative', flexShrink: 0 }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
            {/* riel de fondo */}
            <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="#1a1d2e" strokeWidth={22} />
            {segments.map(seg => {
              const isHov = hovered === seg.key
              const isDim = hovered !== null && !isHov
              const len = Math.max(0, CIRC * seg.frac * sweep - GAP)
              const off = -CIRC * seg.start * sweep
              return (
                <circle
                  key={seg.key}
                  cx={SIZE/2} cy={SIZE/2} r={R}
                  fill="none"
                  stroke={COLORS[seg.key]}
                  strokeWidth={isHov ? 30 : 22}
                  strokeDasharray={`${len} ${CIRC - len}`}
                  strokeDashoffset={off}
                  strokeLinecap="butt"
                  opacity={isDim ? 0.35 : 1}
                  onMouseEnter={() => setHovered(seg.key)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ transition: 'stroke-width 0.2s ease, opacity 0.2s ease', cursor: 'pointer',
                    filter: isHov ? `drop-shadow(0 0 8px ${COLORS[seg.key]}90)` : 'none' }}
                />
              )
            })}
          </svg>
          {/* centro vivo */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
            {hovered ? (
              <>
                <div style={{ fontSize: 10, color: COLORS[hovered], fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 2 }}>
                  {LABELS[hovered].toUpperCase()}
                </div>
                <div style={{ fontSize: 26, fontFamily: "'Bebas Neue', Impact, sans-serif", color: COLORS[hovered], lineHeight: 1 }}>
                  {allocation[hovered]}%
                </div>
                {capital > 0 && (
                  <div style={{ fontSize: 12, color: '#e8e9f0', fontFamily: 'monospace', marginTop: 3 }}>
                    {fmt(hoveredAmount, currency)}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 24, fontFamily: "'Bebas Neue', Impact, sans-serif", lineHeight: 1, color: metrics.expectedReturn > 0 ? '#1D9E75' : '#f87171' }}>
                  {metrics.expectedReturn > 0 ? '+' : ''}{metrics.expectedReturn.toFixed(1)}%
                </div>
                <div style={{ fontSize: 9, color: '#7a7f9a', fontFamily: 'monospace', marginTop: 2 }}>RET. ESP.</div>
                {capital > 0 && (
                  <div style={{ fontSize: 11, color: '#d4af37', fontFamily: 'monospace', marginTop: 5 }}>
                    {fmt(animCapital, currency)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Leyenda */}
        <div style={{ flex: 1, minWidth: 160 }}>
          {keys.map(k => {
            const amount = capital > 0 ? capital * allocation[k] / 100 : 0
            const isHov = hovered === k
            return (
              <div key={k}
                onMouseEnter={() => setHovered(k)}
                onMouseLeave={() => setHovered(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer',
                  opacity: hovered !== null && !isHov ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[k], flexShrink: 0,
                  boxShadow: isHov ? `0 0 8px ${COLORS[k]}` : 'none', transition: 'box-shadow 0.2s' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#e8e9f0' }}>{LABELS[k]}</div>
                  {capital > 0 && (
                    <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: 'monospace' }}>
                      {fmt(amount, currency)}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 18, fontFamily: "'Bebas Neue', Impact, sans-serif", color: COLORS[k], minWidth: 42, textAlign: 'right' }}>
                  {allocation[k]}%
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1a1d2e', fontSize: 11, color: '#7a7f9a', fontFamily: 'monospace' }}>
            Sharpe: <span style={{ color: '#e8e9f0' }}>{metrics.sharpeRatio.toFixed(2)}</span>
            &nbsp;·&nbsp;
            Vol: <span style={{ color: '#e8e9f0' }}>{metrics.annualVolatility.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
