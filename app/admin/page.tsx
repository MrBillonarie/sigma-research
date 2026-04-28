'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SESSION_KEY  = 'sigma_admin_auth'
const ATTEMPTS_KEY = 'sigma_admin_attempts'
const LOCKOUT_KEY  = 'sigma_admin_lockout'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 15 * 60 * 1000 // 15 minutos

function getLockoutRemaining(): number {
  const until = parseInt(localStorage.getItem(LOCKOUT_KEY) ?? '0', 10)
  return Math.max(0, until - Date.now())
}

function getAttempts(): number {
  return parseInt(localStorage.getItem(ATTEMPTS_KEY) ?? '0', 10)
}

export default function AdminLogin() {
  const router = useRouter()
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(true)
  const [working,   setWorking]   = useState(false)
  const [attempts,  setAttempts]  = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [showPwd,   setShowPwd]   = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      router.replace('/admin/dashboard')
      return
    }
    const rem = getLockoutRemaining()
    setRemaining(rem)
    setAttempts(getAttempts())
    setLoading(false)
  }, [router])

  // Cuenta regresiva del bloqueo
  useEffect(() => {
    if (remaining <= 0) return
    const interval = setInterval(() => {
      const rem = getLockoutRemaining()
      setRemaining(rem)
      if (rem <= 0) {
        localStorage.removeItem(LOCKOUT_KEY)
        localStorage.removeItem(ATTEMPTS_KEY)
        setAttempts(0)
        setError('')
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [remaining])

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (remaining > 0) return

    setWorking(true)
    setError('')

    try {
      const res = await fetch('/api/admin/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const next = getAttempts() + 1
        localStorage.setItem(ATTEMPTS_KEY, String(next))
        setAttempts(next)

        if (next >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_MS
          localStorage.setItem(LOCKOUT_KEY, String(until))
          setRemaining(LOCKOUT_MS)
          setError(`Cuenta bloqueada por ${MAX_ATTEMPTS} intentos fallidos. Intenta en 15 minutos.`)
        } else {
          setError(`${data.error ?? 'Credenciales incorrectas.'} (${MAX_ATTEMPTS - next} intentos restantes)`)
        }
        return
      }

      // Éxito — limpiar contadores
      localStorage.removeItem(ATTEMPTS_KEY)
      localStorage.removeItem(LOCKOUT_KEY)
      sessionStorage.setItem(SESSION_KEY, 'true')
      router.push('/admin/dashboard')
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
    } finally {
      setWorking(false)
    }
  }

  const isLocked  = remaining > 0
  const minsLeft  = Math.ceil(remaining / 60000)
  const secsLeft  = Math.ceil((remaining % 60000) / 1000)

  if (loading) return null

  return (
    <main className="min-h-screen bg-bg bg-grid-pattern bg-grid flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-radial-gold pointer-events-none opacity-20" />

      <div className="relative w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-8 h-8 border border-gold flex items-center justify-center">
            <span className="display-heading text-gold text-sm leading-none">Σ</span>
          </div>
          <span className="display-heading text-xl tracking-widest text-text">SIGMA ADMIN</span>
        </div>

        <div className="glass-card shadow-card overflow-hidden">

          {/* Header */}
          <div className="bg-gold/5 border-b border-gold/20 px-8 py-4 flex items-center justify-between">
            <div>
              <div className="section-label text-gold text-[10px] mb-0.5">// ACCESO RESTRINGIDO</div>
              <h1 className="display-heading text-2xl text-text">PANEL DE CONTROL</h1>
            </div>
            <div className={`w-2 h-2 rounded-full ${isLocked ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
          </div>

          {/* Estado bloqueado */}
          {isLocked ? (
            <div className="px-8 py-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 border border-red-400/30 bg-red-400/5 flex items-center justify-center">
                <span className="text-2xl">🔒</span>
              </div>
              <div>
                <p className="section-label text-red-400 mb-1">ACCESO BLOQUEADO</p>
                <p className="terminal-text text-text-dim text-xs leading-relaxed">
                  Demasiados intentos fallidos.<br />
                  Intenta nuevamente en:
                </p>
              </div>
              <div className="bg-red-400/10 border border-red-400/20 px-6 py-3">
                <span className="display-heading text-3xl text-red-400 num tabular-nums">
                  {String(minsLeft - 1).padStart(2, '0')}:{String(secsLeft).padStart(2, '0')}
                </span>
              </div>
              <p className="terminal-text text-muted text-[10px]">
                Si esto es un error, contacta al administrador del sistema.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="px-8 py-8 flex flex-col gap-5">

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="section-label text-text-dim text-xs">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@sigma.cl"
                  className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
                />
              </div>

              {/* Contraseña */}
              <div className="flex flex-col gap-1.5">
                <label className="section-label text-text-dim text-xs">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 pr-12 terminal-text text-text placeholder:text-muted transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 terminal-text text-xs text-muted hover:text-gold transition-colors"
                    tabIndex={-1}
                  >
                    {showPwd ? 'OCULTAR' : 'VER'}
                  </button>
                </div>
              </div>

              {/* Intentos restantes */}
              {attempts > 0 && !isLocked && (
                <div className="flex items-center gap-2 px-3 py-2 border border-yellow-400/20 bg-yellow-400/5">
                  <span className="text-yellow-400 text-xs">⚠</span>
                  <span className="terminal-text text-yellow-400 text-xs">
                    {MAX_ATTEMPTS - attempts} intento{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} restante{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} antes del bloqueo
                  </span>
                </div>
              )}

              {/* Error */}
              {error && !isLocked && (
                <div className="px-3 py-2 border border-red-400/20 bg-red-400/5">
                  <p className="terminal-text text-red-400 text-xs">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={working || isLocked}
                className="bg-gold text-bg section-label py-3 hover:bg-gold-glow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {working ? 'VERIFICANDO…' : 'ACCEDER AL PANEL'}
              </button>

            </form>
          )}

          {/* Footer de seguridad */}
          <div className="border-t border-border px-8 py-3 flex items-center justify-between">
            <span className="terminal-text text-[10px] text-muted">Sesión segura · Cookie httpOnly</span>
            <span className="terminal-text text-[10px] text-muted">Sigma Research</span>
          </div>
        </div>

        <p className="terminal-text text-center text-[10px] text-muted mt-6">
          Acceso exclusivo para administradores autorizados.
        </p>
      </div>
    </main>
  )
}
