'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'

export default function RecuperarPage() {
  const [email,    setEmail]    = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Introduce un email válido.')
      return
    }
    setError('')
    setLoading(true)
    const { error: sbError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback`,
    })
    setLoading(false)

    if (sbError) {
      setError(sbError.message)
      return
    }
    setDone(true)
  }

  return (
    <main className="min-h-screen bg-bg bg-grid-pattern bg-grid flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-7 h-7 border border-gold flex items-center justify-center">
            <span className="display-heading text-gold text-sm leading-none">Σ</span>
          </div>
          <Link href="/" className="display-heading text-xl tracking-widest text-text">
            SIGMA RESEARCH
          </Link>
        </div>

        <div className="glass-card p-8 shadow-card">
          <h1 className="display-heading text-4xl gold-text mb-1">RECUPERAR ACCESO</h1>
          <p className="terminal-text text-text-dim mb-8">
            Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          {done ? (
            <div className="flex flex-col gap-3 border border-gold/30 bg-gold/5 px-5 py-4">
              <p className="section-label text-gold">ENLACE ENVIADO</p>
              <p className="terminal-text text-text-dim text-sm">
                Si existe una cuenta con ese email, recibirás las instrucciones en breve.
                Revisa también tu carpeta de spam.
              </p>
              <Link href="/login" className="terminal-text text-xs text-gold hover:text-gold-glow transition-colors mt-1">
                ← Volver al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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
                {error && <span className="terminal-text text-red-400 text-xs">{error}</span>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-gold text-bg section-label py-3 hover:bg-gold-glow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'ENVIANDO…' : 'ENVIAR ENLACE'}
              </button>
            </form>
          )}
        </div>

        <p className="terminal-text text-center text-text-dim mt-6">
          <Link href="/login" className="text-gold hover:text-gold-glow transition-colors">
            ← Volver al login
          </Link>
        </p>
      </div>
    </main>
  )
}
