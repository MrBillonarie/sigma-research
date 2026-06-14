import Link from 'next/link'

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-bg bg-grid-pattern bg-grid flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-radial-gold pointer-events-none" />

      <div className="relative text-center flex flex-col items-center gap-8 max-w-xl">
        <div className="section-label text-gold">{'// SIN CONEXIÓN'}</div>

        <h1 className="display-heading text-[8rem] leading-none gold-text select-none">
          OFF
        </h1>

        <div>
          <h2 className="display-heading text-4xl text-text mb-3">SIN INTERNET</h2>
          <p className="terminal-text text-text-dim leading-relaxed">
            No hay conexión a la red.
            <br />
            Revisa tu Wi-Fi o datos móviles e intenta de nuevo.
          </p>
        </div>

        <div className="w-full glass-card p-4 text-left">
          <div className="terminal-text text-xs text-text-dim space-y-1">
            <p><span className="text-gold">$</span> ping sigma-research.io</p>
            <p><span className="text-red-400">→</span> Request timeout</p>
            <p><span className="text-gold">$</span> <span className="animate-blink">_</span></p>
          </div>
        </div>

        <Link
          href="/"
          className="bg-gold text-bg section-label px-8 py-3 hover:bg-gold-glow transition-colors duration-200"
        >
          REINTENTAR
        </Link>
      </div>
    </main>
  )
}
