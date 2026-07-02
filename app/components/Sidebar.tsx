'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

import {
  Home,
  Activity,
  BookOpen,
  TrendingUp,
  Flame,
  Calendar,
  Layers,
  BrainCircuit,
  Stethoscope,
  Coins,
  PieChart,
  FileText,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sigma,
  Search,
  Settings,
  Bell,
  Zap,
  LifeBuoy,
  Users,
  LineChart,
  Signal,
  Receipt,
} from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LucideIcon = React.ForwardRefExoticComponent<any> | React.ComponentType<any>
import { supabase } from '../lib/supabase'
import NotificationBell from './NotificationBell'

import { C, F } from '../lib/constants'

// ─── Constants ────────────────────────────────────────────────────────────────
const GOLD   = C.gold
const BORDER = C.border
const MUTED  = C.textDim
const MONO   = F.mono

// ─── Nav items ────────────────────────────────────────────────────────────────
const navItems = [
  { label: 'Home',           href: '/home',             icon: Home            },
  { label: 'HUD',            href: '/hud',              icon: Activity        },
  { label: 'Terminal',       href: '/terminal',         icon: LineChart       },
  { label: 'Portafolio',     href: '/portafolio',        icon: PieChart        },
  { label: 'Journal',        href: '/journal',          icon: BookOpen        },
  { label: 'Diagnosticador', href: '/diagnosticador',   icon: Stethoscope     },
  { label: 'Monte Carlo',    href: '/montecarlo',       icon: TrendingUp      },
  { label: 'FIRE',           href: '/fire',             icon: Flame           },
  { label: 'Calendario',     href: '/calendario',       icon: Calendar        },
  { label: 'LP DeFi',        href: '/lp-defi',          icon: Layers          },
  { label: 'LP Signal',      href: '/lp-signal',        icon: Signal          },
  { label: 'Modelos',        href: '/modelos',          icon: BrainCircuit    },
  { label: 'Ingresos',       href: '/ingresos-pasivos', icon: Coins           },
  { label: 'Reportes',       href: '/mis-reportes',     icon: FileText        },
  { label: 'Tax',            href: '/tax',              icon: Receipt         },
  { label: 'Motor',          href: '/motor-decision',   icon: Zap             },
  { label: 'Community',      href: '/community-setups', icon: Users           },
  { label: 'Soporte',        href: '/soporte',          icon: LifeBuoy        },
]

const comparadorItems = [
  { label: 'ETFs', href: '/comparador/etfs', icon: TrendingUp },
]

// ─── Search data ──────────────────────────────────────────────────────────────
interface SearchItem {
  id:        string
  label:     string
  href:      string
  category:  string
  keywords?: string[]
  icon?:     LucideIcon
}

const TICKER_LIST = ['BTC','ETH','SOL','BNB','XRP','ADA','AVAX','MATIC','DOT','LINK','SPX','XAU','NDX','DOGE','LTC']

