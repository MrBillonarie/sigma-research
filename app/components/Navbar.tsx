'use client'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const companyLinks = [
  { label: 'Quiénes somos', href: '/quienes-somos' },
  { label: 'FAQ',            href: '/faq' },
  { label: 'Términos',       href: '/terminos' },
  { label: 'Privacidad',     href: '/privacidad' },
]

export default function Navbar() {
  const [scrolled,        setScrolled]        = useState(false)
  const [menuOpen,        setMenuOpen]        = useState(false)
  const [companyOpen,     setCompanyOpen]     = useState(false)
  const [desktopDropdown, setDesktopDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname    = usePathname()
  const isHome      = pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDesktopDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hashHref = (anchor: string) => isHome ? anchor : `/${anchor}`

  const navLinks = [
    { label: 'Productos', href: hashHref('#productos') },
    { label: 'FIRE',      href: hashHref('#fire') },
    { label: 'Modelos',   href: hashHref('#modelos') },
    { label: 'Contacto',  href: hashHref('#cta') },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-bg/95 backdrop-blur-md border-b border-border' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-7 h-7 border border-gold flex items-center justify-center">
            <span className="display-heading text-gold text-sm leading-none">Σ</span>
          </div>
          <span className="display-heading text-xl tracking-widest text-text">SIGMA RESEARCH</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(l => (
            <a
              key={l.href}
              href={l.href}
              className={`section-label transition-colors duration-200 ${
                isActive(l.href) ? 'text-gold' : 'text-text-dim hover:text-gold'
              }`}
            >
              {l.label}
            </a>
          ))}

          {/* COMPAÑÍA dropdown — opens on hover */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={() => setDesktopDropdown(true)}
            onMouseLeave={() => setDesktopDropdown(false)}
          >
            <button
              className={`section-label transition-colors duration-200 flex items-center gap-1 ${
                companyLinks.some(l => isActive(l.href)) ? 'text-gold' : 'text-text-dim hover:text-gold'
              }`}
            >
              COMPAÑÍA
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${desktopDropdown ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {desktopDropdown && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-44 pt-2">
              <div className="bg-surface border border-border py-1">
                {companyLinks.map(l => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`block px-4 py-2 section-label transition-colors duration-200 ${
                      isActive(l.href)
                        ? 'text-gold bg-gold/5'
                        : 'text-text-dim hover:text-gold hover:bg-gold/5'
                    }`}
                    onClick={() => setDesktopDropdown(false)}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
              </div>
            )}
          </div>

          {/* LOGIN */}
          <Link
            href="/login"
            className={`section-label transition-colors duration-200 ${
              isActive('/login') ? 'text-gold' : 'text-text-dim hover:text-gold'
            }`}
          >
            LOGIN
          </Link>

          {/* Acceso CTA */}
          <a
            href={hashHref('#cta')}
            className="gold-border px-5 py-2 section-label text-gold hover:bg-gold hover:text-bg transition-all duration-200"
          >
            Acceso
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`w-5 h-px bg-gold transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`w-5 h-px bg-gold transition-all ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-px bg-gold transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-surface border-b border-border px-6 py-4 flex flex-col gap-4">
          {navLinks.map(l => (
            <a
              key={l.href}
              href={l.href}
              className={`section-label transition-colors ${
                isActive(l.href) ? 'text-gold' : 'text-text-dim hover:text-gold'
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </a>
          ))}

          {/* COMPAÑÍA accordion */}
          <button
            className={`section-label text-left flex items-center justify-between transition-colors ${
              companyLinks.some(l => isActive(l.href)) ? 'text-gold' : 'text-text-dim hover:text-gold'
            }`}
            onClick={() => setCompanyOpen(!companyOpen)}
          >
            COMPAÑÍA
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${companyOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {companyOpen && (
            <div className="pl-4 flex flex-col gap-3 border-l border-border">
              {companyLinks.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`section-label transition-colors ${
                    isActive(l.href) ? 'text-gold' : 'text-text-dim hover:text-gold'
                  }`}
                  onClick={() => { setMenuOpen(false); setCompanyOpen(false) }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}

          {/* LOGIN */}
          <Link
            href="/login"
            className={`section-label transition-colors ${
              isActive('/login') ? 'text-gold' : 'text-text-dim hover:text-gold'
            }`}
            onClick={() => setMenuOpen(false)}
          >
            LOGIN
          </Link>

          {/* Acceso CTA */}
          <a
            href={hashHref('#cta')}
            className="gold-border px-5 py-2 section-label text-gold text-center hover:bg-gold hover:text-bg transition-all duration-200"
            onClick={() => setMenuOpen(false)}
          >
            Acceso
          </a>
        </div>
      )}
    </nav>
  )
}
