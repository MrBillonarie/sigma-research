'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Home,
  Activity,
  BookOpen,
  TrendingUp,
  Flame,
  Calendar,
  Layers,
  BrainCircuit,
  FileText,
  Stethoscope,
  Coins,
  Receipt,
  PieChart,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sigma,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import NotificationBell from './NotificationBell'

const navItems = [
  { label: 'Home',           href: '/home',           icon: Home            },
  { label: 'Terminal',       href: '/terminal',       icon: LayoutDashboard },
  { label: 'HUD',            href: '/hud',            icon: Activity  },
  { label: 'Portfolio',      href: '/portfolio',      icon: PieChart  },
  { label: 'Journal',        href: '/journal',        icon: BookOpen  },
  { label: 'Diagnosticador', href: '/diagnosticador', icon: Stethoscope },
  { label: 'Monte Carlo',    href: '/montecarlo',     icon: TrendingUp },
  { label: 'FIRE',           href: '/fire',           icon: Flame },
  { label: 'Calendario',     href: '/calendario',     icon: Calendar },
  { label: 'LP DeFi',        href: '/lp-defi',        icon: Layers },
  { label: 'Modelos',        href: '/modelos',        icon: BrainCircuit },
  { label: 'Ingresos',       href: '/ingresos-pasivos', icon: Coins    },
  { label: 'Tax Chile',      href: '/tax',              icon: Receipt  },
  { label: 'Reportes',       href: '/reportes',         icon: FileText },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <aside
      className="relative flex flex-col shrink-0 h-screen sticky top-0 transition-all duration-300"
      style={{
        width: collapsed ? '64px' : '220px',
        background: '#0b0d14',
        borderRight: '1px solid #1a1d2e',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-5"
        style={{ borderBottom: '1px solid #1a1d2e' }}
      >
        <Sigma size={24} style={{ color: '#d4af37', flexShrink: 0 }} />
        {!collapsed && (
          <span
            className="font-bold tracking-widest text-sm uppercase"
            style={{ color: '#d4af37', fontFamily: 'var(--font-bebas)', fontSize: '1.1rem', letterSpacing: '0.15em' }}
          >
            Sigma
          </span>
        )}
      </div>

      {/* Notification Bell */}
      <div style={{ borderBottom: '1px solid #1a1d2e', padding: '4px 6px' }}>
        <NotificationBell collapsed={collapsed} />
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto px-2 py-4">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors min-h-[38px]"
              style={{
                color: active ? '#d4af37' : '#8b8fa8',
                background: active ? 'rgba(212,175,55,0.08)' : 'transparent',
                fontFamily: 'var(--font-dm-mono)',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.color = '#e8e9f0'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.color = '#8b8fa8'
              }}
            >
              <Icon size={18} style={{ flexShrink: 0, color: active ? '#d4af37' : 'inherit' }} />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: profile + logout */}
      <div className="flex flex-col gap-1 px-2 pb-4" style={{ borderTop: '1px solid #1a1d2e', paddingTop: '12px' }}>
        <Link
          href="/perfil"
          title={collapsed ? 'Perfil' : undefined}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors min-h-[38px]"
          style={{
            color: pathname === '/perfil' ? '#d4af37' : '#8b8fa8',
            background: pathname === '/perfil' ? 'rgba(212,175,55,0.08)' : 'transparent',
            fontFamily: 'var(--font-dm-mono)',
            letterSpacing: '0.01em',
          }}
        >
          <User size={18} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Perfil</span>}
        </Link>

        <button
          onClick={handleLogout}
          title={collapsed ? 'Salir' : undefined}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors w-full min-h-[38px]"
          style={{ color: '#8b8fa8', fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.01em' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#e8e9f0')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#8b8fa8')}
        >
          <LogOut size={18} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Salir</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-6 flex items-center justify-center rounded-full w-6 h-6 z-10"
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', color: '#8b8fa8' }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
