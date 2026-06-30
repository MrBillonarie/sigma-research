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
      { label: 'Portafolio',  href: '/portafolio', desc: 'Dashboard de portafolio' },
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
      { label: 'Recursos',   href: '/recursos', desc: 'Todas las herramientas' },
      { label: 'Reportes',   href: '/reportes', desc: 'Análisis cuantitativo' },
      { label: 'FAQ',        href: '/faq',      desc: 'Preguntas frecuentes' },
    ],
  },
  {
    id: 'empresa',
    label: 'Empresa',
    links: [
      { label: 'Quiénes somos', href: '/quienes-somos', desc: 'Nuestro equipo y misión' },
      { label: 'Roadmap',       href: '/roadmap',       desc: 'Hitos y metas del motor' },
      { label: 'White Paper',   href: '/white-paper',   desc: 'Metodología y track record' },
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      // Si la sesión se cae a mitad de navegación (token de refresh
      // inválido/expirado, logout en otra pestaña), antes los componentes
      // del dashboard simplemente dejaban de cargar datos en silencio — se
      // sentía como que "algo se rompió" en vez de un logout claro.
      const PUBLIC_PREFIXES = ['/login', '/registro', '/recuperar', '/nueva-contrasena', '/auth/callback']
      if (event === 'SIGNED_OUT' && !PUBLIC_PREFIXES.some(p => pathname.startsWith(p)) && pathname !== '/') {
        router.push(`/login?next=${encodeURIComponent(pathname)}`)
      }
    })
    return () => subscription.unsubscribe()
  }, [pathname, router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    const SIGMA_KEYS = ['sigma_portfolio','sigma_positions','sigma_trades','sigma_fire_target','sigma_montecarlo','sigma_activity','sigma_portfolio_total','sigma_setups','sigma_alerts','sigma_lp_capital','sigma_fire_gasto','sigma_fire_ahorro','sigma_fire_edad','sigma_motor_profile','sigma_portfolio_saved_at']
    SIGMA_KEYS.forEach(k => { try { localStorage.removeItem(k) } catch {} })
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

  // ── Lock body scroll while mobile menu is open ──────────────────────────
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const isActive      = useCallback((href: string) => pathname === href, [pathname])
  const groupIsActive = useCallback((g: typeof GROUPS[number]) =>
    g.links.some(l => pathname === l.href), [pathname])

  const toggleMobile = (id: GroupId) =>
    setMobileGroup(prev => (prev === id ? null : id))

  return (
    <nav
      ref={navRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || menuOpen ? 'bg-bg/95 backdrop-blur-md border-b border-border' : 'bg-transparent'
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
              onFocus={() => setActiveGroup(group.id)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setActiveGroup(prev => (prev === group.id ? null : prev))
                }
              }}
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
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 min-w-[220px]">
                  <div className="bg-surface border border-gold/20 relative overflow-hidden">
                    {/* Scan line */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

                    {/* Header label */}
                    <div className="px-4 pt-3 pb-2 border-b border-gold/8">
                      <span className="terminal-text text-[9px] text-gold/50 tracking-[0.35em] uppercase">
                        {`// ${group.label}`}
                      </span>
                    </div>

                    {group.links.map(l => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className={`flex flex-col px-4 py-2.5 transition-colors duration-150 group/item border-l-2 ${
                          isActive(l.href)
                            ? 'bg-gold/8 border-gold'
                            : 'border-transparent hover:bg-gold/5 hover:border-gold/50'
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

                    {/* Bottom accent */}
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/15 to-transparent" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ── Language switcher ──────────────────────────────────────────── */}
          <div className="flex items-center gap-1 border border-border rounded-sm overflow-hidden">
            <Link
              href="/"
              className={`terminal-text text-[10px] px-2.5 py-1 transition-colors ${
                !pathname.startsWith('/en') ? 'bg-gold text-bg' : 'text-text-dim hover:text-gold'
              }`}
            >
              ES
            </Link>
            <Link
              href="/en"
              className={`terminal-text text-[10px] px-2.5 py-1 transition-colors ${
                pathname.startsWith('/en') ? 'bg-gold text-bg' : 'text-text-dim hover:text-gold'
              }`}
            >
              EN
            </Link>
          </div>

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
      {/* fixed + top-16/bottom-0: cubre TODO el alto restante de la pantalla,
          para que el contenido de la pagina (hero, etc.) no asome debajo del
          panel cuando este es mas corto que el viewport. */}
      {menuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 h-[calc(100dvh-4rem)] bg-surface overflow-y-auto px-6 py-4 flex flex-col gap-1">

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

          {/* Language switcher mobile */}
          <div className="flex items-center gap-2 pt-3 mt-1 border-t border-border">
            <span className="terminal-text text-xs text-text-dim">Idioma:</span>
            <Link href="/" className={`section-label px-3 py-1 transition-colors ${!pathname.startsWith('/en') ? 'bg-gold text-bg' : 'text-text-dim hover:text-gold border border-border'}`}>ES</Link>
            <Link href="/en" className={`section-label px-3 py-1 transition-colors ${pathname.startsWith('/en') ? 'bg-gold text-bg' : 'text-text-dim hover:text-gold border border-border'}`}>EN</Link>
          </div>

          {/* Auth */}
          <div className="flex flex-col gap-3 pt-3 border-t border-border">
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
                  className="gold-border px-5 py-2.5 section-label text-gold text-center hover:bg-gold hover:text-bg transition-all duration-200"
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
