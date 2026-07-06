'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'

// useSearchParams() requires a Suspense boundary in Next.js 14 App Router
function LoginForm() {
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') ?? '/home'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [errors,   setErrors]   = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [resending,    setResending]    = useState(false)
  const [resendMsg,     setResendMsg]   = useState('')
  // Secuencia de acceso tipo terminal en el botón de submit
  const [phase, setPhase] = useState<null | 'verifying' | 'granted' | 'opening'>(null)

  // El link de confirmación/recuperación puede llegar acá expirado o ya
  // usado (app/auth/callback/route.ts lo manda con ?error=...) — antes este
  // flag se perdía en silencio, el usuario hacía clic y no entendía por qué
  // aterrizaba en un login limpio sin ningún aviso.
  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'auth_callback_error') {
      setErrors({ form: 'El enlace ya fue usado o expiró. Si era de confirmación, puedes reenviarlo abajo; si era de recuperación, pide uno nuevo en "¿Olvidaste tu contraseña?".' })
    }
  }, [searchParams])

  function validate() {
    const e: Record<string, string> = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email    = 'Email no válido.'
    if (password.length < 8)                        e.password = 'Mínimo 8 caracteres.'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    setPhase('verifying')
    setNeedsConfirm(false)
    setResendMsg('')

    // Pre-flight de rate limit propio — antes el login dependía 100% del
    // límite nativo (no configurable) de Supabase contra fuerza bruta de
    // contraseña. Si el guard falla por su cuenta, no bloquea el login (la
    // red de seguridad nativa de Supabase sigue de fondo).
    try {
      const guardRes = await fetch('/api/auth/login-guard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (guardRes.status === 429) {
        const j = await guardRes.json().catch(() => ({}))
        setLoading(false)
        setPhase(null)
        setErrors({ form: j.error ?? 'Demasiados intentos. Espera unos minutos.' })
        return
      }
    } catch { /* si el guard no responde, seguir con el login normal */ }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoading(false)
      setPhase(null)
      setErrors({ form: traducirError(error) })
      if (error.message?.includes('Email not confirmed') || (error as { code?: string }).code === 'email_not_confirmed') {
        setNeedsConfirm(true)
      }
      return
    }

    // Ceremonia de entrada: la sesión ya existe, la secuencia solo acompaña
    // el redirect (que igual tomaría unos cientos de ms).
    setPhase('granted')
    await new Promise(r => setTimeout(r, 650))
    setPhase('opening')
    await new Promise(r => setTimeout(r, 550))

    // Hard navigation so the browser sends cookies in the new request,
    // letting the middleware verify the session correctly.
    window.location.href = safeRedirect(next)
  }

  async function handleResendConfirmation() {
    if (!email) { setResendMsg('Escribe tu email arriba primero.'); return }
    setResending(true); setResendMsg('')
    try {
      await fetch('/api/auth/resend-confirmation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setResendMsg('Si tu cuenta existe, te enviamos un nuevo enlace de confirmación.')
    } catch {
      setResendMsg('No se pudo enviar. Intenta de nuevo en un momento.')
    }
    setResending(false)
  }

  async function handleGoogle() {
    setGLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setErrors({ form: traducirError(error) })
      setGLoading(false)
    }
  }

  return (
    <div className="glass-card p-8 shadow-card">
      <h1 className="display-heading text-4xl gold-text mb-1">ACCESO TERMINAL</h1>
      <p className="terminal-text text-[#7a7f9a] mb-8">Introduce tus credenciales para continuar.</p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="section-label text-[#7a7f9a]">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="operador@sigma.io"
            className="bg-[#0b0d14] border border-[#1a1d2e] focus:border-[#d4af37]/60 outline-none px-4 py-2.5 terminal-text text-[#e8e9f0] placeholder:text-[#3a3f55] transition-colors"
          />
          {errors.email && <span className="terminal-text text-red-400 text-xs">{errors.email}</span>}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label className="section-label text-[#7a7f9a]">Contraseña</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-[#0b0d14] border border-[#1a1d2e] focus:border-[#d4af37]/60 outline-none px-4 py-2.5 terminal-text text-[#e8e9f0] placeholder:text-[#3a3f55] transition-colors"
          />
          {errors.password && <span className="terminal-text text-red-400 text-xs">{errors.password}</span>}
        </div>

        {/* Recuperar contraseña — la sesión siempre queda guardada en este
            navegador (no hay opción real de "sesión temporal" en este
            esquema de cookies), así que no se ofrece un toggle que no haría nada. */}
        <div className="flex items-center justify-end">
          <Link href="/recuperar" className="terminal-text text-xs text-[#7a7f9a] hover:text-[#d4af37] transition-colors">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {/* Error general */}
        {errors.form && (
          <div className="border border-red-400/30 bg-red-400/5 px-4 py-2.5">
            <p className="terminal-text text-red-400 text-xs">{errors.form}</p>
          </div>
        )}

        {/* Reenviar confirmación — antes solo un admin podía dispararlo;
            cualquier email perdido/en spam dejaba al usuario sin salida. */}
        {needsConfirm && (
          <div className="border border-[#d4af37]/30 bg-[#d4af37]/5 px-4 py-2.5 flex flex-col gap-2">
            <p className="terminal-text text-[#7a7f9a] text-xs">¿No te llegó el correo de confirmación?</p>
            <button
              type="button" onClick={handleResendConfirmation} disabled={resending}
              className="terminal-text text-xs text-[#d4af37] hover:text-[#f0cc5a] transition-colors text-left disabled:opacity-50"
            >
              {resending ? 'Enviando…' : 'Reenviar email de confirmación'}
            </button>
            {resendMsg && <p className="terminal-text text-[#7a7f9a] text-xs">{resendMsg}</p>}
          </div>
        )}

        {/* Submit — con secuencia de acceso tipo terminal */}
        <button
          type="submit"
          disabled={loading}
          className={`mt-1 section-label py-3 transition-all duration-300 disabled:cursor-not-allowed ${
            phase === 'granted' || phase === 'opening'
              ? 'bg-emerald-400 text-[#04050a]'
              : 'bg-[#d4af37] text-[#04050a] hover:bg-[#f0cc5a] disabled:opacity-70'
          }`}
        >
          {phase === 'verifying' ? '> VERIFICANDO CREDENCIALES…'
            : phase === 'granted' ? '✓ ACCESO CONCEDIDO'
            : phase === 'opening' ? '> ABRIENDO TERMINAL…'
            : 'INICIAR SESIÓN'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="terminal-text text-xs text-[#3a3f55]">o continúa con</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={gLoading}
          className="flex items-center justify-center gap-3 border border-[#1a1d2e] bg-[#0b0d14] hover:border-[#d4af37]/40 px-4 py-2.5 terminal-text text-[#7a7f9a] hover:text-[#e8e9f0] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleIcon />
          {gLoading ? 'Redirigiendo…' : 'Continuar con Google'}
        </button>
      </form>
    </div>
  )
}

// ─── Constelación de mercados en 3D ──────────────────────────────────────────
// Los 16 activos del motor como nodos sobre una esfera (fibonacci) rotando
// lentamente, con conexiones entre vecinos y pulsos dorados viajando por las
// aristas — el motor conectando mercados, literal.
const CONSTELLATION_ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'LTC', 'XAU', 'XAG', 'WTI', 'NG', 'HG', 'PL', 'AAPL', 'NVDA', 'TSLA', 'JPM', 'XOM']

