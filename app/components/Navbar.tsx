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
  // Sitio público oscuro (Cyan Deck) en todas las páginas de marketing.
  // (El dashboard/admin no montan este Navbar; ver ConditionalShell.)
  const L = true

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
        scrolled || menuOpen
          ? (L ? 'bg-[#0a0c12]/90 backdrop-blur-md border-b border-white/10' : 'bg-[#f8f5ef]/95 backdrop-blur-md border-b border-[#e7dfd0]')
          : 'bg-transparent'
      }`}
    >
      {/* Coreografía del mega-menu: panel con fade+slide+escala, items en cascada,
          barrido dorado al hover. Respetando prefers-reduced-motion. */}
      <style>{`
        @keyframes navPanelIn { from { opacity: 0; transform: translateY(7px) scale(0.985); } to { opacity: 1; transform: none; } }
        @keyframes navItemIn  { from { opacity: 0; transform: translateX(-7px); } to { opacity: 1; transform: none; } }
        .nav-sweep::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(100deg, transparent 32%, rgba(23,21,15,0.06) 50%, transparent 68%);
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
          <div className={`w-7 h-7 flex items-center justify-center border ${L ? 'border-[#39e2e6]' : 'border-[#2ab8bd]'}`}>
            <span className={`display-heading text-sm leading-none ${L ? 'text-[#39e2e6]' : 'text-[#2ab8bd]'}`}>Σ</span>
          </div>
          <span className={`display-heading text-xl tracking-widest ${L ? 'text-[#39e2e6]' : 'text-[#2ab8bd]'}`}>SQUANT DESK</span>
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
                  L
                    ? (groupIsActive(group) ? 'text-white' : 'text-[#9aa4b6] hover:text-[#39e2e6]')
                    : (groupIsActive(group) ? 'text-[#17150f]' : 'text-[#55506a] hover:text-[#17150f]')
                }`}
              >
                {group.label.toUpperCase()}
                <Chevron open={activeGroup === group.id} />
              </button>

              {/* Dropdown — mega-menu con marco terminal y entrada coreografiada */}
              {activeGroup === group.id && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3">
                  <div
                    className={`relative overflow-hidden backdrop-blur-xl border shadow-[0_18px_50px_-12px_rgba(0,0,0,0.8)] ${L ? 'bg-[#0c0f16]/95 border-white/12' : 'bg-[#ffffff]/90 border-[#17150f]/20'}`}
                    style={{
                      width: group.id === 'herramientas' ? 460 : 290,
                      animation: 'navPanelIn 0.18s cubic-bezier(0.16,1,0.3,1) both',
                    }}
                  >
                    {/* Corner brackets — mira de terminal */}
                    <span className={`pointer-events-none absolute top-0 left-0 w-3 h-3 border-t border-l ${L ? 'border-[#39e2e6]/60' : 'border-[#17150f]/70'}`} />
                    <span className={`pointer-events-none absolute top-0 right-0 w-3 h-3 border-t border-r ${L ? 'border-[#39e2e6]/60' : 'border-[#17150f]/70'}`} />
                    <span className={`pointer-events-none absolute bottom-0 left-0 w-3 h-3 border-b border-l ${L ? 'border-[#39e2e6]/60' : 'border-[#17150f]/70'}`} />
                    <span className={`pointer-events-none absolute bottom-0 right-0 w-3 h-3 border-b border-r ${L ? 'border-[#39e2e6]/60' : 'border-[#17150f]/70'}`} />

                    {/* Scan line */}
                    <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent ${L ? 'via-[#39e2e6]/50' : 'via-[#17150f]/50'}`} />

                    {/* Header label */}
                    <div className={`px-4 pt-3 pb-2 border-b ${L ? 'border-white/10' : 'border-[#17150f]/8'}`}>
                      <span className={`terminal-text text-[9px] tracking-[0.35em] uppercase ${L ? 'text-[#39e2e6]/70' : 'text-[#17150f]/50'}`}>
                        {`// ${group.label}`}
                      </span>
                    </div>

                    <div className={group.id === 'herramientas' ? 'grid grid-cols-2 py-1' : 'flex flex-col py-1'}>
                      {group.links.map((l, i) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={`nav-sweep relative flex items-start gap-3 px-4 py-3 transition-colors duration-150 group/item border-l-2 overflow-hidden ${
                            L
                              ? (isActive(l.href) ? 'bg-[#39e2e6]/10 border-[#39e2e6]' : 'border-transparent hover:bg-white/5 hover:border-[#39e2e6]/50')
                              : (isActive(l.href) ? 'bg-[#17150f]/8 border-[#17150f]' : 'border-transparent hover:bg-[#17150f]/5 hover:border-[#17150f]/50')
                          }`}
                          style={{ animation: 'navItemIn 0.28s ease both', animationDelay: `${60 + i * 30}ms` }}
                          onClick={() => setActiveGroup(null)}
                        >
                          {/* Micro-visual de la herramienta */}
                          <span className={`mt-0.5 flex h-7 w-11 shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-200 ${
                            L
                              ? (isActive(l.href) ? 'bg-white/5 text-[#39e2e6] border-[#39e2e6]/40' : 'bg-white/5 text-[#9aa4b6] border-white/12 group-hover/item:text-[#39e2e6] group-hover/item:border-[#39e2e6]/40')
                              : (isActive(l.href) ? 'bg-[#f8f5ef]/50 text-[#17150f] border-[#17150f]/40' : 'bg-[#f8f5ef]/50 text-[#55506a] border-[#e7dfd0] group-hover/item:text-[#17150f] group-hover/item:border-[#17150f]/40')
                          }`}>
                            <MiniViz type={l.viz} />
                          </span>

                          <span className="flex min-w-0 flex-col">
                            <span className={`section-label transition-colors ${
                              L
                                ? (isActive(l.href) ? 'text-white' : 'text-[#9aa4b6] group-hover/item:text-white')
                                : (isActive(l.href) ? 'text-[#17150f]' : 'text-[#55506a] group-hover/item:text-[#17150f]')
                            }`}>
                              {l.label}
                            </span>
                            <span className={`terminal-text text-xs mt-0.5 transition-colors ${L ? 'text-[#6b7688] group-hover/item:text-[#9aa4b6]' : 'text-[#8b8494] group-hover/item:text-[#55506a]'}`}>
                              {l.desc}
                            </span>
                          </span>

                          {/* Flecha que se desliza al hover */}
                          <span className={`ml-auto self-center text-xs opacity-0 -translate-x-1 transition-all duration-200 group-hover/item:opacity-100 group-hover/item:translate-x-0 ${L ? 'text-[#39e2e6]' : 'text-[#17150f]'}`}>
                            →
                          </span>
                        </Link>
                      ))}
                    </div>

                    {/* Bottom accent */}
                    <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent ${L ? 'via-[#39e2e6]/20' : 'via-[#17150f]/15'}`} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ── Language switcher ──────────────────────────────────────────── */}
          <div className={`flex items-center gap-1 rounded-sm overflow-hidden border ${L ? 'border-white/15' : 'border-[#e7dfd0]'}`}>
            <Link
              href="/"
              className={`terminal-text text-[10px] px-2.5 py-1 transition-colors ${
                !pathname.startsWith('/en')
                  ? (L ? 'bg-[#39e2e6] text-[#04121e]' : 'bg-[#17150f] text-white')
                  : (L ? 'text-[#9aa4b6] hover:text-white' : 'text-[#55506a] hover:text-[#17150f]')
              }`}
            >
              ES
            </Link>
            <Link
              href="/en"
              className={`terminal-text text-[10px] px-2.5 py-1 transition-colors ${
                pathname.startsWith('/en')
                  ? (L ? 'bg-[#39e2e6] text-[#04121e]' : 'bg-[#17150f] text-white')
                  : (L ? 'text-[#9aa4b6] hover:text-white' : 'text-[#55506a] hover:text-[#17150f]')
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
                  className={`section-label transition-colors duration-200 ${L ? 'text-[#9aa4b6] hover:text-white' : 'text-[#55506a] hover:text-[#17150f]'}`}
                >
                  MI CUENTA
                </Link>
                <button
                  onClick={handleSignOut}
                  className={`px-4 py-2 section-label border transition-all duration-200 ${L ? 'border-[#39e2e6]/50 text-[#39e2e6] hover:bg-[#39e2e6] hover:text-[#04121e]' : 'border-[#17150f]/40 text-[#17150f] hover:bg-[#17150f] hover:text-white'}`}
                >
                  SALIR
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`section-label transition-colors duration-200 ${
                    L
                      ? (isActive('/login') ? 'text-white' : 'text-[#9aa4b6] hover:text-white')
                      : (isActive('/login') ? 'text-[#17150f]' : 'text-[#55506a] hover:text-[#17150f]')
                  }`}
                >
                  LOGIN
                </Link>
                <Link
                  href="/registro"
                  className={`px-4 py-2 section-label border transition-all duration-200 ${
                    L
                      ? (isActive('/registro') ? 'bg-[#39e2e6] text-[#04121e] border-[#39e2e6]' : 'border-[#39e2e6]/50 text-[#39e2e6] hover:bg-[#39e2e6] hover:text-[#04121e]')
                      : (isActive('/registro') ? 'bg-[#17150f] text-white border-[#17150f]/40' : 'border-[#17150f]/40 text-[#17150f] hover:bg-[#17150f] hover:text-white')
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
          <span className={`w-5 h-px transition-all duration-200 ${L ? 'bg-white' : 'bg-[#17150f]'} ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`w-5 h-px transition-all duration-200 ${L ? 'bg-white' : 'bg-[#17150f]'} ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-px transition-all duration-200 ${L ? 'bg-white' : 'bg-[#17150f]'} ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* ── Mobile menu ──────────────────────────────────────────────────────── */}
      {/* fixed + top-16/bottom-0: cubre TODO el alto restante de la pantalla,
          para que el contenido de la pagina (hero, etc.) no asome debajo del
          panel cuando este es mas corto que el viewport. */}
      {menuOpen && (
        <div className={`md:hidden fixed inset-x-0 top-16 h-[calc(100dvh-4rem)] overflow-y-auto px-6 py-4 flex flex-col gap-1 ${L ? 'bg-[#0a0c12]' : 'bg-[#ffffff]'}`}>

          {GROUPS.map(group => (
            <div key={group.id}>
              {/* Group header */}
              <button
                className={`w-full section-label text-left flex items-center justify-between py-3 transition-colors ${
                  L
                    ? (groupIsActive(group) ? 'text-white' : 'text-[#9aa4b6] hover:text-[#39e2e6]')
                    : (groupIsActive(group) ? 'text-[#17150f]' : 'text-[#55506a] hover:text-[#17150f]')
                }`}
                onClick={() => toggleMobile(group.id)}
              >
                {group.label.toUpperCase()}
                <Chevron open={mobileGroup === group.id} />
              </button>

              {/* Group links */}
              {mobileGroup === group.id && (
                <div className={`pl-4 flex flex-col mb-1 border-l ${L ? 'border-white/12' : 'border-[#e7dfd0]'}`}>
                  {group.links.map(l => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`section-label py-2.5 transition-colors ${
                        L
                          ? (isActive(l.href) ? 'text-white' : 'text-[#9aa4b6] hover:text-[#39e2e6]')
                          : (isActive(l.href) ? 'text-[#17150f]' : 'text-[#55506a] hover:text-[#17150f]')
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
          <div className={`flex items-center gap-2 pt-3 mt-1 border-t ${L ? 'border-white/10' : 'border-[#e7dfd0]'}`}>
            <span className={`terminal-text text-xs ${L ? 'text-[#9aa4b6]' : 'text-[#55506a]'}`}>Idioma:</span>
            <Link href="/" className={`section-label px-3 py-1 transition-colors ${!pathname.startsWith('/en') ? (L ? 'bg-[#39e2e6] text-[#04121e]' : 'bg-[#17150f] text-white') : (L ? 'text-[#9aa4b6] hover:text-white border border-white/15' : 'text-[#55506a] hover:text-[#17150f] border border-[#e7dfd0]')}`}>ES</Link>
            <Link href="/en" className={`section-label px-3 py-1 transition-colors ${pathname.startsWith('/en') ? (L ? 'bg-[#39e2e6] text-[#04121e]' : 'bg-[#17150f] text-white') : (L ? 'text-[#9aa4b6] hover:text-white border border-white/15' : 'text-[#55506a] hover:text-[#17150f] border border-[#e7dfd0]')}`}>EN</Link>
          </div>

          {/* Auth */}
          <div className={`flex flex-col gap-3 pt-3 border-t ${L ? 'border-white/10' : 'border-[#e7dfd0]'}`}>
            {(() => {
              const authCls = L
                ? 'border border-[#39e2e6]/50 px-5 py-2.5 section-label text-[#39e2e6] text-center hover:bg-[#39e2e6] hover:text-[#04121e] transition-all duration-200'
                : 'border border-[#17150f]/40 px-5 py-2.5 section-label text-[#17150f] text-center hover:bg-[#17150f] hover:text-white transition-all duration-200'
              const linkCls = L ? 'section-label text-[#9aa4b6] hover:text-white transition-colors' : 'section-label text-[#55506a] hover:text-[#17150f] transition-colors'
              return user ? (
              <>
                <Link href="/perfil" className={linkCls}>
                  MI CUENTA
                </Link>
                <button onClick={handleSignOut} className={authCls}>
                  SALIR
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={authCls}>
                  LOGIN
                </Link>
                <Link href="/registro" className={authCls}>
                  REGISTRO
                </Link>
              </>
            )
            })()}
          </div>
        </div>
      )}
    </nav>
  )
}
