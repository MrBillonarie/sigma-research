'use client'
import { useEffect, useRef, useState } from 'react'

const G   = '#39e2e6'
const BG  = '#080a0f'
const B   = '#202634'
const T   = '#e8e9f0'
const DIM = '#5a6080'
const M   = '#4a5068'

const MODELS = [
  { tag: 'HMM-01',   name: 'Regime Detector', metric: '91.2%', unit: 'accuracy', bar: 91.2, barColor: '#34d399', live: true  },
  { tag: 'XGB-03',   name: 'Momentum Score',  metric: '2.41',  unit: 'Sharpe',   bar: 80.3, barColor: G,         live: true  },
  { tag: 'STAT-05',  name: 'Pairs Trading',   metric: '1.87',  unit: 'Sharpe',   bar: 62.3, barColor: '#60a5fa', live: true  },
  { tag: 'GARCH-02', name: 'Vol Forecaster',  metric: '0.031', unit: 'MAE',      bar: 94.0, barColor: '#a78bfa', live: true  },
  { tag: 'NLP-04',   name: 'Sentiment Alpha', metric: '—',     unit: 'revisión', bar: 0,    barColor: M,         live: false },
]

export default function ModelBars() {
  const ref    = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setActive(true); obs.disconnect() } }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ background: BG, border: `1px solid ${B}` }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${B}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.2em', color: M }}>MODELOS ACTIVOS</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399' }} />
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#34d399', letterSpacing: '0.15em' }}>LIVE</span>
        </span>
      </div>
      {MODELS.map((m, i) => (
        <div key={m.tag} style={{ padding: '18px 20px', borderBottom: i < MODELS.length - 1 ? `1px solid ${B}` : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.live ? '#34d399' : '#fbbf24', boxShadow: m.live ? '0 0 8px #34d399' : 'none', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: G, letterSpacing: '0.1em' }}>{m.tag}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: T, marginTop: 2 }}>{m.name}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 22, color: m.live ? T : M, lineHeight: 1 }}>{m.metric}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 9, color: DIM, letterSpacing: '0.08em' }}>{m.unit}</div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height: 3, background: B, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: active ? `${m.bar}%` : '0%',
              background: `linear-gradient(90deg, ${m.barColor}80, ${m.barColor})`,
              borderRadius: 2,
              boxShadow: m.live ? `0 0 8px ${m.barColor}60` : 'none',
              transition: `width 1.2s cubic-bezier(0.4,0,0.2,1) ${i * 120}ms`,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}
