'use client'
import { useEffect } from 'react'
import { C } from '@/app/lib/constants'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error)
  }, [error])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', color: C.red, marginBottom: 16 }}>
          {'// ERROR CRÍTICO'}
        </div>
        <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 72, color: C.red, lineHeight: 1, marginBottom: 16, opacity: 0.8 }}>
          ERR
        </div>
        <h2 style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 32, color: C.text, marginBottom: 12 }}>
          FALLO EN EL MÓDULO
        </h2>
        <p style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, lineHeight: 1.7, marginBottom: 32 }}>
          Se produjo un error inesperado en esta sección.<br />
          Puedes reintentar o volver al dashboard.
        </p>
        {error.digest && (
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, padding: '8px 12px', marginBottom: 24, textAlign: 'left' }}>
            digest: {error.digest}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{ background: C.gold, color: C.bg, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', padding: '12px 28px', border: 'none', cursor: 'pointer' }}
          >
            REINTENTAR
          </button>
          <a
            href="/home"
            style={{ border: `1px solid ${C.border}`, color: C.dimText, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', padding: '12px 28px', textDecoration: 'none', display: 'inline-block' }}
          >
            IR AL HOME
          </a>
        </div>
      </div>
    </div>
  )
}