function MarketConstellation() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const N = CONSTELLATION_ASSETS.length
    const nodes = CONSTELLATION_ASSETS.map((sym, i) => {
      const y   = 1 - (i / (N - 1)) * 2
      const r   = Math.sqrt(1 - y * y)
      const phi = i * 2.399963 // ángulo áureo
      return { sym, x: Math.cos(phi) * r, y, z: Math.sin(phi) * r }
    })
    const edges: [number, number][] = []
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, dz = nodes[i].z - nodes[j].z
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 0.95) edges.push([i, j])
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let angle = 0.6
    let rafId = 0
    let pulse: { edge: [number, number]; t: number } | null = null
    let lastPulse = 0

    function resize() {
      if (!canvas || !ctx) return
      const dpr = window.devicePixelRatio || 1
      canvas.width  = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    function frame(ts: number) {
      if (!canvas || !ctx) return
      const w = canvas.clientWidth, h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)
      const R  = Math.min(w, h) * 0.34
      const cx = w * 0.52, cy = h * 0.42
      const cos = Math.cos(angle), sin = Math.sin(angle)
      const proj = nodes.map(n => {
        const x = n.x * cos + n.z * sin
        const z = -n.x * sin + n.z * cos
        const s = 1.6 / (1.6 + z)
        return { sx: cx + x * R * s, sy: cy + n.y * R * s * 0.92, z, s, sym: n.sym }
      })

      // Aristas — más brillantes cuanto más al frente
      for (const [a, b] of edges) {
        const A = proj[a], B = proj[b]
        const alpha = Math.max(0.02, 0.24 - (A.z + B.z) * 0.09)
        ctx.strokeStyle = `rgba(212,175,55,${alpha.toFixed(3)})`
        ctx.lineWidth = 0.7
        ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke()
      }

      // Pulso dorado viajando por una arista (una señal cruzando el motor)
      if (!reduced) {
        if (!pulse && ts - lastPulse > 1500) {
          pulse = { edge: edges[Math.floor(Math.random() * edges.length)], t: 0 }
          lastPulse = ts
        }
        if (pulse) {
          const [a, b] = pulse.edge
          const A = proj[a], B = proj[b]
          const px = A.sx + (B.sx - A.sx) * pulse.t
          const py = A.sy + (B.sy - A.sy) * pulse.t
          ctx.fillStyle = 'rgba(212,175,55,0.95)'
          ctx.shadowColor = 'rgba(212,175,55,0.9)'
          ctx.shadowBlur = 9
          ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill()
          ctx.shadowBlur = 0
          pulse.t += 0.018
          if (pulse.t >= 1) pulse = null
        }
      }

      // Nodos + etiquetas frontales
      for (const p of proj) {
        const alpha = Math.min(0.35 + Math.max(0, -p.z) * 0.6, 0.95)
        ctx.fillStyle = `rgba(212,175,55,${alpha.toFixed(2)})`
        ctx.beginPath(); ctx.arc(p.sx, p.sy, 1.5 + p.s * 1.4, 0, Math.PI * 2); ctx.fill()
        if (p.z < 0.1) {
          ctx.fillStyle = `rgba(232,233,240,${(0.22 + Math.max(0, -p.z) * 0.5).toFixed(2)})`
          ctx.font = '9px monospace'
          ctx.fillText(p.sym, p.sx + 6, p.sy + 3)
        }
      }

      if (!reduced) angle += 0.0016
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="w-full h-full" aria-hidden />
}

