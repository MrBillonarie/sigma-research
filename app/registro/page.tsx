'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'

export default function RegistroPage() {
  const [nombre,    setNombre]    = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [terms,     setTerms]     = useState(false)
  const [errors,    setErrors]    = useState<Record<string, string>>({})
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [gLoading,  setGLoading]  = useState(false)

  async function handleGoogle() {
    setGLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setErrors({ form: `Error: ${error.message}` })
      setGLoading(false)
    }
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!nombre.trim())                                      e.nombre   = 'El nombre es obligatorio.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))         e.email    = 'Email no válido.'
    if (password.length < 8)                                e.password = 'Mínimo 8 caracteres.'
    if (password !== confirm)                               e.confirm  = 'Las contraseñas no coinciden.'
    if (!terms)                                             e.terms    = 'Debes aceptar los términos.'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, nombre: nombre.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors({ form: data.error ?? 'Error al crear la cuenta. Intenta nuevamente.' })
        return
      }
    } catch {
      setErrors({ form: 'Error de conexión. Intenta nuevamente.' })
      return
    } finally {
      setLoading(false)
    }

    setDone(true)
  }

  return (
    <main className="min-h-screen bg-bg bg-grid-pattern bg-grid flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-7 h-7 border border-gold flex items-center justify-center">
            <span className="display-heading text-gold text-sm leading-none">Σ</span>
          </div>
          <Link href="/" className="display-heading text-xl tracking-widest text-text">
            SQUANT DESK
          </Link>
        </div>

        <div className="glass-card p-8 shadow-card">
          <h1 className="display-heading text-4xl gold-text mb-1">CREAR CUENTA</h1>
          <p className="terminal-text text-text-dim mb-8">Únete a la plataforma quant.</p>

          {done ? (
            <div className="flex flex-col gap-4 border border-gold/30 bg-gold/5 px-5 py-5">
              <p className="section-label text-gold">✓ REVISA TU CORREO</p>
              <p className="terminal-text text-text-dim text-sm leading-relaxed">
                Te enviamos un enlace de confirmación a{' '}
                <strong className="text-text">{email}</strong>.
                Haz clic en el enlace para activar tu cuenta.
              </p>
              <div className="border border-gold/15 bg-admin-bg/30 px-4 py-3">
                <p className="terminal-text text-[11px] text-muted leading-relaxed">
                  ¿No lo ves? Revisa la carpeta de spam. El enlace expira en 24 horas.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

              {/* Nombre */}
              <div className="flex flex-col gap-1.5">
                <label className="section-label text-text-dim">Nombre</label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
                />
                {errors.nombre && <span className="terminal-text text-red-400 text-xs">{errors.nombre}</span>}
              </div>

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
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
                />
                {errors.password && <span className="terminal-text text-red-400 text-xs">{errors.password}</span>}
              </div>

              {/* Confirmar password */}
              <div className="flex flex-col gap-1.5">
                <label className="section-label text-text-dim">Confirmar contraseña</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
                />
                {errors.confirm && <span className="terminal-text text-red-400 text-xs">{errors.confirm}</span>}
              </div>

              {/* Términos */}
              <div className="flex flex-col gap-1">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={e => setTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-gold cursor-pointer shrink-0"
                  />
                  <span className="terminal-text text-text-dim leading-relaxed">
                    Acepto los{' '}
                    <Link href="/terminos" className="text-gold hover:text-gold-glow transition-colors">Términos</Link>
                    {' '}y la{' '}
                    <Link href="/privacidad" className="text-gold hover:text-gold-glow transition-colors">Política de Privacidad</Link>
                  </span>
                </label>
                {errors.terms && <span className="terminal-text text-red-400 text-xs pl-7">{errors.terms}</span>}
              </div>

              {/* Error general */}
              {errors.form && (
                <div className="border border-red-400/30 bg-red-400/5 px-4 py-2.5">
                  <p className="terminal-text text-red-400 text-xs">{errors.form}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 bg-gold text-bg section-label py-3 hover:bg-gold-glow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'CREANDO CUENTA…' : 'REGISTRARME'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="terminal-text text-xs text-muted">o continúa con</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Google OAuth — antes solo existía en /login, asimetría rara
                  para alguien que llega directo a registrarse. */}
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
          )}
        </div>

        <p className="terminal-text text-center text-text-dim mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-gold hover:text-gold-glow transition-colors">
            INICIAR SESIÓN
          </Link>
        </p>
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

