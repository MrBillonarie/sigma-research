'use client'
import type { FlowSignal } from '@/types/decision-engine'

interface Props {
  signals:   FlowSignal[]
  flowScore: number
}

function TrendBadge({ trend }: { trend: FlowSignal['trend'] }) {
  const cfg = {
    entrando: { label: '▲ ENTRANDO', color: '#1D9E75', bg: 'rgba(29,158,117,0.12)' },
    saliendo: { label: '▼ SALIENDO', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
    neutro:   { label: '→ NEUTRO',  color: '#7a7f9a', bg: 'rgba(122,127,154,0.12)' },
  }[trend]
  return (
    <span style={{
      fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
      color: cfg.color, background: cfg.bg,
      borderRadius: 4, padding: '2px 6px',
    }}>
      {cfg.label}
    </span>
  )
}

export default function FlowIndicator({ signals, flowScore }: Props) {
  const scoreColor = flowScore > 60 ? '#1D9E75' : flowScore > 40 ? '#d4af37' : '#f87171'

  return (
    <div style={{
      background: '#0b0d14', border: '1px solid #1a1d2e',
      borderRadius: 10, padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{
          margin: 0, fontSize: 12, color: '#7a7f9a',
          fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase',
        }}>
          FLUJO DE CAPITAL CROSS-MARKET
        </h3>
        <div style={{
          fontSize: 12, fontFamily: 'monospace',
          color: scoreColor, fontWeight: 700,
        }}>
          Score global: {flowScore}/100
        </div>
      </div>

      {/* Score global bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          height: 6, background: '#1a1d2e', borderRadius: 3, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${flowScore}%`,
            background: `linear-gradient(90deg, #378ADD, ${scoreColor})`,
            borderRadius: 3, transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 4, fontSize: 10, color: '#3a3f55', fontFamily: 'monospace',
        }}>
          <span>BEAR</span><span>NEUTRO</span><span>BULL</span>
        </div>
      </div>

      {/* Señales por mercado */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {signals.map(s => (
          <div key={s.market}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: s.color,
                }} />
                <span style={{ fontSize: 12, color: '#e8e9f0' }}>{s.market}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#7a7f9a', fontFamily: 'monospace' }}>
                  {s.inflow.toFixed(0)}% / {s.outflow.toFixed(0)}%
                </span>
                <TrendBadge trend={s.trend} />
              </div>
            </div>
            {/* Barra split inflow/outflow */}
            <div style={{
              height: 5, background: '#1a1d2e', borderRadius: 3,
              overflow: 'hidden', display: 'flex',
            }}>
              <div style={{
                height: '100%', width: `${s.inflow}%`,
                background: s.color, transition: 'width 0.5s ease',
              }} />
              <div style={{
                height: '100%', flex: 1,
                background: '#f87171', opacity: 0.4,
              }} />
            </div>
          </div>
        ))}
      </div>

      <p style={{
        margin: '14px 0 0', fontSize: 10, color: '#3a3f55',
        fontFamily: 'monospace', lineHeight: 1.5,
      }}>
        * Flujo calculado desde momentum de retornos 1m vs 3m por clase de activo.
      </p>
    </div>
  )
}
