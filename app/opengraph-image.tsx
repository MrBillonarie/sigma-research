import { ImageResponse } from 'next/og'

export const runtime     = 'nodejs'
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
          fontFamily: 'monospace',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid background pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(212,175,55,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        {/* Gold radial glow */}
        <div style={{
          position: 'absolute',
          top: -200, right: -100,
          width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
        }} />

        {/* Top: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1 }}>
          <div style={{
            width: 44, height: 44,
            border: '2px solid #d4af37',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 22, fontWeight: 'bold', color: '#d4af37', fontFamily: 'serif' }}>Σ</span>
          </div>
          <span style={{ fontSize: 14, letterSpacing: '0.35em', color: '#e5e5e5', textTransform: 'uppercase' }}>
            SIGMA RESEARCH
          </span>
        </div>

        {/* Center: Main headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, zIndex: 1, flex: 1, justifyContent: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.3em', color: '#d4af37', textTransform: 'uppercase' }}>
            {'// INTELIGENCIA CUANTITATIVA'}
          </div>
          <div style={{ fontSize: 72, fontWeight: 'bold', lineHeight: 0.93, letterSpacing: '0.02em', color: '#e5e5e5', fontFamily: 'sans-serif' }}>
            HERRAMIENTAS
          </div>
          <div style={{ fontSize: 72, fontWeight: 'bold', lineHeight: 0.93, letterSpacing: '0.02em', color: '#d4af37', fontFamily: 'sans-serif' }}>
            DE GRADO
          </div>
          <div style={{ fontSize: 72, fontWeight: 'bold', lineHeight: 0.93, letterSpacing: '0.02em', color: '#e5e5e5', fontFamily: 'sans-serif' }}>
            INSTITUCIONAL
          </div>
          <div style={{ fontSize: 14, color: '#888888', marginTop: 8, maxWidth: 560, lineHeight: 1.6 }}>
            Señales ML en vivo · Calculadora FIRE · Monte Carlo · Modelos cuantitativos para traders independientes
          </div>
        </div>

        {/* Bottom: Features strip */}
        <div style={{ display: 'flex', gap: 1, zIndex: 1, width: '100%' }}>
          {[
            { icon: '⚡', label: 'HUD EN VIVO' },
            { icon: '◎', label: 'FIRE PLANNER' },
            { icon: '∑',  label: 'MOTOR ML' },
            { icon: '◈', label: 'PORTAFOLIO' },
            { icon: '▣', label: 'REPORTES' },
          ].map(f => (
            <div key={f.label} style={{
              flex: 1,
              background: 'rgba(212,175,55,0.06)',
              border: '1px solid rgba(212,175,55,0.2)',
              padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <span style={{ fontSize: 16 }}>{f.icon}</span>
              <span style={{ fontSize: 10, letterSpacing: '0.2em', color: '#d4af37' }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