// ─── Panel derecho: escena 3D del motor (solo desktop) ───────────────────────
function LivePanel() {
  const [live, setLive] = useState<{ regime: string; signals: number } | null>(null)
  const panelRef   = useRef<HTMLDivElement>(null)
  const constRef   = useRef<HTMLDivElement>(null)
  const floorRef   = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const rafRef     = useRef<number | null>(null)

  useEffect(() => {
    fetch('/api/vps/signals', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.regime) {
          setLive({
            regime:  String(d.regime).toUpperCase(),
            signals: Array.isArray(d.signals) ? d.signals.length : 0,
          })
        }
      })
      .catch(() => {})
  }, [])

  // Parallax por capas: cada plano se desplaza a su propia profundidad
  function onMove(e: React.MouseEvent) {
    const el = panelRef.current
    if (!el || rafRef.current) return
    const r  = el.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      if (constRef.current)   constRef.current.style.transform   = `translate3d(${(nx * 16).toFixed(1)}px, ${(ny * 12).toFixed(1)}px, 0)`
      if (floorRef.current)   floorRef.current.style.transform   = `translate3d(${(nx * 7).toFixed(1)}px, ${(ny * 5).toFixed(1)}px, 0)`
      if (contentRef.current) contentRef.current.style.transform = `translate3d(${(-nx * 9).toFixed(1)}px, ${(-ny * 7).toFixed(1)}px, 0)`
    })
  }
  function onLeave() {
    for (const ref of [constRef, floorRef, contentRef]) {
      if (ref.current) ref.current.style.transform = 'translate3d(0,0,0)'
    }
  }

  const layerStyle: React.CSSProperties = { transition: 'transform 0.18s ease-out', willChange: 'transform' }

  return (
    <div
      ref={panelRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="hidden lg:flex relative w-[46%] overflow-hidden items-center"
    >
      <style>{`
        @keyframes tronMove { from { background-position: 0 0; } to { background-position: 0 44px; } }
        @media (prefers-reduced-motion: reduce) { .tron-floor { animation: none !important; } }
      `}</style>

      {/* Capa 1 — constelación de mercados en 3D */}
      <div ref={constRef} className="absolute inset-0" style={layerStyle}>
        <MarketConstellation />
      </div>

      {/* Capa 2 — suelo Tron en perspectiva */}
      <div ref={floorRef} className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none" style={{ ...layerStyle, perspective: '420px' }}>
        <div
          className="tron-floor absolute top-0"
          style={{
            left: '-40%', right: '-40%', bottom: '-70%',
            transform: 'rotateX(62deg)',
            transformOrigin: 'top center',
            backgroundImage: 'linear-gradient(rgba(212,175,55,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.15) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            animation: 'tronMove 4.5s linear infinite',
            maskImage: 'linear-gradient(to bottom, transparent, black 24%, black 78%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 24%, black 78%, transparent)',
          }}
        />
        {/* Resplandor del horizonte */}
        <div className="absolute inset-x-0 top-0 h-14" style={{ background: 'linear-gradient(to bottom, rgba(212,175,55,0.09), transparent)' }} />
      </div>

      {/* Velo muy sutil solo en el borde izquierdo para asentar las líneas
          doradas sobre la zona de transición — sin crear parche oscuro */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(4,5,10,0.18) 0%, rgba(4,5,10,0.05) 14%, transparent 30%)' }} />

      {/* Capa 3 — contenido (se mueve en contra: profundidad) */}
      <div ref={contentRef} className="relative z-10 max-w-sm pl-14 pr-8" style={layerStyle}>
        <div className="flex items-center gap-2.5 mb-7">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#0a7f52', boxShadow: '0 0 10px rgba(10,127,82,0.7)' }} />
          <span className="terminal-text text-[10px] tracking-[0.28em]" style={{ color: '#0a7f52' }}>SIGMA ENGINE · OPERANDO</span>
        </div>

        <h2 className="display-heading text-5xl leading-[0.95] mb-5" style={{ textWrap: 'balance', color: '#17150f' }}>
          EL MOTOR<br />
          <span style={{ color: '#8a6d15' }}>NO DUERME.</span>
        </h2>

        <p className="terminal-text text-sm leading-relaxed mb-8" style={{ color: '#514c40' }}>
          3 motores · 16 activos · decisiones validadas out-of-sample, las 24 horas.
        </p>

        {live && (
          <div className="flex flex-wrap gap-x-7 gap-y-2 terminal-text text-xs" style={{ color: '#514c40' }}>
            <span>RÉGIMEN <span className="font-bold" style={{ color: live.regime?.toUpperCase().includes('BEAR') ? '#c1322f' : live.regime?.toUpperCase().includes('BULL') ? '#0a7f52' : '#8a6d15' }}>{live.regime}</span></span>
            <span><span className="font-bold" style={{ color: '#17150f' }}>{live.signals}</span> SEÑALES ACTIVAS</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex" style={{
      // Degradé de unión: el formulario (izq) sobre tinta oscura funde
      // suavemente hacia el papel claro del panel del motor (der).
      background: 'linear-gradient(105deg, #04050a 0%, #04050a 30%, #0d0c0a 37%, #1b1811 43%, #2f2a20 48%, #4c463a 53%, #726a59 58%, #9a9280 63%, #c0b9aa 68%, #dcd6ca 74%, #ebe6dc 82%, #efeae1 100%)',
      // Tokens en oscuro para las clases var-based del formulario (izq).
      ['--bg' as string]: '#04050a', ['--surface' as string]: '#0b0d14',
      ['--border' as string]: '#1a1d2e', ['--border-2' as string]: '#252840',
      ['--gold' as string]: '#d4af37', ['--gold-glow' as string]: '#f0cc5a',
      ['--text' as string]: '#e8e9f0', ['--text-dim' as string]: '#7a7f9a', ['--text-muted' as string]: '#3a3f55',
      ['--green' as string]: '#1D9E75', ['--red' as string]: '#f87171',
    }}>

      {/* ── Columna del formulario ── */}
      <div className="flex-1 bg-grid-pattern bg-grid flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-7 h-7 border border-[#d4af37] flex items-center justify-center">
              <span className="display-heading text-[#d4af37] text-sm leading-none">Σ</span>
            </div>
            <Link href="/" className="display-heading text-xl tracking-widest text-[#e8e9f0]">
              SQUANT DESK
            </Link>
          </div>

          {/* Suspense required by useSearchParams in Next.js 14 App Router */}
          <Suspense fallback={
            <div className="glass-card p-8 flex items-center justify-center">
              <span className="section-label text-[#7a7f9a]">Cargando…</span>
            </div>
          }>
            <LoginForm />
          </Suspense>

          <p className="terminal-text text-center text-[#7a7f9a] mt-6">
            ¿No tienes cuenta?{' '}
            <Link href="/registro" className="text-[#d4af37] hover:text-[#f0cc5a] transition-colors">
              CREAR CUENTA
            </Link>
          </p>

          {/* Acceso admin — discreto, solo visible para quien lo busca */}
          <div className="mt-10 flex justify-center">
            <Link
              href="/admin"
              className="terminal-text text-xs text-[#3a3f55] hover:text-[#d4af37] transition-colors duration-300 select-none tracking-widest"
              tabIndex={-1}
            >
              · · ·
            </Link>
          </div>
        </div>
      </div>

      {/* ── Panel del motor en vivo ── */}
      <LivePanel />
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function safeRedirect(url: string): string {
  try {
    const u = new URL(url, window.location.origin)
    return u.origin === window.location.origin ? url : '/home'
  } catch {
    return '/home'
  }
}

function traducirError(error: { message: string; status?: number; code?: string }): string {
  const msg  = error.message ?? ''
  const code = (error as { code?: string }).code ?? ''

  if (code === 'invalid_credentials')             return 'Email o contraseña incorrectos.'
  if (msg.includes('Invalid login credentials'))  return 'Email o contraseña incorrectos.'
  if (msg.includes('invalid_grant'))              return 'Email o contraseña incorrectos.'
  if (code === 'email_not_confirmed')             return 'Confirma tu email antes de ingresar.'
  if (msg.includes('Email not confirmed'))        return 'Confirma tu email antes de ingresar.'
  if (msg.includes('Too many requests'))          return 'Demasiados intentos. Espera unos minutos.'
  if (error.status === 429)                       return 'Demasiados intentos. Espera unos minutos.'
  return `Error: ${msg}`
}
