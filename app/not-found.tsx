import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-bg bg-grid-pattern bg-grid flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-radial-gold pointer-events-none" />

      <div className="relative text-center flex flex-col items-center gap-8 max-w-xl">
        <div className="section-label text-gold">{'// ERROR 404'}</div>

        <h1 className="display-heading text-[12rem] leading-none gold-text select-none">
          404
        </h1>

        <div>
          <h2 className="display-heading text-4xl text-text mb-3">RUTA NO ENCONTRADA</h2>
          <p className="terminal-text text-text-dim leading-relaxed">
            El endpoint que buscas no existe o ha sido movido.
            <br />
            Vuelve al terminal principal.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/"
            className="bg-gold text-bg section-label px-8 py-3 hover:bg-gold-glow transition-colors duration-200"
          >
            VOLVER AL INICIO
          </Link>
          <Link
            href="/faq"
            className="border border-border text-text-dim section-label px-8 py-3 hover:border-gold hover:text-gold transition-colors duration-200"
          >
            VER FAQ
          </Link>
        </div>

        {/* Terminal decorativo */}
        <div className="w-full glass-card p-4 text-left">
          <div className="terminal-text text-xs text-text-dim space-y-1">
            <p><span className="text-gold">$</span> GET /[ruta]</p>
            <p><span className="text-red-400">→</span> 404 Not Found</p>
            <p><span className="text-gold">$</span> <span className="animate-blink">_</span></p>
          </div>
        </div>
      </div>
    </main>
  )
}
