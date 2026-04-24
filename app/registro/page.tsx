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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })
    console.log('[Supabase signUp]', { user: data?.user?.id ?? null, error: error ? { message: error.message, status: error.status, code: (error as { code?: string }).code } : null })
    setLoading(false)

    if (error) {
      setErrors({ form: traducirError(error.message) })
      return
    }

    fetch('/api/email/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nombre }),
    }).catch(() => {})

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
            SIGMA RESEARCH
          </Link>
        </div>

        <div className="glass-card p-8 shadow-card">
          <h1 className="display-heading text-4xl gold-text mb-1">CREAR CUENTA</h1>
          <p className="terminal-text text-text-dim mb-8">Únete a la plataforma quant.</p>

          {done ? (
            <div className="flex flex-col gap-3 border border-gold/30 bg-gold/5 px-5 py-4">
              <p className="section-label text-gold">REVISA TU EMAIL</p>
              <p className="terminal-text text-text-dim text-sm">
                Te enviamos un enlace de confirmación a <strong className="text-text">{email}</strong>.
                Confirma tu cuenta para empezar a operar.
              </p>
              <Link href="/login" className="terminal-text text-xs text-gold hover:text-gold-glow transition-colors mt-1">
                ← Ir al login
              </Link>
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

function traducirError(msg: string): string {
  if (msg.includes('User already registered'))  return 'Ya existe una cuenta con ese email.'
  if (msg.includes('Password should be'))       return 'La contraseña no cumple los requisitos mínimos.'
  if (msg.includes('Unable to validate email')) return 'Email no válido.'
  return msg
}
