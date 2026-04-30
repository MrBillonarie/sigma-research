import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const alt         = 'Sigma Research — Inteligencia Cuantitativa'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '72px 80px',
        }}
      >
        {/* Top: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48,
            border: '2px solid #d4af37',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#111111',
          }}>
            <span style={{ fontSize: 24, fontWeight: 'bold', color: '#d4af37' }}>S</span>
          </div>
          <span style={{ fontSize: 15, letterSpacing: '0.3em', color: '#e5e5e5' }}>
            SIGMA RESEARCH
          </span>
          <span style={{ fontSize: 11, letterSpacing: '0.2em', color: '#d4af37', marginLeft: 8, background: '#1a1500', border: '1px solid #d4af37', padding: '3px 10px' }}>
            QUANT
          </span>
        </div>

        {/* Center: Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, justifyContent: 'center' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.3em', color: '#d4af37' }}>
            {'// INTELIGENCIA CUANTITATIVA'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <span style={{ fontSize: 80, fontWeight: 'bold', lineHeight: 1, color: '#e5e5e5' }}>
              HERRAMIENTAS
            </span>
            <span style={{ fontSize: 80, fontWeight: 'bold', lineHeight: 1, color: '#d4af37' }}>
              DE GRADO
            </span>
            <span style={{ fontSize: 80, fontWeight: 'bold', lineHeight: 1, color: '#e5e5e5' }}>
              INSTITUCIONAL
            </span>
          </div>
          <div style={{ fontSize: 15, color: '#666666', marginTop: 12 }}>
            Senales ML en vivo · Calculadora FIRE · Monte Carlo · Modelos cuantitativos
          </div>
        </div>

        {/* Bottom: Feature tags */}
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          {['HUD EN VIVO', 'FIRE PLANNER', 'MOTOR ML', 'PORTAFOLIO', 'REPORTES'].map(label => (
            <div key={label} style={{
              flex: 1,
              background: '#111111',
              border: '1px solid #2a2000',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: 10, letterSpacing: '0.15em', color: '#d4af37' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
