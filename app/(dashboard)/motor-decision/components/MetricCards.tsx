'use client'
import { useEffect, useState } from 'react'
import type { PortfolioMetrics } from '@/types/decision-engine'

interface Props {
  metrics:   PortfolioMetrics
  flowScore: number
  buyCount:  number
  sellCount: number
  holdCount: number
}

// ─── F: Animated counter ──────────────────────────────────────────────────────
function useCountUp(target: number, duration = 800): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const id = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(id) }
      else setVal(start)
    }, 16)
    return () => clearInterval(id)
  }, [target, duration])
  return val
}

// ─── D: Gauge tipo Fear & Greed con zonas y aguja ────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const animated = useCountUp(score)

  const cx = 110, cy = 100          // centro del semicírculo
  const Ro = 88,  Ri = 60           // radio exterior e interior
  const W  = 220, H  = 130

  // Convierte 0-100 → ángulo (π=izq → 0=der pasando por arriba)
  const a = (pct: number) => Math.PI * (1 - pct / 100)

  // Punto en coordenadas SVG (y-axis down → negamos sin)
  const px = (angle: number, R: number) => cx + R * Math.cos(angle)
  const py = (angle: number, R: number) => cy - R * Math.sin(angle)

  // Path de sector de donut entre dos porcentajes
  function sector(from: number, to: number) {
    const [a1, a2] = [a(from), a(to)]
    const L = (to - from) > 50 ? 1 : 0
    const [ox1,oy1] = [px(a1,Ro), py(a1,Ro)]
    const [ox2,oy2] = [px(a2,Ro), py(a2,Ro)]
    const [ix1,iy1] = [px(a1,Ri), py(a1,Ri)]
    const [ix2,iy2] = [px(a2,Ri), py(a2,Ri)]
    // outer: sweep=1 (CW-visual → va por arriba izq→der)
    // inner: sweep=0 (CCW-visual → va por arriba der→izq)
    return `M ${ox1} ${oy1} A ${Ro} ${Ro} 0 ${L} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${Ri} ${Ri} 0 ${L} 0 ${ix1} ${iy1} Z`
  }

  const ZONES = [
    { from: 0,  to: 20,  fill: '#ef4444', label: 'BAJISTA\nEXTREMO' },
    { from: 20, to: 40,  fill: '#f97316', label: 'BAJISTA'            },
    { from: 40, to: 60,  fill: '#6b7280', label: 'NEUTRO'             },
    { from: 60, to: 80,  fill: '#22c55e', label: 'ALCISTA'            },
    { from: 80, to: 100, fill: '#1D9E75', label: 'ALCISTA\nEXTREMO'  },
  ]

  const needleAngle  = a(animated)
  const needleTipX   = px(needleAngle, Ro - 10)
  const needleTipY   = py(needleAngle, Ro - 10)

  const activeZone   = ZONES.find(z => animated >= z.from && animated <= z.to)
  const scoreColor   = activeZone?.fill ?? '#d4af37'
  const label        = animated >= 70 ? 'ALCISTA' : animated >= 45 ? 'NEUTRO' : 'BAJISTA'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {/* Fondo gris del arco */}
      <path d={sector(0, 100)} fill="#1a1d2e" />

      {/* Zonas de color */}
      {ZONES.map(z => (
        <path
          key={z.from}
          d={sector(z.from + 0.8, z.to - 0.8)}   // pequeño gap entre zonas
          fill={z.fill}
          opacity={animated >= z.from && animated < z.to ? 1 : 0.35}
        />
      ))}

      {/* Separadores entre zonas */}
      {[20, 40, 60, 80].map(t => (
        <line key={t}
          x1={px(a(t), Ri - 1)} y1={py(a(t), Ri - 1)}
          x2={px(a(t), Ro + 1)} y2={py(a(t), Ro + 1)}
          stroke="#04050a" strokeWidth={2}
        />
      ))}

      {/* Ticks y números en 0 / 25 / 50 / 75 / 100 */}
      {[0, 25, 50, 75, 100].map(t => {
        const angle = a(t)
        const tr = (Ro + Ri) / 2
        const lr = Ri - 14
        return (
          <g key={t}>
            <circle cx={px(angle, tr)} cy={py(angle, tr)} r={2.5} fill="#04050a" />
            <text x={px(angle, lr)} y={py(angle, lr)}
              textAnchor="middle" dominantBaseline="middle"
              fill="#3a3f55" style={{ fontSize: '9px', fontFamily: 'monospace' }}>
              {t}
            </text>
          </g>
        )
      })}

      {/* Aguja */}
      <line x1={cx} y1={cy} x2={needleTipX} y2={needleTipY}
        stroke="#e8e9f0" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill="#e8e9f0" />
      <circle cx={cx} cy={cy} r={3} fill="#04050a" />

      {/* Score centrado bajo la aguja */}
      <text x={cx} y={cy + 22} textAnchor="middle"
        fill={scoreColor}
        style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '28px', letterSpacing: '1px' }}>
        {Math.round(animated)}
      </text>
      <text x={cx} y={cy + 36} textAnchor="middle"
        fill="#3a3f55"
        style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.15em' }}>
        {label}
      </text>
    </svg>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────
