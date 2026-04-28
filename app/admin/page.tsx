'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SESSION_KEY = 'sigma_admin_auth'

export default function AdminLogin() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(true)
  const [working,  setWorking]  = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      router.replace('/admin/dashboard')
    } else {
      setLoading(false)
    }
  }, [router])

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setWorking(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Credenciales incorrectas.')
        return
      }
      sessionStorage.setItem(SESSION_KEY, 'true')
      router.push('/admin/dashboard')
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
    } finally {
      setWorking(false)
    }
  }

  if (loading) return null

  return (
    <main className="min-h-screen bg-bg bg-grid-pattern bg-grid flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-radial-gold pointer-events-none opacity-30" />

      <div className="relative w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-7 h-7 border border-gold flex items-center justify-center">
            <span className="display-heading text-gold text-sm leading-none">Σ</span>
          </div>
          <span className="display-heading text-xl tracking-widest text-text">SIGMA ADMIN</span>
        </div>

        <div className="glass-card p-8 shadow-card">
          <div className="section-label text-gold mb-1">{'// ACCESO RESTRINGIDO'}</div>
          <h1 className="display-heading text-3xl text-text mb-6">PANEL DE CONTROL</h1>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="section-label text-text-dim">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@sigma.cl"
                className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
              />
            </div>

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
            </div>

            {error && (
              <p className="terminal-text text-red-400 text-xs">{error}</p>
            )}

            <button
              type="submit"
              disabled={working}
              className="mt-1 bg-gold text-bg section-label py-3 hover:bg-gold-glow transition-colors duration-200 disabled:opacity-60"
            >
              {working ? 'VERIFICANDO…' : 'ACCEDER'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
