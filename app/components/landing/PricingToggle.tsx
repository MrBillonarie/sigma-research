'use client'
import { useState } from 'react'
import Link from 'next/link'

const G   = '#39e2e6'
const BG  = '#080a0f'
const S   = '#0b0d14'
const B   = '#202634'
const D   = '#7a7f9a'
const DIM = '#5a6080'
const M   = '#4a5068'

const PLANS = [
  {
    tier: 'ACCESO LIBRE', priceM: '$0', priceA: '$0', period: 'siempre gratis',
    accent: '#2a2d3e', textAccent: D, fill: false, badge: null, cta: 'ABRIR CUENTA', href: '/registro',
    items: ['Dashboard completo','Journal de trades','Calculadora FIRE','Monte Carlo','HUD señales','Comparadores'],
  },
  {
    tier: 'PRO', priceM: '$29', priceA: '$23', period: 'USD / mes',
    accent: G, textAccent: G, fill: true, badge: '★ MÁS POPULAR', cta: 'ACTIVAR PRO', href: '/registro',
    items: ['Todo del plan libre','Reportes PDF mensuales','Señales activas PRO.MACD','Equity curves actualizadas','Soporte prioritario'],
  },
  {
    tier: 'INSTITUCIONAL', priceM: 'Custom', priceA: 'Custom', period: 'cotizar',
    accent: '#3b82f6', textAccent: '#60a5fa', fill: false, badge: null, cta: 'CONTACTAR', href: '/contacto',
    items: ['Todo del plan PRO','API acceso completo','Modelos a medida','White label disponible','SLA garantizado'],
  },
]

export default function PricingToggle() {
  const [annual, setAnnual] = useState(false)

  return (
    <div>
      {/* Toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginBottom: 48 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: !annual ? G : DIM, letterSpacing: '0.15em', transition: 'color 0.2s' }}>MENSUAL</span>
        <button
          onClick={() => setAnnual(v => !v)}
          style={{
            width: 44, height: 24, borderRadius: 12, background: annual ? G : B,
            border: `1px solid ${annual ? G : '#2a2d3e'}`,
            position: 'relative', cursor: 'pointer', transition: 'background 0.25s, border-color 0.25s',
          }}
          aria-label="Toggle facturación anual"
        >
          <span style={{
            position: 'absolute', top: 3, left: annual ? 23 : 3,
            width: 16, height: 16, borderRadius: '50%',
            background: annual ? BG : DIM,
            transition: 'left 0.25s ease, background 0.25s',
          }} />
        </button>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: annual ? G : DIM, letterSpacing: '0.15em', transition: 'color 0.2s' }}>
          ANUAL
          <span style={{
            marginLeft: 8, fontSize: 8,
            background: `${G}20`, color: G, border: `1px solid ${G}40`,
            padding: '1px 6px', borderRadius: 2,
            opacity: annual ? 1 : 0.5, transition: 'opacity 0.2s',
          }}>
            −20%
          </span>
        </span>
      </div>

      {/* Cards */}
      <div className="landing-plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: B }}>
        {PLANS.map(p => {
          const price = annual ? p.priceA : p.priceM
          return (
            <div key={p.tier} style={{
              background: S, padding: '44px 32px', position: 'relative', display: 'flex', flexDirection: 'column',
              outline: p.fill ? `2px solid ${p.accent}` : 'none', outlineOffset: -2,
            }}>
              {p.badge && (
                <div style={{ position: 'absolute', top: -1, left: 24, fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.18em', background: p.accent, color: BG, padding: '4px 12px' }}>
                  {p.badge}
                </div>
              )}
              {p.fill && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${G},#f0cc5a)` }} />}

              <div style={{ marginBottom: 28 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.25em', color: p.textAccent, marginBottom: 14 }}>{p.tier}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 60, color: p.textAccent, lineHeight: 1, transition: 'all 0.3s' }}>
                    {price}
                  </span>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: M }}>{p.period}</span>
                    {annual && p.priceA !== p.priceM && p.priceA !== 'Custom' && (
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#34d399', letterSpacing: '0.08em', marginTop: 2 }}>facturado anualmente</div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                {p.items.map(item => (
                  <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: p.textAccent, fontFamily: 'monospace', fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: D, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>

              <Link href={p.href} style={{
                display: 'block', textAlign: 'center', padding: '14px',
                fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textDecoration: 'none',
                background: p.fill ? `linear-gradient(135deg,${p.accent},#2ab8bd)` : 'transparent',
                color: p.fill ? BG : p.textAccent,
                border: `1px solid ${p.accent}`,
                boxShadow: p.fill ? `0 0 24px rgba(57,226,230,0.2)` : 'none',
              }}>
                {p.cta}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
