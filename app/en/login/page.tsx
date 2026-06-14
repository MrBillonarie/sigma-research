'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'

function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/home'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [errors,   setErrors]   = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email    = 'Invalid email.'
    if (password.length < 8)                        e.password = 'Minimum 8 characters.'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      const msg = error.message.includes('Invalid login') || error.message.includes('invalid_grant')
        ? 'Incorrect email or password.'
        : error.message.includes('Email not confirmed')
        ? 'Please confirm your email before signing in.'
        : error.message.includes('Too many requests')
        ? 'Too many attempts. Please wait a moment.'
        : `Error: ${error.message}`
      setErrors({ form: msg })
      return
    }

    window.location.href = safeRedirect(next)
  }

  return (
    <div className="glass-card p-8 shadow-card">
      <h1 className="display-heading text-4xl gold-text mb-1">SIGN IN</h1>
      <p className="terminal-text text-text-dim mb-8">Enter your credentials to continue.</p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="section-label text-text-dim">Email</label>
          <input type="email" required autoComplete="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
            className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors" />
          {errors.email && <span className="terminal-text text-red-400 text-xs">{errors.email}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="section-label text-text-dim">Password</label>
          <input type="password" required autoComplete="current-password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••"
            className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors" />
          {errors.password && <span className="terminal-text text-red-400 text-xs">{errors.password}</span>}
        </div>

        <div className="flex justify-end">
          <Link href="/recuperar" className="terminal-text text-xs text-text-dim hover:text-gold transition-colors">
            Forgot your password?
          </Link>
        </div>

        {errors.form && (
          <div className="border border-red-400/30 bg-red-400/5 px-4 py-2.5">
            <p className="terminal-text text-red-400 text-xs">{errors.form}</p>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="mt-1 bg-gold text-bg section-label py-3 hover:bg-gold-glow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'SIGNING IN…' : 'SIGN IN'}
        </button>
      </form>
    </div>
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

export default function EnLoginPage() {
  return (
    <main className="min-h-screen bg-bg bg-grid-pattern bg-grid flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-7 h-7 border border-gold flex items-center justify-center">
            <span className="display-heading text-gold text-sm leading-none">Σ</span>
          </div>
          <Link href="/en" className="display-heading text-xl tracking-widest text-text">
            SIGMA RESEARCH
          </Link>
        </div>

        <Suspense fallback={<div className="glass-card p-8 flex items-center justify-center"><span className="section-label text-text-dim">Loading…</span></div>}>
          <LoginForm />
        </Suspense>

        <p className="terminal-text text-center text-text-dim mt-6">
          {"Don't have an account?"}{' '}
          <Link href="/en/registro" className="text-gold hover:text-gold-glow transition-colors">
            CREATE ACCOUNT
          </Link>
        </p>
      </div>
    </main>
  )
}
