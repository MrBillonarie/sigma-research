'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { C } from '@/app/lib/constants'

const NAV = [
  { href: '/home',      label: 'HOME',    icon: '⌂' },
  { href: '/hud',       label: 'HUD',     icon: '◉' },
  { href: '/portafolio',label: 'CARTERA', icon: '◈' },
  { href: '/journal',   label: 'JOURNAL', icon: '≡' },
  { href: '/fire',      label: 'FIRE',    icon: '🔥' },
]

export default function MobileNav() {
  const path = usePathname()

  return (
    <>
      <style>{`
        @media (min-width: 768px) { .sigma-mobile-nav { display: none !important; } }
        @media (max-width: 767px) { .sigma-mobile-nav { display: flex !important; } }
      `}</style>
      <nav
        className="sigma-mobile-nav"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 9000,
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
          padding: '6px 0 max(6px, env(safe-area-inset-bottom))',
          justifyContent: 'space-around',
          alignItems: 'center',
        }}
      >
        {NAV.map(item => {
          const active = path === item.href || path.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, textDecoration: 'none', flex: 1, padding: '4px 0',
                borderTop: `2px solid ${active ? C.gold : 'transparent'}`,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
              <span style={{
                fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.15em',
                color: active ? C.gold : C.muted,
              }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
