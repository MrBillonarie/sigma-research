'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [remember,   setRemember]   = useState(false)
  const [errors,     setErrors]     = useState<Record<string, string>>({})
  const [submitted,  setSubmitted]  = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email no válido.'
    if (password.length < 8) e.password = 'Mínimo 8 caracteres.'
    return e
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    // TODO: conectar a API de autenticación
    console.log({ email, password, remember })
    setSubmitted(true)
  }

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

        <div className="glass-card p-8 shadow-card">
          <h1 className="display-heading text-4xl gold-text mb-1">ACCESO TERMINAL</h1>
          <p className="terminal-text text-text-dim mb-8">Introduce tus credenciales para continuar.</p>

          {submitted ? (
            <div className="border border-gold/30 bg-gold/5 px-4 py-3">
              <p className="terminal-text text-gold">Funcionalidad pendiente de backend.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="section-label text-text-dim">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="operador@sigma.io"
                  className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
                />
                {errors.email && (
                  <span className="terminal-text text-red-400 text-xs">{errors.email}</span>
                )}
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="section-label text-text-dim">Contraseña</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
                />
                {errors.password && (
                  <span className="terminal-text text-red-400 text-xs">{errors.password}</span>
                )}
              </div>

              {/* Recordarme */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="w-4 h-4 accent-gold cursor-pointer"
                />
                <span className="terminal-text text-text-dim">Recordarme</span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                className="mt-1 bg-gold text-bg section-label py-3 hover:bg-gold-glow transition-colors duration-200"
              >
                INICIAR SESIÓN
              </button>

              {/* Olvidé contraseña */}
              <p className="terminal-text text-center">
                <Link href="/recuperar" className="text-text-dim hover:text-gold transition-colors">
                  ¿Olvidaste tu contraseña?
                </Link>
              </p>
            </form>
          )}
        </div>

        {/* Link a registro */}
        <p className="terminal-text text-center text-text-dim mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="text-gold hover:text-gold-glow transition-colors">
            CREAR CUENTA
          </Link>
        </p>
      </div>
    </main>
  )
}
