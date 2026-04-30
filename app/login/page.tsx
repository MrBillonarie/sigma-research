'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'

// useSearchParams() requires a Suspense boundary in Next.js 14 App Router
function LoginForm() {
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') ?? '/terminal'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [errors,   setErrors]   = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(false)
  const [gLoading, setGLoading] = useState(false)

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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      console.error('[Supabase login error]', { message: error.message, status: error.status, code: (error as { code?: string }).code })
      setErrors({ form: traducirError(error) })
      return
    }

    console.log('[Supabase login ok] user:', data.user?.email)
    // Hard navigation so the browser sends cookies in the new request,
    // letting the middleware verify the session correctly.
    window.location.href = next
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
      <p className="terminal-text text-text-dim mb-8">Introduce tus credenciales para continuar.</p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="section-label text-text-dim">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="operador@sigma.io"
            className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
          />
          {errors.email && <span className="terminal-text text-red-400 text-xs">{errors.email}</span>}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label className="section-label text-text-dim">Contraseña</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
          />
          {errors.password && <span className="terminal-text text-red-400 text-xs">{errors.password}</span>}
        </div>

        {/* Recordarme + recuperar */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              className="w-4 h-4 accent-gold cursor-pointer"
            />
            <span className="terminal-text text-text-dim">Recordarme</span>
          </label>
          <Link href="/recuperar" className="terminal-text text-xs text-text-dim hover:text-gold transition-colors">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {/* Error general */}
        {errors.form && (
          <div className="border border-red-400/30 bg-red-400/5 px-4 py-2.5">
            <p className="terminal-text text-red-400 text-xs">{errors.form}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 bg-gold text-bg section-label py-3 hover:bg-gold-glow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'INGRESANDO…' : 'INICIAR SESIÓN'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="terminal-text text-xs text-muted">o continúa con</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={gLoading}
          className="flex items-center justify-center gap-3 border border-border bg-surface hover:border-gold/40 px-4 py-2.5 terminal-text text-text-dim hover:text-text transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleIcon />
          {gLoading ? 'Redirigiendo…' : 'Continuar con Google'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-bg bg-grid-pattern bg-grid flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-7 h-7 border border-gold flex items-center justify-center">
            <span className="display-heading text-gold text-sm leading-none">Σ</span>
          </div>
          <Link href="/" className="display-heading text-xl tracking-widest text-text">
            SIGMA RESEARCH
          </Link>
        </div>

        {/* Suspense required by useSearchParams in Next.js 14 App Router */}
        <Suspense fallback={
          <div className="glass-card p-8 flex items-center justify-center">
            <span className="section-label text-text-dim">Cargando…</span>
          </div>
        }>
          <LoginForm />
        </Suspense>

        <p className="terminal-text text-center text-text-dim mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="text-gold hover:text-gold-glow transition-colors">
            CREAR CUENTA
          </Link>
        </p>

        {/* Acceso admin — discreto, solo visible para quien lo busca */}
        <div className="mt-10 flex justify-center">
          <Link
            href="/admin"
            className="terminal-text text-xs text-muted hover:text-gold transition-colors duration-300 select-none tracking-widest"
            tabIndex={-1}
          >
            · · ·
          </Link>
        </div>
      </div>
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
