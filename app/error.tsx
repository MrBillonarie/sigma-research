'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Sigma Error]', error)
  }, [error])

  return (
    <main className="min-h-screen bg-bg bg-grid-pattern bg-grid flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-radial-gold pointer-events-none" />

      <div className="relative text-center flex flex-col items-center gap-8 max-w-xl">
        <div className="section-label text-red-400">{'// ERROR CRÍTICO'}</div>

        <h1 className="display-heading text-[10rem] leading-none text-red-400 select-none opacity-80">
          ERR
        </h1>

        <div>
          <h2 className="display-heading text-4xl text-text mb-3">FALLO EN EL SISTEMA</h2>
          <p className="terminal-text text-text-dim leading-relaxed">
            Se ha producido un error inesperado. Puedes intentar recargar
            <br />
            o volver al inicio.
          </p>
        </div>

        {/* Terminal con mensaje de error */}
        <div className="w-full glass-card p-4 text-left">
          <div className="terminal-text text-xs space-y-1">
            <p><span className="text-red-400">ERROR</span> <span className="text-text-dim">{error.message || 'Unknown error'}</span></p>
            {error.digest && (
              <p><span className="text-gold">digest:</span> <span className="text-text-dim">{error.digest}</span></p>
            )}
            <p><span className="text-gold">$</span> <span className="animate-blink">_</span></p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={reset}
            className="bg-gold text-bg section-label px-8 py-3 hover:bg-gold-glow transition-colors duration-200"
          >
            REINTENTAR
          </button>
          <Link
            href="/"
            className="border border-border text-text-dim section-label px-8 py-3 hover:border-gold hover:text-gold transition-colors duration-200"
          >
            VOLVER AL INICIO
          </Link>
        </div>
      </div>
    </main>
  )
}