function Card({
  label, value, sub, color, icon, gauge,
}: { label: string; value: string; sub?: string; color: string; icon: string; gauge?: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      background: '#0b0d14',
      border: `1px solid #1a1d2e`,
      borderTop: `2px solid ${color}30`,
      borderRadius: 10, padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 10, color: '#7a7f9a', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      {gauge ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          {gauge}
          {sub && <div style={{ fontSize: 11, color: '#3a3f55', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{sub}</div>}
        </div>
      ) : (
        <>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, letterSpacing: 1, color }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 11, color: '#7a7f9a', marginTop: 4, fontFamily: 'monospace' }}>{sub}</div>}
        </>
      )}
    </div>
  )
}

export default function MetricCards({ metrics, flowScore, buyCount, sellCount, holdCount }: Props) {
  const ret    = metrics.expectedReturn
  const vol    = metrics.annualVolatility
  const sharpe = metrics.sharpeRatio

  const retColor    = ret    > 8  ? '#1D9E75' : ret    > 4  ? '#d4af37' : '#f87171'
  const sharpeColor = sharpe > 1  ? '#1D9E75' : sharpe > 0.5 ? '#d4af37' : '#f87171'
  const flowColor   = flowScore > 60 ? '#1D9E75' : flowScore > 40 ? '#d4af37' : '#f87171'

  // F: animated number values
  const animRet    = useCountUp(Math.abs(ret),    900)
  const animVol    = useCountUp(vol,              900)
  const animSharpe = useCountUp(sharpe * 100,     900) // ×100 para el contador, luego ÷100

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <Card
        icon="📈" label="Retorno Esperado"
        value={`${ret > 0 ? '+' : '-'}${animRet.toFixed(1)}%`}
        sub="Retorno anual proyectado"
        color={retColor}
      />
      <Card
        icon="〰️" label="Volatilidad Anual"
        value={`${animVol.toFixed(1)}%`}
        sub={`DD máx: ${metrics.maxDrawdown.toFixed(1)}%`}
        color="#378ADD"
      />
      <Card
        icon="⚖️" label="Sharpe Ratio"
        value={(animSharpe / 100).toFixed(2)}
        sub="Mayor = mejor riesgo/retorno"
        color={sharpeColor}
      />
      {/* D: Gauge radial para flow score */}
      <Card
        icon="🌊" label="Score Flujo"
        value=""
        color={flowColor}
        gauge={
          <ScoreGauge score={flowScore} color={flowColor} />
        }
        sub={`▲ ${buyCount}  →  ${holdCount}  ▼ ${sellCount}`}
      />
    </div>
  )
}
