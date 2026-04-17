'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const plataforma = [
  { label: 'Productos',       href: '/#productos' },
  { label: 'FIRE Calculator', href: '/#fire' },
  { label: 'Modelos ML',      href: '/#modelos' },
  { label: 'Precios',         href: '/#cta' },
]

const empresa = [
  { label: 'Quiénes somos', href: '/quienes-somos' },
  { label: 'FAQ',           href: '/faq' },
  { label: 'Términos',      href: '/terminos' },
  { label: 'Privacidad',    href: '/privacidad' },
]

const social = [
  { label: 'Twitter / X', href: 'https://twitter.com/sigmaresearch' },
  { label: 'LinkedIn',    href: 'https://linkedin.com/company/sigma-research' },
  { label: 'GitHub',      href: 'https://github.com/sigma-research' },
]

export default function Footer() {
  const [year, setYear] = useState(2025)
  useEffect(() => { setYear(new Date().getFullYear()) }, [])

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
            <div className="flex gap-5 mt-6">
              {social.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="terminal-text text-xs text-text-dim hover:text-gold transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* Plataforma */}
          <div>
            <div className="section-label text-gold mb-4">Plataforma</div>
            <ul className="space-y-2.5">
              {plataforma.map(l => (
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
          <span className="terminal-text text-xs text-muted">
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