const ALL_ITEMS: SearchItem[] = [
  // Pages
  { id: '/home',             label: 'Home',           href: '/home',             category: 'Página', icon: Home            },
  { id: '/hud',              label: 'HUD',            href: '/hud',              category: 'Página', icon: Activity        },
  { id: '/terminal',         label: 'Terminal',       href: '/terminal',         category: 'Página', icon: LineChart,       keywords: ['terminal','chart','gráfico','precio','live','btc','eth'] },
  { id: '/portafolio',        label: 'Portafolio',     href: '/portafolio',        category: 'Página', icon: PieChart        },
  { id: '/journal',          label: 'Journal',        href: '/journal',          category: 'Página', icon: BookOpen        },
  { id: '/diagnosticador',   label: 'Diagnosticador', href: '/diagnosticador',   category: 'Página', icon: Stethoscope     },
  { id: '/montecarlo',       label: 'Monte Carlo',    href: '/montecarlo',       category: 'Página', icon: TrendingUp      },
  { id: '/fire',             label: 'FIRE',           href: '/fire',             category: 'Página', icon: Flame           },
  { id: '/calendario',       label: 'Calendario',     href: '/calendario',       category: 'Página', icon: Calendar        },
  { id: '/lp-defi',          label: 'LP DeFi',        href: '/lp-defi',          category: 'Página', icon: Layers          },
  { id: '/lp-signal',        label: 'LP Signal',      href: '/lp-signal',        category: 'Página', icon: Signal,          keywords: ['lp','signal','señal','defi','liquidity','liquidez','kelly'] },
  { id: '/modelos',          label: 'Modelos',        href: '/modelos',          category: 'Página', icon: BrainCircuit    },
  { id: '/ingresos-pasivos', label: 'Ingresos',       href: '/ingresos-pasivos', category: 'Página', icon: Coins           },
  { id: '/mis-reportes',              label: 'Reportes',       href: '/mis-reportes',             category: 'Página',      icon: FileText        },
  { id: '/tax',                       label: 'Tax',            href: '/tax',                      category: 'Página',      icon: Receipt,         keywords: ['tax','impuesto','igc','renta','tributario','chile'] },
  { id: '/motor-decision',            label: 'Motor',          href: '/motor-decision',           category: 'Página',      icon: Zap,             keywords: ['motor','decision','señales','signals','allocator','reporte'] },
  { id: '/community-setups',          label: 'Community',      href: '/community-setups',         category: 'Página',      icon: Users,           keywords: ['community','setups','comunidad','votos','ideas','trades'] },
  { id: '/perfil',                    label: 'Perfil',         href: '/perfil',                   category: 'Página',      icon: User            },
  { id: '/soporte',                   label: 'Soporte',        href: '/soporte',                  category: 'Página',      icon: LifeBuoy,        keywords: ['ticket','ayuda','contacto','soporte'] },
  { id: '/comparador/etfs',           label: 'ETFs',           href: '/comparador/etfs',          category: 'Comparador',  icon: TrendingUp      },
  // Tickers
  ...TICKER_LIST.map(t => ({
    id: `ticker-${t}`, label: `Ver ${t} en Terminal`, href: `/terminal?symbol=${t}`,
    category: 'Terminal', keywords: [t.toLowerCase(), t],
  })),
  // Config
  { id: 'cfg-api',  label: 'API Key Binance',    href: '/perfil#binance-keys',  category: 'Configuración', icon: Settings, keywords: ['api','key','binance','secret','api key'] },
  { id: 'cfg-pwd',  label: 'Cambiar contraseña', href: '/perfil#cambiar-pwd',   category: 'Configuración', icon: Settings, keywords: ['contraseña','password','cambiar','contrasena'] },
  { id: 'cfg-name', label: 'Editar nombre',       href: '/perfil#editar-nombre', category: 'Configuración', icon: Settings, keywords: ['nombre','editar','username','perfil'] },
  { id: 'cfg-plan', label: 'Plan / Reportes',     href: '/mis-reportes',         category: 'Configuración', icon: Settings, keywords: ['plan','reportes','upgrade','suscripcion'] },
  // Alert
  { id: 'alert-new', label: '+ Nueva alerta', href: '/terminal', category: 'Alerta', icon: Bell, keywords: ['alerta','crear alerta','nueva alerta','nueva','alert'] },
]

const QUICK_IDS = ['/terminal', '/hud', '/mis-reportes', 'alert-new']
const QUICK_ACCESS = ALL_ITEMS.filter(i => QUICK_IDS.includes(i.id))

function searchItems(query: string): SearchItem[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return ALL_ITEMS.filter(item => {
    if (item.label.toLowerCase().includes(q)) return true
    if (item.keywords?.some(k => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))) return true
    return false
  }).slice(0, 6)
}

