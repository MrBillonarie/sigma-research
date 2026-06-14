'use client'
import { useEffect, useState } from 'react'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export default function PwaRegister() {
  const [showGuide, setShowGuide] = useState(false)
  const [ios,       setIos]       = useState(false)

  useEffect(() => {
    // Registrar SW solo en producción
    const localhost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    if ('serviceWorker' in navigator && !localhost) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    setIos(isIOS())

    // El sidebar dispara este evento cuando no hay prompt nativo
    const handler = () => setShowGuide(true)
    window.addEventListener('sigma-pwa-show-guide', handler)
    return () => window.removeEventListener('sigma-pwa-show-guide', handler)
  }, [])

  const steps = ios
    ? [
        { n: '1', icon: '⬆️', text: 'Toca el ícono compartir',                   sub: 'Barra inferior de Safari' },
        { n: '2', icon: '➕', text: 'Toca "Agregar a pantalla de inicio"',        sub: 'Desliza hacia abajo en el menú' },
        { n: '3', icon: '✓',  text: 'Toca "Agregar"',                             sub: 'El ícono Σ aparecerá en tu inicio' },
      ]
    : [
        { n: '1', icon: '⋮',  text: 'Toca los 3 puntos arriba a la derecha',      sub: 'Menú de Chrome' },
        { n: '2', icon: '➕', text: 'Toca "Agregar a pantalla de inicio"',         sub: 'O "Instalar aplicación"' },
        { n: '3', icon: '✓',  text: 'Confirma tocando "Instalar"',                 sub: 'El ícono Σ aparecerá en tu inicio' },
      ]

  if (!showGuide) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end' }}
      onClick={() => setShowGuide(false)}
    >
      <div
        style={{ width: '100%', background: '#0b0d14', borderTop: '1px solid #2a2d3e', padding: '28px 24px 48px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{ width: 42, height: 42, border: '2px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#d4af37', fontSize: 24, fontWeight: 700, lineHeight: 1 }}>Σ</span>
          </div>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#e8e9f0', letterSpacing: '0.08em' }}>INSTALAR SIGMA RESEARCH</div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#7a7f9a', marginTop: 3 }}>
              {ios ? 'Instrucciones para Safari / iPhone' : 'Instrucciones para Chrome / Android'}
            </div>
          </div>
          <button onClick={() => setShowGuide(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#5a5f7a', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Pasos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {steps.map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, border: '1px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'monospace', fontSize: 12, color: '#d4af37' }}>
                {s.n}
              </div>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#e8e9f0' }}>{s.icon}  {s.text}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#7a7f9a', marginTop: 4 }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowGuide(false)}
          style={{ width: '100%', background: '#d4af37', border: 'none', cursor: 'pointer', color: '#04050a', fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.15em', padding: '14px', fontWeight: 700 }}
        >
          ENTENDIDO
        </button>
      </div>
    </div>
  )
}
