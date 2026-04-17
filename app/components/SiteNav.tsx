'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const C = {
  bg: '#04050a', border: '#1a1d2e', gold: '#d4af37',
  text: '#e8e9f0', dimText: '#7a7f9a',
}

const LINKS = [
  { label: 'Terminal',    href: '/terminal' },
  { label: 'Modelos',     href: '/modelos' },
  { label: 'FIRE',        href: '/fire' },
  { label: 'Monte Carlo', href: '/montecarlo' },
  { label: 'Reportes',    href: '/reportes' },
]

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false)
  const path = usePathname()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: scrolled ? 'rgba(4,5,10,0.96)' : 'rgba(4,5,10,0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`,
      transition: 'border-color 0.3s',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 26, height: 26, border: `1px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: "'Bebas Neue', Impact", color: C.gold, fontSize: 13, lineHeight: 1 }}>Σ</span>
          </div>
          <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 16, letterSpacing: '0.18em', color: C.text }}>
            SIGMA RESEARCH
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {LINKS.map(({ label, href }) => {
            const active = path === href
            return (
              <Link key={href} href={href} style={{
                fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em',
                textTransform: 'uppercase', textDecoration: 'none',
                color: active ? C.gold : C.dimText,
                borderBottom: active ? `1px solid ${C.gold}` : '1px solid transparent',
                paddingBottom: 2,
                transition: 'color 0.2s, border-color 0.2s',
              }}>
                {label}
              </Link>
            )
          })}
          <Link href="/reportes" style={{
            fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
            textDecoration: 'none', color: '#04050a', background: C.gold,
            padding: '5px 14px', transition: 'background 0.2s',
          }}>
            PRO
          </Link>
        </div>
      </div>
    </nav>
  )
}
