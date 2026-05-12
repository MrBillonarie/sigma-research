'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, PieChart, BookOpen, Flame } from 'lucide-react'
import { C } from '@/app/lib/constants'

const NAV = [
  { href: '/home',       label: 'Inicio',   Icon: Home     },
  { href: '/portafolio', label: 'Cartera',  Icon: PieChart },
  { href: '/journal',    label: 'Journal',  Icon: BookOpen },
  { href: '/fire',       label: 'FIRE',     Icon: Flame    },
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
          background: 'rgba(11,13,20,0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: `1px solid ${C.border}`,
          paddingBottom: 'env(safe-area-inset-bottom)',
          justifyContent: 'space-around',
          alignItems: 'stretch',
          height: 64,
        }}
      >
        {NAV.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                flex: 1,
                textDecoration: 'none',
                position: 'relative',
                paddingTop: 4,
              }}
            >
              {/* Indicador activo — línea superior */}
              {active && (
                <span style={{
                  position: 'absolute',
                  top: 0, left: '20%', right: '20%',
                  height: 2,
                  background: C.gold,
                  borderRadius: '0 0 2px 2px',
                }} />
              )}

              {/* Ícono */}
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.6}
                color={active ? C.gold : C.muted}
                style={{ transition: 'color 0.15s' }}
              />

              {/* Label */}
              <span style={{
                fontFamily: 'monospace',
                fontSize: 9,
                letterSpacing: '0.06em',
                color: active ? C.gold : C.muted,
                transition: 'color 0.15s',
                lineHeight: 1,
              }}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
