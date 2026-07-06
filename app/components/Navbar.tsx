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
      { label: 'HUD',         href: '/hud',        desc: 'Señales en vivo',            viz: 'pulse'  },
      { label: 'Portafolio',  href: '/portafolio', desc: 'Dashboard de portafolio',    viz: 'ascend' },
      { label: 'Journal',     href: '/journal',    desc: 'Registro de trades',         viz: 'bars'   },
      { label: 'Calendario',  href: '/calendario', desc: 'Eventos macro',              viz: 'dots'   },
      { label: 'Monte Carlo', href: '/montecarlo', desc: 'Simulación de trayectorias', viz: 'cone'   },
      { label: 'LP DeFi',     href: '/lp-defi',    desc: 'Calculador PancakeSwap v3',  viz: 'range'  },
    ],
  },
  {
    id: 'recursos',
    label: 'Recursos',
    links: [
      { label: 'Recursos',   href: '/recursos', desc: 'Todas las herramientas',  viz: 'grid' },
      { label: 'Reportes',   href: '/reportes', desc: 'Análisis cuantitativo',   viz: 'doc'  },
      { label: 'FAQ',        href: '/faq',      desc: 'Preguntas frecuentes',    viz: 'dial' },
    ],
  },
  {
    id: 'empresa',
    label: 'Empresa',
    links: [
      { label: 'Quiénes somos', href: '/quienes-somos', desc: 'Nuestro equipo y misión',      viz: 'team'   },
      { label: 'Roadmap',       href: '/roadmap',       desc: 'Hitos y metas del motor',      viz: 'road'   },
      { label: 'White Paper',   href: '/white-paper',   desc: 'Metodología y track record',   viz: 'sigma'  },
      { label: 'Contacto',      href: '/contacto',       desc: 'Habla con nosotros',           viz: 'signal' },
    ],
  },
] as const

