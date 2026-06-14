'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Home, PieChart, BookOpen, Flame, MoreHorizontal, X,
         Activity, TrendingUp, Zap, BrainCircuit, Calendar,
         Stethoscope, Coins, Receipt, Layers, FileText, Download } from 'lucide-react'
import { C } from '@/app/lib/constants'

// Breakpoint unificado con Sidebar (860px)
const HIDE_ABOVE = 860

const PRIMARY_NAV = [
  { href: '/home',       label: 'Inicio',   Icon: Home     },
  { href: '/portafolio', label: 'Cartera',  Icon: PieChart },
  { href: '/journal',    label: 'Journal',  Icon: BookOpen },
  { href: '/fire',       label: 'FIRE',     Icon: Flame    },
]

const MORE_NAV = [
  { href: '/hud',              label: 'Signal HUD',  Icon: Activity     },
  { href: '/motor-decision',   label: 'Motor',        Icon: Zap          },
  { href: '/montecarlo',       label: 'Monte Carlo',  Icon: TrendingUp   },
  { href: '/modelos',          label: 'Modelos',      Icon: BrainCircuit },
  { href: '/calendario',       label: 'Calendario',   Icon: Calendar     },
  { href: '/diagnosticador',   label: 'Diagnóst.',    Icon: Stethoscope  },
  { href: '/ingresos-pasivos', label: 'Ingresos',     Icon: Coins        },
  { href: '/lp-defi',          label: 'LP DeFi',      Icon: Layers       },
  { href: '/tax',              label: 'Tax',           Icon: Receipt      },
  { href: '/mis-reportes',     label: 'Reportes',     Icon: FileText     },
]

const MONO = 'monospace'

export default function MobileNav() {
  const path           = usePathname()
  const [open, setOpen] = useState(false)

  const hideStyle = `@media (min-width: ${HIDE_ABOVE}px) { .sigma-mobile-nav, .sigma-more-drawer { display: none !important; } }`

  return (
    <>
      <style>{hideStyle}</style>

      {/* ── Drawer "Más" ──────────────────────────────────────────────────── */}
      {open && (
        <div
          className="sigma-more-drawer"
          style={{
            position: 'fixed',
            bottom: 64,
            left: 0,
            right: 0,
            zIndex: 8999,
            background: 'rgba(11,13,20,0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderTop: `1px solid ${C.border}`,
            padding: '16px 12px',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            paddingBottom: 10,
            borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: C.muted }}>
              MÁS SECCIONES
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}>
            {MORE_NAV.map(({ href, label, Icon }) => {
              const active = path === href || path.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '12px 4px',
                    borderRadius: 8,
                    background: active ? `rgba(212,175,55,0.08)` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${active ? 'rgba(212,175,55,0.25)' : C.border}`,
                    textDecoration: 'none',
                  }}
                >
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.2 : 1.6}
                    color={active ? C.gold : C.muted}
                  />
                  <span style={{
                    fontFamily: MONO,
                    fontSize: 9,
                    letterSpacing: '0.04em',
                    color: active ? C.gold : C.muted,
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}>
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>

          {/* Descargar App — Coming Soon */}
          <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${C.border}`,
                opacity: 0.5,
                cursor: 'not-allowed',
              }}
            >
              <Download size={18} strokeWidth={1.6} color={C.muted} />
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted, letterSpacing: '0.06em' }}>
                  DESCARGAR APP
                </span>
              </div>
              <span style={{
                fontFamily: MONO,
                fontSize: 8,
                letterSpacing: '0.12em',
                color: '#d4af37',
                border: '1px solid rgba(212,175,55,0.35)',
                padding: '2px 6px',
                borderRadius: 3,
              }}>
                PRÓXIMAMENTE
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Overlay para cerrar drawer */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 8998,
            background: 'rgba(0,0,0,0.4)',
          }}
        />
      )}

      {/* ── Bottom nav principal ──────────────────────────────────────────── */}
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
        {PRIMARY_NAV.map(({ href, label, Icon }) => {
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
              {active && (
                <span style={{
                  position: 'absolute',
                  top: 0, left: '20%', right: '20%',
                  height: 2,
                  background: C.gold,
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.6}
                color={active ? C.gold : C.muted}
                style={{ transition: 'color 0.15s' }}
              />
              <span style={{
                fontFamily: MONO,
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

        {/* Botón "Más" */}
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            flex: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            paddingTop: 4,
            position: 'relative',
          }}
        >
          {open && (
            <span style={{
              position: 'absolute',
              top: 0, left: '20%', right: '20%',
              height: 2,
              background: C.gold,
              borderRadius: '0 0 2px 2px',
            }} />
          )}
          {open
            ? <X size={22} strokeWidth={2.2} color={C.gold} />
            : <MoreHorizontal size={22} strokeWidth={1.6} color={C.muted} />
          }
          <span style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: '0.06em',
            color: open ? C.gold : C.muted,
            lineHeight: 1,
          }}>
            Más
          </span>
        </button>
      </nav>
    </>
  )
}
