export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-bg border-t border-border px-6 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 border border-gold flex items-center justify-center">
                <span className="display-heading text-gold text-sm leading-none">Σ</span>
              </div>
              <span className="display-heading text-xl tracking-widest text-text">SIGMA RESEARCH</span>
            </div>
            <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-xs">
              Inteligencia cuantitativa de grado institucional. Construido sobre datos reales,
              diseñado para resultados reales.
            </p>
            <div className="flex gap-4 mt-6">
              {['Twitter', 'LinkedIn', 'GitHub'].map((s) => (
                <a
                  key={s}
                  href="#"
                  rel="noopener noreferrer"
                  className="terminal-text text-xs text-text-dim hover:text-gold transition-colors"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <div className="section-label text-gold mb-4">Plataforma</div>
            <ul className="space-y-2">
              {['Terminal', 'PRO.MACD', 'FIRE Calculator', 'Sigma HUD', 'API Docs'].map((l) => (
                <li key={l}>
                  <a href="#" className="terminal-text text-sm text-text-dim hover:text-gold transition-colors">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="section-label text-gold mb-4">Empresa</div>
            <ul className="space-y-2">
              {['Metodología', 'Modelos', 'Precios', 'Contacto', 'Privacidad'].map((l) => (
                <li key={l}>
                  <a href="#" className="terminal-text text-sm text-text-dim hover:text-gold transition-colors">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-border">
          <span className="terminal-text text-xs text-muted">
            © {year} Sigma Research. Todos los derechos reservados.
          </span>
          <span className="terminal-text text-xs text-muted">
            Este sitio es solo informativo. No constituye asesoramiento financiero.
          </span>
        </div>
      </div>
    </footer>
  )
}
