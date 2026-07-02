'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Activity, PieChart, Zap, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

const PRIMARY = [
  { href: '/home',         icon: Home,     label: 'Home'      },
  { href: '/hud',          icon: Activity, label: 'HUD'       },
  { href: '/portafolio',   icon: PieChart, label: 'Portfolio' },
  { href: '/motor-decision', icon: Zap,    label: 'Motor'     },
]

const MORE_LINKS = [
  { href: '/community-setups', label: 'Community' },
  { href: '/fire',             label: 'FIRE' },
  { href: '/journal',          label: 'Journal' },
  { href: '/calendario',       label: 'Calendario' },
  { href: '/montecarlo',       label: 'Monte Carlo' },
  { href: '/ingresos-pasivos', label: 'Ingresos Pasivos' },
  { href: '/mis-reportes',     label: 'Reportes' },
  { href: '/lp-defi',          label: 'LP DeFi' },
  { href: '/modelos',          label: 'Modelos' },
  { href: '/comparador/etfs',  label: 'Comparador ETFs' },
  { href: '/soporte',          label: 'Soporte' },
  { href: '/perfil',           label: 'Perfil' },
]

export default function MobileBottomNav() {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: '#0b0d14', borderTop: '1px solid #1a1d2e',
        display: 'flex', alignItems: 'stretch', height: 56,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {PRIMARY.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                color: active ? '#d4af37' : '#7a7f9a',
                textDecoration: 'none', fontSize: 9,
                letterSpacing: '0.1em', fontFamily: 'monospace',
                borderBottom: active ? '2px solid #d4af37' : '2px solid transparent',
                transition: 'color 0.15s',
              }}
            >
              <Icon size={18} strokeWidth={1.5} />
              {label}
            </Link>
          )
        })}

        {/* More button */}
        <button
          onClick={() => setShowMore(true)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            color: '#7a7f9a', background: 'none', border: 'none',
            fontSize: 9, letterSpacing: '0.1em', fontFamily: 'monospace',
            borderBottom: '2px solid transparent', cursor: 'pointer',
          }}
        >
          <MoreHorizontal size={18} strokeWidth={1.5} />
          Más
        </button>
      </nav>

      {/* More drawer */}
      {showMore && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(4,5,10,0.85)', backdropFilter: 'blur(6px)',
          }}
          onClick={() => setShowMore(false)}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: '#0b0d14', borderTop: '1px solid #1a1d2e',
              borderRadius: '12px 12px 0 0', padding: '20px 16px 40px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              width: 36, height: 3, background: '#1a1d2e',
              borderRadius: 2, margin: '0 auto 20px',
            }} />
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}>
              {MORE_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setShowMore(false)}
                  style={{
                    display: 'block', padding: '10px 14px',
                    background: '#04050a', border: '1px solid #1a1d2e',
                    color: '#e8e9f0', fontSize: 11, fontFamily: 'monospace',
                    letterSpacing: '0.08em', textDecoration: 'none',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
