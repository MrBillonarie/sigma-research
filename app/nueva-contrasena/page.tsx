'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'

export default function NuevaContrasenaPage() {
  const router = useRouter()
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [hasSession, setHasSession] = useState(false)

  // Verify user arrived with a valid recovery session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true)
      } else {
        // No session — redirect to recovery form
        router.replace('/recuperar')
      }
    })
  }, [router])

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const { error: sbError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (sbError) {
      setError(sbError.message)
      return
    }

    setDone(true)
    // Auto-redirect to login after 3 s
    setTimeout(() => router.replace('/login'), 3000)
  }

  if (!hasSession) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center">
        <p className="section-label text-text-dim animate-pulse">Verificando sesión…</p>
      </main>
    )
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
          <h1 className="display-heading text-4xl gold-text mb-1">NUEVA CONTRASEÑA</h1>
          <p className="terminal-text text-text-dim mb-8">
            Elige una contraseña segura de al menos 8 caracteres.
          </p>

          {done ? (
            <div className="flex flex-col gap-3 border border-gold/30 bg-gold/5 px-5 py-4">
              <p className="section-label text-gold">✓ CONTRASEÑA ACTUALIZADA</p>
              <p className="terminal-text text-text-dim text-sm">
                Tu contraseña fue cambiada exitosamente. Redirigiendo al login…
              </p>
              <Link href="/login" className="terminal-text text-xs text-gold hover:text-gold-glow transition-colors mt-1">
                → Ir al login ahora
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

              <div className="flex flex-col gap-1.5">
                <label className="section-label text-text-dim">Nueva contraseña</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
                />
              </div>

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
              </div>

              {error && (
                <p className="terminal-text text-red-400 text-xs border border-red-400/20 bg-red-400/5 px-3 py-2">
                  ✗ {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="bg-gold text-bg section-label py-3 hover:bg-gold-glow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'GUARDANDO…' : 'GUARDAR CONTRASEÑA'}
              </button>
            </form>
          )}
        </div>

      </div>
    </main>
  )
}