// ─── Micro-visuales del mega-menu ─────────────────────────────────────────────
// Cada herramienta se muestra, no solo se nombra. Monocromo con currentColor:
// heredan el gris tenue del item y se encienden en dorado al hover.
function MiniViz({ type }: { type: string }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (type) {
    case 'pulse': // HUD — latido de señal
      return <svg width="30" height="16" viewBox="0 0 30 16"><path {...p} d="M0,8 L7,8 L10,3 L14,13 L17,8 L23,8 L25,5 L30,8" opacity="0.9" /></svg>
    case 'ascend': // Portafolio — equity ascendente
      return <svg width="30" height="16" viewBox="0 0 30 16"><path {...p} d="M1,14 Q15,14 21,5" opacity="0.9" /><circle cx="21" cy="5" r="2" fill="currentColor" stroke="none" /></svg>
    case 'bars': // Journal — barras de trades
      return <svg width="30" height="16" viewBox="0 0 30 16">{[5, 9, 13, 16].map((h, i) => <rect key={i} x={i * 7 + 2} y={16 - h} width="4" height={h} fill="currentColor" opacity={0.35 + i * 0.2} rx="1" />)}</svg>
    case 'dots': // Calendario — grilla de eventos
      return <svg width="30" height="16" viewBox="0 0 30 16">{[0, 1, 2, 3].map(c => [0, 1].map(r => <circle key={`${c}-${r}`} cx={c * 8 + 3} cy={r * 8 + 4} r="1.8" fill="currentColor" opacity={c === 2 && r === 1 ? 1 : 0.35} />))}</svg>
    case 'cone': // Monte Carlo — abanico de trayectorias
      return <svg width="30" height="16" viewBox="0 0 30 16">{[2, 5, 8, 11, 14].map((y, i) => <line key={i} x1="1" y1="8" x2="29" y2={y} stroke="currentColor" strokeWidth={i === 2 ? 1.5 : 1} opacity={i === 2 ? 0.9 : 0.3} />)}</svg>
    case 'range': // LP DeFi — banda de rango
      return <svg width="30" height="16" viewBox="0 0 30 16"><line x1="0" y1="8" x2="30" y2="8" stroke="currentColor" strokeWidth="1" opacity="0.3" /><rect x="8" y="5" width="14" height="6" rx="1.5" fill="currentColor" opacity="0.2" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1" /><line x1="16" y1="1" x2="16" y2="15" stroke="currentColor" strokeWidth="1.4" opacity="0.9" /></svg>
    case 'grid': // Recursos — retícula
      return <svg width="30" height="16" viewBox="0 0 30 16">{[0, 1, 2].map(c => [0, 1].map(r => <rect key={`${c}-${r}`} x={c * 9 + 3} y={r * 8 + 1.5} width="6" height="5.5" rx="1" fill="currentColor" opacity={0.3 + (c + r) * 0.15} />))}</svg>
    case 'doc': // Reportes — documento con líneas
      return <svg width="30" height="16" viewBox="0 0 30 16"><rect x="8" y="1" width="14" height="14" rx="1.5" {...p} opacity="0.6" /><line x1="11" y1="5.5" x2="19" y2="5.5" stroke="currentColor" strokeWidth="1.2" opacity="0.9" /><line x1="11" y1="8.5" x2="19" y2="8.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" /><line x1="11" y1="11.5" x2="16" y2="11.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" /></svg>
    case 'dial': // FAQ — indicador
      return <svg width="30" height="16" viewBox="0 0 30 16"><circle cx="15" cy="8" r="6.5" {...p} opacity="0.5" /><line x1="15" y1="8" x2="19" y2="4.5" {...p} opacity="0.9" /><circle cx="15" cy="8" r="1.4" fill="currentColor" stroke="none" /></svg>
    case 'team': // Quiénes somos — nodos conectados
      return <svg width="30" height="16" viewBox="0 0 30 16"><circle cx="9" cy="8" r="3" {...p} opacity="0.9" /><circle cx="21" cy="8" r="3" {...p} opacity="0.5" /><line x1="12" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.2" opacity="0.4" /></svg>
    case 'road': // Roadmap — hitos en línea
      return <svg width="30" height="16" viewBox="0 0 30 16"><line x1="2" y1="8" x2="28" y2="8" stroke="currentColor" strokeWidth="1" opacity="0.3" />{[6, 15, 24].map((x, i) => <circle key={i} cx={x} cy="8" r="2.2" fill={i < 2 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" opacity={i < 2 ? 0.9 : 0.5} />)}</svg>
    case 'sigma': // White paper — la firma
      return <svg width="30" height="16" viewBox="0 0 30 16"><path {...p} d="M20,3 L11,3 L16,8 L11,13 L20,13" opacity="0.9" /></svg>
    case 'signal': // Contacto — ondas
      return <svg width="30" height="16" viewBox="0 0 30 16"><circle cx="10" cy="8" r="1.6" fill="currentColor" stroke="none" /><path {...p} d="M14,4 Q18,8 14,12" opacity="0.7" /><path {...p} d="M18,2 Q24,8 18,14" opacity="0.4" /></svg>
    default:
      return null
  }
}

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
        scrolled || menuOpen ? 'bg-[#f8f5ef]/95 backdrop-blur-md border-b border-[#e7dfd0]' : 'bg-transparent'
      }`}
    >
      {/* Coreografía del mega-menu: panel con fade+slide+escala, items en cascada,
          barrido dorado al hover. Respetando prefers-reduced-motion. */}
      <style>{`
        @keyframes navPanelIn { from { opacity: 0; transform: translateY(7px) scale(0.985); } to { opacity: 1; transform: none; } }
        @keyframes navItemIn  { from { opacity: 0; transform: translateX(-7px); } to { opacity: 1; transform: none; } }
        .nav-sweep::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(100deg, transparent 32%, rgba(106,52,209,0.09) 50%, transparent 68%);
          transform: translateX(-110%);
        }
        .nav-sweep:hover::after { transform: translateX(110%); transition: transform 0.5s ease; }
        @media (prefers-reduced-motion: reduce) {
          .nav-sweep::after { display: none; }
          [style*="navPanelIn"], [style*="navItemIn"] { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* ── Logo ─────────────────────────────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 border border-[#6a34d1] flex items-center justify-center">
            <span className="display-heading text-[#6a34d1] text-sm leading-none">Σ</span>
          </div>
          <span className="display-heading text-xl tracking-widest text-[#1b1723]">SIGMA RESEARCH</span>
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
                  groupIsActive(group) ? 'text-[#6a34d1]' : 'text-[#55506a] hover:text-[#6a34d1]'
                }`}
              >
                {group.label.toUpperCase()}
                <Chevron open={activeGroup === group.id} />
              </button>

              {/* Dropdown — mega-menu con marco terminal y entrada coreografiada */}
              {activeGroup === group.id && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3">
                  <div
                    className="relative overflow-hidden bg-[#ffffff]/90 backdrop-blur-xl border border-[#6a34d1]/20 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)]"
                    style={{
                      width: group.id === 'herramientas' ? 460 : 290,
                      animation: 'navPanelIn 0.18s cubic-bezier(0.16,1,0.3,1) both',
                    }}
                  >
                    {/* Corner brackets — mira de terminal */}
                    <span className="pointer-events-none absolute top-0 left-0 w-3 h-3 border-t border-l border-[#6a34d1]/70" />
                    <span className="pointer-events-none absolute top-0 right-0 w-3 h-3 border-t border-r border-[#6a34d1]/70" />
                    <span className="pointer-events-none absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[#6a34d1]/70" />
                    <span className="pointer-events-none absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[#6a34d1]/70" />

                    {/* Scan line */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#6a34d1]/50 to-transparent" />

                    {/* Header label */}
                    <div className="px-4 pt-3 pb-2 border-b border-[#6a34d1]/8">
                      <span className="terminal-text text-[9px] text-[#6a34d1]/50 tracking-[0.35em] uppercase">
                        {`// ${group.label}`}
                      </span>
                    </div>

                    <div className={group.id === 'herramientas' ? 'grid grid-cols-2 py-1' : 'flex flex-col py-1'}>
                      {group.links.map((l, i) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={`nav-sweep relative flex items-start gap-3 px-4 py-3 transition-colors duration-150 group/item border-l-2 overflow-hidden ${
                            isActive(l.href)
                              ? 'bg-[#6a34d1]/8 border-[#6a34d1]'
                              : 'border-transparent hover:bg-[#6a34d1]/5 hover:border-[#6a34d1]/50'
                          }`}
                          style={{ animation: 'navItemIn 0.28s ease both', animationDelay: `${60 + i * 30}ms` }}
                          onClick={() => setActiveGroup(null)}
                        >
                          {/* Micro-visual de la herramienta */}
                          <span className={`mt-0.5 flex h-7 w-11 shrink-0 items-center justify-center rounded-[3px] border bg-[#f8f5ef]/50 transition-colors duration-200 ${
                            isActive(l.href) ? 'text-[#6a34d1] border-[#6a34d1]/40' : 'text-[#55506a] border-[#e7dfd0] group-hover/item:text-[#6a34d1] group-hover/item:border-[#6a34d1]/40'
                          }`}>
                            <MiniViz type={l.viz} />
                          </span>

                          <span className="flex min-w-0 flex-col">
                            <span className={`section-label transition-colors ${
                              isActive(l.href) ? 'text-[#6a34d1]' : 'text-[#55506a] group-hover/item:text-[#6a34d1]'
                            }`}>
                              {l.label}
                            </span>
                            <span className="terminal-text text-xs text-[#8b8494] mt-0.5 group-hover/item:text-[#55506a] transition-colors">
                              {l.desc}
                            </span>
                          </span>

                          {/* Flecha que se desliza al hover */}
                          <span className="ml-auto self-center text-[#6a34d1] text-xs opacity-0 -translate-x-1 transition-all duration-200 group-hover/item:opacity-100 group-hover/item:translate-x-0">
                            →
                          </span>
                        </Link>
                      ))}
                    </div>

                    {/* Bottom accent */}
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#6a34d1]/15 to-transparent" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ── Language switcher ──────────────────────────────────────────── */}
          <div className="flex items-center gap-1 border border-[#e7dfd0] rounded-sm overflow-hidden">
            <Link
              href="/"
              className={`terminal-text text-[10px] px-2.5 py-1 transition-colors ${
                !pathname.startsWith('/en') ? 'bg-[#6a34d1] text-white' : 'text-[#55506a] hover:text-[#6a34d1]'
              }`}
            >
              ES
            </Link>
            <Link
              href="/en"
              className={`terminal-text text-[10px] px-2.5 py-1 transition-colors ${
                pathname.startsWith('/en') ? 'bg-[#6a34d1] text-white' : 'text-[#55506a] hover:text-[#6a34d1]'
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
                  className="section-label transition-colors duration-200 text-[#55506a] hover:text-[#6a34d1]"
                >
                  MI CUENTA
                </Link>
                <button
                  onClick={handleSignOut}
                  className="border border-[#6a34d1]/40 px-4 py-2 section-label text-[#6a34d1] hover:bg-[#6a34d1] hover:text-white transition-all duration-200"
                >
                  SALIR
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`section-label transition-colors duration-200 ${
                    isActive('/login') ? 'text-[#6a34d1]' : 'text-[#55506a] hover:text-[#6a34d1]'
                  }`}
                >
                  LOGIN
                </Link>
                <Link
                  href="/registro"
                  className={`border border-[#6a34d1]/40 px-4 py-2 section-label transition-all duration-200 ${
                    isActive('/registro') ? 'bg-[#6a34d1] text-white' : 'text-[#6a34d1] hover:bg-[#6a34d1] hover:text-white'
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
          <span className={`w-5 h-px bg-[#6a34d1] transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`w-5 h-px bg-[#6a34d1] transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-px bg-[#6a34d1] transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* ── Mobile menu ──────────────────────────────────────────────────────── */}
      {/* fixed + top-16/bottom-0: cubre TODO el alto restante de la pantalla,
          para que el contenido de la pagina (hero, etc.) no asome debajo del
          panel cuando este es mas corto que el viewport. */}
      {menuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 h-[calc(100dvh-4rem)] bg-[#ffffff] overflow-y-auto px-6 py-4 flex flex-col gap-1">

          {GROUPS.map(group => (
            <div key={group.id}>
              {/* Group header */}
              <button
                className={`w-full section-label text-left flex items-center justify-between py-3 transition-colors ${
                  groupIsActive(group) ? 'text-[#6a34d1]' : 'text-[#55506a] hover:text-[#6a34d1]'
                }`}
                onClick={() => toggleMobile(group.id)}
              >
                {group.label.toUpperCase()}
                <Chevron open={mobileGroup === group.id} />
              </button>

              {/* Group links */}
              {mobileGroup === group.id && (
                <div className="pl-4 flex flex-col border-l border-[#e7dfd0] mb-1">
                  {group.links.map(l => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`section-label py-2.5 transition-colors ${
                        isActive(l.href) ? 'text-[#6a34d1]' : 'text-[#55506a] hover:text-[#6a34d1]'
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
          <div className="flex items-center gap-2 pt-3 mt-1 border-t border-[#e7dfd0]">
            <span className="terminal-text text-xs text-[#55506a]">Idioma:</span>
            <Link href="/" className={`section-label px-3 py-1 transition-colors ${!pathname.startsWith('/en') ? 'bg-[#6a34d1] text-white' : 'text-[#55506a] hover:text-[#6a34d1] border border-[#e7dfd0]'}`}>ES</Link>
            <Link href="/en" className={`section-label px-3 py-1 transition-colors ${pathname.startsWith('/en') ? 'bg-[#6a34d1] text-white' : 'text-[#55506a] hover:text-[#6a34d1] border border-[#e7dfd0]'}`}>EN</Link>
          </div>

          {/* Auth */}
          <div className="flex flex-col gap-3 pt-3 border-t border-[#e7dfd0]">
            {user ? (
              <>
                <Link href="/perfil" className="section-label text-[#55506a] hover:text-[#6a34d1] transition-colors">
                  MI CUENTA
                </Link>
                <button
                  onClick={handleSignOut}
                  className="border border-[#6a34d1]/40 px-5 py-2.5 section-label text-[#6a34d1] text-center hover:bg-[#6a34d1] hover:text-white transition-all duration-200"
                >
                  SALIR
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="border border-[#6a34d1]/40 px-5 py-2.5 section-label text-[#6a34d1] text-center hover:bg-[#6a34d1] hover:text-white transition-all duration-200"
                >
                  LOGIN
                </Link>
                <Link
                  href="/registro"
                  className="border border-[#6a34d1]/40 px-5 py-2.5 section-label text-[#6a34d1] text-center hover:bg-[#6a34d1] hover:text-white transition-all duration-200"
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
