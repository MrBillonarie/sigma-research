'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import type { User } from '@supabase/supabase-js'

// ─── Nav groups ───────────────────────────────────────────────────────────────
const GROUPS = [
  {
    id: 'herramientas',
    label: 'Herramientas',
    links: [
      { label: 'HUD',         href: '/hud',        desc: 'Señales en vivo' },
      { label: 'Terminal',    href: '/terminal',   desc: 'Dashboard de portafolio' },
      { label: 'Journal',     href: '/journal',    desc: 'Registro de trades' },
      { label: 'Calendario',  href: '/calendario', desc: 'Eventos macro' },
      { label: 'Monte Carlo', href: '/montecarlo', desc: 'Simulación de trayectorias' },
      { label: 'LP DeFi',     href: '/lp-defi',    desc: 'Calculador PancakeSwap v3' },
    ],
  },
  {
    id: 'recursos',
    label: 'Recursos',
    links: [
      { label: 'Modelos ML', href: '/modelos',  desc: 'Señales algorítmicas' },
      { label: 'Reportes',   href: '/reportes', desc: 'Análisis cuantitativo' },
      { label: 'FIRE',       href: '/fire',     desc: 'Calculadora de independencia' },
      { label: 'FAQ',        href: '/faq',      desc: 'Preguntas frecuentes' },
    ],
  },
  {
    id: 'empresa',
    label: 'Empresa',
    links: [
      { label: 'Quiénes somos', href: '/quienes-somos', desc: 'Nuestro equipo y misión' },
      { label: 'Contacto',      href: '/contacto',       desc: 'Habla con nosotros' },
    ],
  },
] as const

type GroupId = typeof GROUPS[number]['id']

// ─── Chevron ──────────────────────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Navbar() {
  const [scrolled,     setScrolled]     = useState(false)
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [activeGroup,  setActiveGroup]  = useState<GroupId | null>(null)
  const [mobileGroup,  setMobileGroup]  = useState<GroupId | null>(null)
  const [user,         setUser]         = useState<User | null>(null)

  const navRef    = useRef<HTMLDivElement>(null)
  const pathname  = usePathname()
  const router    = useRouter()

  // ── Scroll shadow ────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // ── Auth state ───────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  // ── Close on outside click / Escape ─────────────────────────────────────
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveGroup(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setActiveGroup(null); setMenuOpen(false) }
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // ── Close mobile menu on route change ───────────────────────────────────
  useEffect(() => { setMenuOpen(false); setMobileGroup(null) }, [pathname])

  const isActive      = useCallback((href: string) => pathname === href, [pathname])
  const groupIsActive = useCallback((g: typeof GROUPS[number]) =>
    g.links.some(l => pathname === l.href), [pathname])

  const toggleMobile = (id: GroupId) =>
    setMobileGroup(prev => (prev === id ? null : id))

  return (
    <nav
      ref={navRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-bg/95 backdrop-blur-md border-b border-border' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* ── Logo ─────────────────────────────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 border border-gold flex items-center justify-center">
            <span className="display-heading text-gold text-sm leading-none">Σ</span>
          </div>
          <span className="display-heading text-xl tracking-widest text-text">SIGMA RESEARCH</span>
        </Link>

        {/* ── Desktop nav ──────────────────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-6">

          {GROUPS.map(group => (
            <div
              key={group.id}
              className="relative"
              onMouseEnter={() => setActiveGroup(group.id)}
              onMouseLeave={() => setActiveGroup(null)}
            >
              <button
                aria-expanded={activeGroup === group.id}
                aria-haspopup="true"
                className={`section-label transition-colors duration-200 flex items-center gap-1 ${
                  groupIsActive(group) ? 'text-gold' : 'text-text-dim hover:text-gold'
                }`}
              >
                {group.label.toUpperCase()}
                <Chevron open={activeGroup === group.id} />
              </button>

              {/* Dropdown */}
              {activeGroup === group.id && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 min-w-[200px]">
                  <div className="bg-surface border border-border py-1">
                    {group.links.map(l => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className={`flex flex-col px-4 py-2.5 transition-colors duration-200 group/item ${
                          isActive(l.href) ? 'bg-gold/5' : 'hover:bg-gold/5'
                        }`}
                        onClick={() => setActiveGroup(null)}
                      >
                        <span className={`section-label transition-colors ${
                          isActive(l.href) ? 'text-gold' : 'text-text-dim group-hover/item:text-gold'
                        }`}>
                          {l.label}
                        </span>
                        <span className="terminal-text text-xs text-muted mt-0.5 group-hover/item:text-text-dim transition-colors">
                          {l.desc}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ── Auth buttons ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 ml-2">
            {user ? (
              <>
                <Link
                  href="/perfil"
                  className="section-label transition-colors duration-200 text-text-dim hover:text-gold"
                >
                  MI CUENTA
                </Link>
                <button
                  onClick={handleSignOut}
                  className="gold-border px-4 py-2 section-label text-gold hover:bg-gold hover:text-bg transition-all duration-200"
                >
                  SALIR
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`section-label transition-colors duration-200 ${
                    isActive('/login') ? 'text-gold' : 'text-text-dim hover:text-gold'
                  }`}
                >
                  LOGIN
                </Link>
                <Link
                  href="/registro"
                  className={`gold-border px-4 py-2 section-label transition-all duration-200 ${
                    isActive('/registro') ? 'bg-gold text-bg' : 'text-gold hover:bg-gold hover:text-bg'
                  }`}
                >
                  REGISTRO
                </Link>
              </>
            )}
          </div>
        </div>

        {/* ── Mobile hamburger ─────────────────────────────────────────────── */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span className={`w-5 h-px bg-gold transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`w-5 h-px bg-gold transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-px bg-gold transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* ── Mobile menu ──────────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden bg-surface border-b border-border px-6 py-4 flex flex-col gap-1">

          {GROUPS.map(group => (
            <div key={group.id}>
              {/* Group header */}
              <button
                className={`w-full section-label text-left flex items-center justify-between py-3 transition-colors ${
                  groupIsActive(group) ? 'text-gold' : 'text-text-dim hover:text-gold'
                }`}
                onClick={() => toggleMobile(group.id)}
              >
                {group.label.toUpperCase()}
                <Chevron open={mobileGroup === group.id} />
              </button>

              {/* Group links */}
              {mobileGroup === group.id && (
                <div className="pl-4 flex flex-col border-l border-border mb-1">
                  {group.links.map(l => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`section-label py-2.5 transition-colors ${
                        isActive(l.href) ? 'text-gold' : 'text-text-dim hover:text-gold'
                      }`}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Auth */}
          <div className="flex flex-col gap-3 pt-3 mt-1 border-t border-border">
            {user ? (
              <>
                <Link href="/perfil" className="section-label text-text-dim hover:text-gold transition-colors">
                  MI CUENTA
                </Link>
                <button
                  onClick={handleSignOut}
                  className="gold-border px-5 py-2.5 section-label text-gold text-center hover:bg-gold hover:text-bg transition-all duration-200"
                >
                  SALIR
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`section-label transition-colors ${
                    isActive('/login') ? 'text-gold' : 'text-text-dim hover:text-gold'
                  }`}
                >
                  LOGIN
                </Link>
                <Link
                  href="/registro"
                  className="gold-border px-5 py-2.5 section-label text-gold text-center hover:bg-gold hover:text-bg transition-all duration-200"
                >
                  REGISTRO
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
