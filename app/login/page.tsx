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
    <div className="sigma-login-card relative p-8 overflow-hidden">
      <style>{`
        /* ── Tarjeta institucional Cyan Deck — sobria, sin efectos ─────────── */
        .sigma-login-card {
          background: #0a0e17;
          border: 1px solid rgba(120,150,175,0.14);
          border-radius: 10px;
          box-shadow: 0 24px 60px -34px rgba(0,0,0,0.85);
        }
        /* Única acentuación: hairline cian al tope, discreto */
        .sigma-login-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(57,226,230,0.55) 50%, transparent);
        }
        .sigma-login-card > * { position: relative; z-index: 1; }
        /* Inputs con focus cian sutil */
        .sigma-input { border-radius: 6px; }
        .sigma-input:focus {
          border-color: rgba(57,226,230,0.55) !important;
          box-shadow: 0 0 0 2px rgba(57,226,230,0.10);
        }
        /* Botón principal — cian sólido, plano y preciso */
        .sigma-submit {
          border: none; color: #04121a; font-weight: 700;
          background: #39e2e6;
          transition: background .2s ease, box-shadow .2s ease;
        }
        .sigma-submit:hover:not(:disabled) { background: #5eeaf0; box-shadow: 0 6px 22px -12px rgba(57,226,230,0.7); }
        .sigma-submit:disabled { opacity: .7; }
        .sigma-submit.is-granted { background: #34d399; color: #04120c; }
      `}</style>

      <h1 className="display-heading text-4xl mb-1" style={{ color: '#e8f2f5' }}>ACCESO TERMINAL</h1>
      <p className="terminal-text text-[#7d94a8] mb-8">Introduce tus credenciales para continuar.</p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="section-label text-[#7d94a8]">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="operador@sigma.io"
            className="sigma-input bg-[#080c15] border border-[#16203a] outline-none px-4 py-2.5 terminal-text text-[#e8f2f5] placeholder:text-[#3a4763] transition-colors"
          />
          {errors.email && <span className="terminal-text text-red-400 text-xs">{errors.email}</span>}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label className="section-label text-[#7d94a8]">Contraseña</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="sigma-input bg-[#080c15] border border-[#16203a] outline-none px-4 py-2.5 terminal-text text-[#e8f2f5] placeholder:text-[#3a4763] transition-colors"
          />
          {errors.password && <span className="terminal-text text-red-400 text-xs">{errors.password}</span>}
        </div>

        {/* Recuperar contraseña — la sesión siempre queda guardada en este
            navegador (no hay opción real de "sesión temporal" en este
            esquema de cookies), así que no se ofrece un toggle que no haría nada. */}
        <div className="flex items-center justify-end">
          <Link href="/recuperar" className="terminal-text text-xs text-[#7d94a8] hover:text-[#39e2e6] transition-colors">
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
          <div className="border border-[#39e2e6]/30 bg-[#39e2e6]/5 px-4 py-2.5 flex flex-col gap-2 rounded-lg">
            <p className="terminal-text text-[#7d94a8] text-xs">¿No te llegó el correo de confirmación?</p>
            <button
              type="button" onClick={handleResendConfirmation} disabled={resending}
              className="terminal-text text-xs text-[#39e2e6] hover:text-[#5eeaf0] transition-colors text-left disabled:opacity-50"
            >
              {resending ? 'Enviando…' : 'Reenviar email de confirmación'}
            </button>
            {resendMsg && <p className="terminal-text text-[#7d94a8] text-xs">{resendMsg}</p>}
          </div>
        )}

        {/* Submit — con secuencia de acceso tipo terminal */}
        <button
          type="submit"
          disabled={loading}
          className={`sigma-submit mt-1 section-label py-3 rounded-lg transition-all duration-300 disabled:cursor-not-allowed ${
            phase === 'granted' || phase === 'opening' ? 'is-granted' : ''
          }`}
        >
          {phase === 'verifying' ? '> VERIFICANDO CREDENCIALES…'
            : phase === 'granted' ? '✓ ACCESO CONCEDIDO'
            : phase === 'opening' ? '> ABRIENDO TERMINAL…'
            : 'INICIAR SESIÓN'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(57,226,230,0.22), transparent)' }} />
          <span className="terminal-text text-xs text-[#3a4763]">o continúa con</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(57,226,230,0.22), transparent)' }} />
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={gLoading}
          className="flex items-center justify-center gap-3 rounded-lg border border-[#16203a] bg-[#080c15] hover:border-[#39e2e6]/40 hover:bg-[#0b1220] px-4 py-2.5 terminal-text text-[#7d94a8] hover:text-[#e8f2f5] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
    let tphase = 0.9 // fase de la inclinación (cabeceo) — arranca ya inclinada
    let rafId = 0

    function resize() {
      if (!canvas || !ctx) return
      const dpr = window.devicePixelRatio || 1
      canvas.width  = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    function frame() {
      if (!canvas || !ctx) return
      const w = canvas.clientWidth, h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)
      const R  = Math.min(w, h) * 0.40
      const cx = w * 0.56, cy = h * 0.46
      const cosA = Math.cos(angle), sinA = Math.sin(angle)
      const beta = 0.30 * Math.sin(tphase) // cabeceo lento en el eje X
      const cosB = Math.cos(beta), sinB = Math.sin(beta)
      const proj = nodes.map(n => {
        // rotación Y (giro) seguida de inclinación X (cabeceo) → volumen real
        const x1 = n.x * cosA + n.z * sinA
        const z1 = -n.x * sinA + n.z * cosA
        const y2 = n.y * cosB - z1 * sinB
        const z2 = n.y * sinB + z1 * cosB
        const s  = 1.7 / (1.7 + z2)
        return { sx: cx + x1 * R * s, sy: cy + y2 * R * s * 0.92, z: z2, s, sym: n.sym }
      })

      // Aristas — malla tenue: casi imperceptible al fondo, apenas marcada al
      // frente. Presencia técnica de fondo, no protagonista.
      for (const [a, b] of edges) {
        const A = proj[a], B = proj[b]
        const front = Math.max(0, -(A.z + B.z) / 2) // 0 (fondo) .. ~1 (frente)
        const alpha = Math.min(0.03 + front * 0.16, 0.20)
        ctx.strokeStyle = `rgba(120,160,185,${alpha.toFixed(3)})`
        ctx.lineWidth = 0.5 + front * 0.9
        ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke()
      }

      // Nodos: puntos precisos, cian sobrio al frente, azul apagado al fondo.
      // Sin halos ni glow — legibilidad tipo instrumento, no decoración.
      for (const p of proj) {
        const front = Math.max(0, -p.z) // 0 (fondo) .. 1 (frente)
        const rad = 1.4 + p.s * 1.9
        const t = Math.min(front * 1.1, 1)
        const cr = Math.round(60  + (57  - 60)  * t)
        const cg = Math.round(100 + (200 - 100) * t)
        const cb = Math.round(150 + (210 - 150) * t)
        const alpha = Math.min(0.28 + front * 0.5, 0.85)
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(2)})`
        ctx.beginPath(); ctx.arc(p.sx, p.sy, rad, 0, Math.PI * 2); ctx.fill()
        if (p.z < 0.05) {
          ctx.fillStyle = `rgba(150,178,195,${(0.22 + front * 0.4).toFixed(2)})`
          ctx.font = '9px monospace'
          ctx.fillText(p.sym, p.sx + 6, p.sy + 3)
        }
      }

      if (!reduced) { angle += 0.0006; tphase += 0.0042 } // giro lento + cabeceo aún más lento
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
      if (constRef.current)   constRef.current.style.transform   = `translate3d(${(nx * 8).toFixed(1)}px, ${(ny * 6).toFixed(1)}px, 0)`
      if (contentRef.current) contentRef.current.style.transform = `translate3d(${(-nx * 4).toFixed(1)}px, ${(-ny * 3).toFixed(1)}px, 0)`
    })
  }
  function onLeave() {
    for (const ref of [constRef, contentRef]) {
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
      {/* Retícula técnica de fondo — muy tenue, quieta, difuminada al entrar */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(120,160,185,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(120,160,185,0.045) 1px, transparent 1px)',
        backgroundSize: '52px 52px',
        maskImage: 'linear-gradient(90deg, transparent 0, black 30%), radial-gradient(120% 95% at 72% 45%, black, transparent 78%)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0, black 30%), radial-gradient(120% 95% at 72% 45%, black, transparent 78%)',
        WebkitMaskComposite: 'source-in',
        maskComposite: 'intersect',
      }} />

      {/* Capa 1 — constelación de mercados en 3D (tenue, entra difuminada) */}
      <div ref={constRef} className="absolute inset-0" style={{
        ...layerStyle,
        maskImage: 'linear-gradient(90deg, transparent 0, black 28%)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0, black 28%)',
      }}>
        <MarketConstellation />
      </div>

      {/* Velo de unión — la tinta del formulario sangra hacia el panel para
          fundir la costura entre ambas mitades (sin borde duro). */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(90deg, #04050a 0%, rgba(4,5,10,0.55) 16%, rgba(4,5,10,0) 36%)',
      }} />

      {/* Capa 2 — contenido (se mueve en contra: profundidad) */}
      <div ref={contentRef} className="relative z-10 max-w-sm pl-14 pr-8" style={layerStyle}>
        <div className="flex items-center gap-2.5 mb-7">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#0a7f52', boxShadow: '0 0 10px rgba(10,127,82,0.7)' }} />
          <span className="terminal-text text-[10px] tracking-[0.28em]" style={{ color: '#0a7f52' }}>SIGMA ENGINE · OPERANDO</span>
        </div>

        <h2 className="display-heading text-5xl leading-[0.95] mb-5" style={{ textWrap: 'balance', color: '#e8f2f5' }}>
          EL MOTOR<br />
          <span style={{ color: '#39e2e6' }}>NO DUERME.</span>
        </h2>

        <p className="terminal-text text-sm leading-relaxed mb-8" style={{ color: '#7d94a8' }}>
          3 motores · 16 activos · decisiones validadas out-of-sample, las 24 horas.
        </p>

        {live && (
          <div className="flex flex-wrap gap-x-7 gap-y-2 terminal-text text-xs" style={{ color: '#7d94a8' }}>
            <span>RÉGIMEN <span className="font-bold" style={{ color: live.regime?.toUpperCase().includes('BEAR') ? '#f87171' : live.regime?.toUpperCase().includes('BULL') ? '#34d399' : '#39e2e6' }}>{live.regime}</span></span>
            <span><span className="font-bold" style={{ color: '#e8f2f5' }}>{live.signals}</span> SEÑALES ACTIVAS</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex" style={{
      // Cyan Deck: todo oscuro. Ramp horizontal muy gradual (sin escalones) del
      // negro-tinta del formulario al negro-azulado del panel, con un halo cian
      // amplio y difuso detrás de la constelación. La unión se difumina abajo.
      background: 'radial-gradient(150% 130% at 90% 46%, rgba(57,226,230,0.08), rgba(79,146,255,0.035) 42%, transparent 68%), linear-gradient(90deg, #04050a 0%, #04060c 38%, #05080f 58%, #060b15 78%, #07101a 100%)',
      // Tokens Cyan Deck para las clases var-based del formulario (izq).
      ['--bg' as string]: '#04050a', ['--surface' as string]: '#0a0e18',
      ['--border' as string]: '#16203a', ['--border-2' as string]: '#213258',
      ['--gold' as string]: '#39e2e6', ['--gold-glow' as string]: '#5eeaf0',
      ['--text' as string]: '#e8f2f5', ['--text-dim' as string]: '#7d94a8', ['--text-muted' as string]: '#3a4763',
      ['--green' as string]: '#1D9E75', ['--red' as string]: '#f87171',
    }}>

      {/* ── Columna del formulario ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-7 h-7 border flex items-center justify-center rounded-[3px]" style={{ borderColor: '#39e2e6', boxShadow: '0 0 16px -4px rgba(57,226,230,0.6)' }}>
              <span className="display-heading text-sm leading-none" style={{ color: '#39e2e6' }}>Σ</span>
            </div>
            <Link href="/" className="display-heading text-xl tracking-widest text-[#e8f2f5]">
              SQUANT DESK
            </Link>
          </div>

          {/* Suspense required by useSearchParams in Next.js 14 App Router */}
          <Suspense fallback={
            <div className="p-8 flex items-center justify-center rounded-[14px]" style={{ background: 'linear-gradient(180deg, rgba(10,16,26,0.92), rgba(6,10,18,0.96))', border: '1px solid rgba(57,226,230,0.16)' }}>
              <span className="section-label text-[#7d94a8]">Cargando…</span>
            </div>
          }>
            <LoginForm />
          </Suspense>

          <p className="terminal-text text-center text-[#7d94a8] mt-6">
            ¿No tienes cuenta?{' '}
            <Link href="/registro" className="transition-colors" style={{ color: '#39e2e6' }}>
              CREAR CUENTA
            </Link>
          </p>

          {/* Acceso admin — discreto, solo visible para quien lo busca */}
          <div className="mt-10 flex justify-center">
            <Link
              href="/admin"
              className="terminal-text text-xs text-[#3a4763] hover:text-[#39e2e6] transition-colors duration-300 select-none tracking-widest"
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