// ─── SearchBar ────────────────────────────────────────────────────────────────
function SearchBar({ collapsed, onExpand }: { collapsed: boolean; onExpand: () => void }) {
  const router       = useRouter()
  const [query,    setQuery]   = useState('')
  const [open,     setOpen]    = useState(false)
  const [selIdx,   setSelIdx]  = useState(-1)
  const [dropPos,  setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef    = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropRef     = useRef<HTMLDivElement>(null)

  const results = query.trim() ? searchItems(query) : QUICK_ACCESS

  const updatePos = useCallback(() => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 6, left: r.left, width: r.width })
    }
  }, [])

  function openDrop() { updatePos(); setOpen(true); setSelIdx(-1) }
  function closeDrop() { setOpen(false); setSelIdx(-1) }

  function navigate(item: SearchItem) {
    setQuery(''); closeDrop()
    router.push(item.href)
  }

  // Global Ctrl+K / ⌘K
  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (collapsed) {
          onExpand()
          setTimeout(() => { inputRef.current?.focus(); openDrop() }, 320)
        } else {
          inputRef.current?.focus()
          openDrop()
        }
      }
    }
    window.addEventListener('keydown', onGlobalKey)
    return () => window.removeEventListener('keydown', onGlobalKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, onExpand])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      const t = e.target as Node
      if (containerRef.current?.contains(t)) return
      if (dropRef.current?.contains(t)) return
      closeDrop()
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setQuery(''); closeDrop(); inputRef.current?.blur(); return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setSelIdx(i => Math.min(i + 1, results.length - 1)); return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault(); setSelIdx(i => Math.max(i - 1, -1)); return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = selIdx >= 0 ? results[selIdx] : results[0]
      if (item) navigate(item)
    }
  }

  // ── Collapsed: icon only ───────────────────────────────────────────────────
  if (collapsed) {
    return (
      <button
        onClick={() => { onExpand(); setTimeout(() => { inputRef.current?.focus(); openDrop() }, 320) }}
        title="Buscar (Ctrl+K)"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', padding: '10px 0', background: 'transparent',
          border: 'none', cursor: 'pointer', color: MUTED,
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#e8e9f0')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = MUTED)}
      >
        <Search size={18} />
      </button>
    )
  }

  // ── Expanded: full input ───────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ padding: '8px 10px' }}>
      <div style={{ position: 'relative' }}>
        {/* Lupa icon inside input */}
        <Search
          size={14}
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Buscar..."
          autoComplete="off"
          onChange={e => { setQuery(e.target.value); setSelIdx(-1); if (!open) openDrop() }}
          onFocus={e => {
            e.currentTarget.style.borderColor = 'rgba(245,200,66,0.4)'
            e.currentTarget.style.boxShadow   = '0 0 0 2px rgba(245,200,66,0.08)'
            openDrop()
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.boxShadow   = 'none'
          }}
          onKeyDown={handleInputKeyDown}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
            padding: '8px 36px 8px 32px', color: '#e5e5e5',
            fontSize: 13, fontFamily: MONO, outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
        {/* Shortcut hint */}
        <span style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.2)', pointerEvents: 'none',
        }}>
          ⌘K
        </span>
      </div>

      {/* Dropdown via portal */}
      {open && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width,
            background: '#111111', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 99998, maxHeight: 320, overflowY: 'auto',
          }}
        >
          {/* Label */}
          {!query.trim() && (
            <div style={{ padding: '8px 12px 4px', fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em' }}>
              {'// ACCESO RÁPIDO'}
            </div>
          )}

          {/* No results */}
          {query.trim() !== '' && results.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
                Sin resultados para &ldquo;{query}&rdquo;
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>
                Prueba con Home, BTC, alerta…
              </div>
            </div>
          ) : (
            results.map((item, idx) => {
              const IconComp = item.icon
              const isSelected = selIdx === idx
              return (
                <button
                  key={item.id}
                  onMouseDown={e => { e.preventDefault(); navigate(item) }}
                  onMouseEnter={() => setSelIdx(idx)}
                  onMouseLeave={() => setSelIdx(-1)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '9px 12px', textAlign: 'left',
                    background: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                    border: 'none',
                    borderLeft: isSelected ? '2px solid #F5C842' : '2px solid transparent',
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}
                >
                  {/* Category icon */}
                  <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, display: 'flex', alignItems: 'center', width: 16 }}>
                    {item.category === 'Terminal' && !IconComp
                      ? <span style={{ fontFamily: 'monospace', fontSize: 14 }}>~</span>
                      : IconComp
                        ? <IconComp size={14} />
                        : <span style={{ fontSize: 12 }}>·</span>
                    }
                  </span>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: MONO, fontSize: 13, color: '#e8e9f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
                      {item.category}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      , document.body)}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const pathname  = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const navLinkBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : 11,
    padding: collapsed ? '10px 0' : '9px 10px',
    borderRadius: 6,
    minHeight: 36,
    textDecoration: 'none',
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: '0.02em',
    transition: 'color 0.12s, background 0.12s',
    width: '100%',
    justifyContent: collapsed ? 'center' : 'flex-start',
    border: 'none',
  }

  return (
    <aside
      style={{
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100vh',
        width: collapsed ? 60 : 216,
        background: C.surface,
        borderRight: `1px solid ${BORDER}`,
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: collapsed ? '18px 0' : '16px 14px',
        borderBottom: `1px solid ${BORDER}`,
        justifyContent: collapsed ? 'center' : 'flex-start',
        flexShrink: 0,
      }}>
        <Sigma size={22} style={{ color: GOLD, flexShrink: 0 }} />
        {!collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ color: GOLD, fontFamily: 'var(--font-bebas)', fontSize: '1.05rem', letterSpacing: '0.18em', textTransform: 'uppercase', lineHeight: 1 }}>
              SQuant Desk
            </span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: '0.15em' }}>MOTOR CUÁNTICO</span>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <SearchBar collapsed={collapsed} onExpand={() => setCollapsed(false)} />
      </div>

      {/* Notification Bell */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '4px 6px', flexShrink: 0 }}>
        <NotificationBell collapsed={collapsed} />
      </div>

      {/* Nav items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              style={{
                ...navLinkBase,
                color:       active ? GOLD : MUTED,
                background:  active ? 'rgba(212,175,55,0.07)' : 'transparent',
                borderLeft:  active ? `2px solid ${GOLD}` : '2px solid transparent',
                paddingLeft: active ? (collapsed ? undefined : 8) : undefined,
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = C.text; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = MUTED; (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
            >
              <Icon size={16} style={{ flexShrink: 0, color: active ? GOLD : 'inherit' }} />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}

        {/* COMPARADOR section */}
        <div style={{ borderTop: `1px solid ${BORDER}`, margin: '8px 0', marginTop: 'auto' }} />
        {!collapsed && (
          <div style={{ padding: '0 4px 4px', fontFamily: MONO, fontSize: 8, letterSpacing: '0.22em', color: C.muted, textTransform: 'uppercase' }}>
            Comparador
          </div>
        )}
        {comparadorItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              style={{
                ...navLinkBase,
                color:      active ? GOLD : MUTED,
                background: active ? 'rgba(212,175,55,0.07)' : 'transparent',
                borderLeft: active ? `2px solid ${GOLD}` : '2px solid transparent',
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = C.text; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = MUTED; (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
            >
              <Icon size={16} style={{ flexShrink: 0, color: active ? GOLD : 'inherit' }} />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: profile + logout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 8px 14px', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <Link
          href="/perfil"
          title={collapsed ? 'Perfil' : undefined}
          style={{
            ...navLinkBase,
            color:      pathname === '/perfil' ? GOLD : MUTED,
            background: pathname === '/perfil' ? 'rgba(212,175,55,0.07)' : 'transparent',
            borderLeft: pathname === '/perfil' ? `2px solid ${GOLD}` : '2px solid transparent',
          }}
          onMouseEnter={e => { if (pathname !== '/perfil') { (e.currentTarget as HTMLElement).style.color = C.text; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' } }}
          onMouseLeave={e => { if (pathname !== '/perfil') { (e.currentTarget as HTMLElement).style.color = MUTED; (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
        >
          <User size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Perfil</span>}
        </Link>

        <button
          onClick={handleLogout}
          title={collapsed ? 'Salir' : undefined}
          style={{ ...navLinkBase, background: 'transparent', cursor: 'pointer', color: MUTED }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.red; (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.05)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = MUTED; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Salir</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        style={{
          position: 'absolute', right: -10, top: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 20, height: 20, borderRadius: '50%',
          background: C.border2, border: `1px solid ${C.border}`,
          color: MUTED, cursor: 'pointer', zIndex: 10, transition: 'background 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.border; (e.currentTarget as HTMLElement).style.color = GOLD }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.border2; (e.currentTarget as HTMLElement).style.color = MUTED }}
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </aside>
  )
}
