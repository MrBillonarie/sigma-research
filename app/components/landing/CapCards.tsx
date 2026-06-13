'use client'
import { useState } from 'react'

const S   = '#0b0d14'
const B   = '#1a1d2e'
const T   = '#e8e9f0'
const D   = '#7a7f9a'

const CAPS = [
  { id:'01', name:'SIGNAL HUD',        col:'#34d399', desc:'Señales del Motor de Decisión en tiempo real. Régimen HMM, bias de mercado, confianza por clase de activo.' },
  { id:'02', name:'TRADE JOURNAL',     col:'#f59e0b', desc:'CSV Binance Futures + entrada manual. Sharpe, Max DD, Profit Factor. Export PDF y CSV.' },
  { id:'03', name:'PORTFOLIO',         col:'#3b82f6', desc:'IBKR, Binance Spot/Futures, Fintual, Santander, Cash. Consolidado USD/CLP en tiempo real.' },
  { id:'04', name:'FIRE + MONTECARLO', col:'#d4af37', desc:'Regla del 4%. 2.000 trayectorias GBM. Percentiles P10/P50/P90. Proyección a 20 años.' },
  { id:'05', name:'MOTOR CUANTITATIVO',col:'#a78bfa', desc:'4 modelos ML: HMM-01, XGB-03, STAT-05, GARCH-02. Score 0–100, EV neto, Kelly fraction.' },
  { id:'06', name:'COMPARADORES',      col:'#f87171', desc:'ETFs globales, Fondos Mutuos CMF, Renta Fija DAP, LP DeFi PancakeSwap v3.' },
]

export default function CapCards() {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className="landing-cap-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: B }}>
      {CAPS.map(c => {
        const isHov = hovered === c.id
        return (
          <div
            key={c.id}
            onMouseEnter={() => setHovered(c.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: isHov ? `${c.col}08` : S,
              padding: '36px 30px',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'default',
              transform: isHov ? 'translateY(-3px)' : 'translateY(0)',
              transition: 'transform 0.25s ease, background 0.25s ease, box-shadow 0.25s ease',
              boxShadow: isHov ? `0 8px 32px ${c.col}18, inset 0 0 0 1px ${c.col}30` : 'none',
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: isHov ? c.col : c.col,
              boxShadow: isHov ? `0 0 16px ${c.col}80` : 'none',
              transition: 'box-shadow 0.25s ease',
            }} />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none',
              background: isHov ? `radial-gradient(ellipse 60% 40% at 50% 0%, ${c.col}06 0%, transparent 70%)` : 'transparent',
              transition: 'background 0.3s ease',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, position: 'relative' }}>
              <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 34, color: isHov ? c.col : T, letterSpacing: '0.03em', transition: 'color 0.25s ease' }}>
                {c.name}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: c.col, background: `${c.col}15`, border: `1px solid ${c.col}${isHov ? '60' : '40'}`, padding: '2px 8px', flexShrink: 0, marginLeft: 8, transition: 'border-color 0.25s ease' }}>
                {c.id}
              </span>
            </div>
            <p style={{ fontFamily: 'monospace', fontSize: 11, color: D, lineHeight: 1.8, margin: 0, position: 'relative' }}>{c.desc}</p>
          </div>
        )
      })}
    </div>
  )
}
