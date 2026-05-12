'use client'
import { useEffect, useState, useRef } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Detectores
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isAndroid() {
  return /android/i.test(navigator.userAgent)
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
}

export default function PwaRegister() {
  const [showBanner, setShowBanner] = useState(false)
  const [showGuide,  setShowGuide]  = useState(false)
  const [platform,   setPlatform]   = useState<'ios' | 'android' | null>(null)
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Registrar service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Si ya está instalada, no hacer nada
    if (isStandalone()) return

    // Si ya descartó en esta sesión, no molestar
    if (sessionStorage.getItem('pwa_dismissed')) return

    const ios     = isIOS()
    const android = isAndroid()
    if (!ios && !android) return  // Solo mobile

    setPlatform(ios ? 'ios' : 'android')

    // Escuchar prompt nativo en Android
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => { e.preventDefault(); promptRef.current = e }
    window.addEventListener('beforeinstallprompt', handler)

    // Mostrar banner a los 10s
    const timer = setTimeout(() => setShowBanner(true), 10_000)

    // Escuchar evento del botón del sidebar
    const guideHandler = () => { setShowBanner(false); setShowGuide(true) }
    window.addEventListener('sigma-pwa-show-guide', guideHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('sigma-pwa-show-guide', guideHandler)
      clearTimeout(timer)
    }
  }, [])

  async function handleInstall() {
    if (platform === 'android' && promptRef.current) {
      // Android con prompt nativo disponible
      await promptRef.current.prompt()
      const { outcome } = await promptRef.current.userChoice
      if (outcome === 'accepted') { setShowBanner(false); return }
    } else {
      // iOS o Android sin prompt → mostrar guía manual
      setShowBanner(false)
      setShowGuide(true)
    }
  }

  function handleDismiss() {
    sessionStorage.setItem('pwa_dismissed', '1')
    setShowBanner(false)
    setShowGuide(false)
  }

  return (
    <>
      {/* ── Banner inferior ── */}
      {showBanner && (
        <div style={{
          position: 'fixed', bottom: 72, left: 12, right: 12, zIndex: 9999,
          background: '#0b0d14', border: '1px solid #d4af3760',
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 32px rgba(0,0,0,0.7)',
        }}>
          <div style={{
            width: 38, height: 38, border: '2px solid #d4af37', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#d4af37', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>Σ</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#e8e9f0', letterSpacing: '0.08em' }}>
              INSTALAR SIGMA
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#7a7f9a', marginTop: 2 }}>
              {platform === 'ios' ? 'Agregar a pantalla de inicio' : 'Instalar como app'}
            </div>
          </div>
          <button onClick={handleDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a5f7a', fontFamily: 'monospace', fontSize: 11, padding: '4px 8px', flexShrink: 0 }}>✕</button>
          <button onClick={handleInstall} style={{ background: '#d4af37', border: 'none', cursor: 'pointer', color: '#04050a', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em', padding: '8px 14px', flexShrink: 0 }}>
            {platform === 'ios' ? 'VER CÓMO' : 'INSTALAR'}
          </button>
        </div>
      )}

      {/* ── Guía iOS ── */}
      {showGuide && platform === 'ios' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end',
        }} onClick={handleDismiss}>
          <div style={{ width: '100%', background: '#0b0d14', border: '1px solid #1a1d2e', padding: '28px 24px 40px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#d4af37', letterSpacing: '0.2em', marginBottom: 20 }}>
              // INSTALAR EN IPHONE
            </div>
            {[
              { n: '1', text: 'Toca el ícono de compartir', icon: '⬆️', sub: 'Barra inferior de Safari' },
              { n: '2', text: 'Selecciona "Agregar a pantalla de inicio"', icon: '➕', sub: 'Desliza hacia abajo en el menú' },
              { n: '3', text: 'Toca "Agregar"', icon: '✓', sub: 'El ícono Σ aparecerá en tu home' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, border: '1px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'monospace', fontSize: 12, color: '#d4af37' }}>{s.n}</div>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#e8e9f0' }}>{s.icon} {s.text}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#7a7f9a', marginTop: 3 }}>{s.sub}</div>
                </div>
              </div>
            ))}
            <button onClick={handleDismiss} style={{ width: '100%', background: '#d4af37', border: 'none', cursor: 'pointer', color: '#04050a', fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.15em', padding: '13px', marginTop: 8 }}>
              ENTENDIDO
            </button>
          </div>
        </div>
      )}

      {/* ── Guía Android sin prompt ── */}
      {showGuide && platform === 'android' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end',
        }} onClick={handleDismiss}>
          <div style={{ width: '100%', background: '#0b0d14', border: '1px solid #1a1d2e', padding: '28px 24px 40px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#d4af37', letterSpacing: '0.2em', marginBottom: 20 }}>
              // INSTALAR EN ANDROID
            </div>
            {[
              { n: '1', text: 'Toca los 3 puntos (⋮)', icon: '⋮', sub: 'Esquina superior derecha de Chrome' },
              { n: '2', text: 'Selecciona "Agregar a pantalla inicio"', icon: '➕', sub: 'O "Instalar aplicación"' },
              { n: '3', text: 'Confirma tocando "Instalar"', icon: '✓', sub: 'El ícono Σ aparecerá en tu home' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, border: '1px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'monospace', fontSize: 12, color: '#d4af37' }}>{s.n}</div>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#e8e9f0' }}>{s.icon} {s.text}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#7a7f9a', marginTop: 3 }}>{s.sub}</div>
                </div>
              </div>
            ))}
            <button onClick={handleDismiss} style={{ width: '100%', background: '#d4af37', border: 'none', cursor: 'pointer', color: '#04050a', fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.15em', padding: '13px', marginTop: 8 }}>
              ENTENDIDO
            </button>
          </div>
        </div>
      )}
    </>
  )
}
