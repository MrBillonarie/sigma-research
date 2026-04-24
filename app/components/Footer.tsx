import Link from 'next/link'

const herramientas = [
  { label: 'Terminal',    href: '/terminal'   },
  { label: 'Modelos ML',  href: '/modelos'    },
  { label: 'Monte Carlo', href: '/montecarlo' },
  { label: 'LP DeFi',     href: '/lp-defi'    },
  { label: 'Reportes',    href: '/reportes'   },
  { label: 'FIRE',        href: '/fire'       },
]

const empresa = [
  { label: 'Quiénes somos', href: '/quienes-somos' },
  { label: 'Contacto',      href: '/contacto'       },
  { label: 'FAQ',           href: '/faq'            },
  { label: 'Términos',      href: '/terminos'       },
  { label: 'Privacidad',    href: '/privacidad'     },
]

const social = [
  {
    label: 'Discord',
    href:  'https://discord.gg/6gdN5rNH',
    icon:  (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
  },
  {
    label: 'X / Twitter',
    href:  'https://x.com/SQuantDesk',
    icon:  (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href:  'https://www.linkedin.com/in/sigma-quant-desk-02b620403/',
    icon:  (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-bg border-t border-border px-6 py-16">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4 w-fit">
              <div className="w-7 h-7 border border-gold flex items-center justify-center">
                <span className="display-heading text-gold text-sm leading-none">Σ</span>
              </div>
              <span className="display-heading text-xl tracking-widest text-text">SIGMA RESEARCH</span>
            </Link>
            <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-xs">
              Inteligencia cuantitativa de grado institucional. Construido sobre datos reales,
              diseñado para resultados reales.
            </p>
            <div className="flex gap-4 mt-6">
              {social.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="text-text-dim hover:text-gold transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Herramientas */}
          <div>
            <div className="section-label text-gold mb-4">Herramientas</div>
            <ul className="space-y-2.5">
              {herramientas.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="terminal-text text-sm text-text-dim hover:text-gold transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <div className="section-label text-gold mb-4">Empresa</div>
            <ul className="space-y-2.5">
              {empresa.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="terminal-text text-sm text-text-dim hover:text-gold transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-border">
          <span className="terminal-text text-xs text-muted" suppressHydrationWarning>
            © {year} Sigma Research. Todos los derechos reservados.
          </span>
          <span className="terminal-text text-xs text-muted">
            Solo informativo. No constituye asesoramiento financiero.
          </span>
        </div>
      </div>
    </footer>
  )
}
