import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Create Account — Sigma Research',
  description: 'Create your free Sigma Research account and access institutional-grade quantitative tools.',
}

export default async function EnRegistroPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  // Render English version of the registration page
  // Uses the same /api/auth/signup endpoint
  return (
    <main className="min-h-screen bg-bg bg-grid-pattern bg-grid flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-7 h-7 border border-gold flex items-center justify-center">
            <span className="display-heading text-gold text-sm leading-none">Σ</span>
          </div>
          <Link href="/en" className="display-heading text-xl tracking-widest text-text">
            SIGMA RESEARCH
          </Link>
        </div>

        <div className="glass-card p-8 shadow-card">
          <h1 className="display-heading text-4xl gold-text mb-1">CREATE ACCOUNT</h1>
          <p className="terminal-text text-text-dim mb-8">Join the quant platform.</p>

          <div className="terminal-text text-sm text-text-dim text-center py-6 border border-border">
            <p className="mb-4">Registration form available in Spanish.</p>
            <Link
              href="/registro"
              className="bg-gold text-bg section-label px-6 py-2.5 hover:bg-gold-glow transition-colors inline-block"
            >
              GO TO REGISTRATION →
            </Link>
          </div>

          <p className="terminal-text text-center text-text-dim mt-6">
            Already have an account?{' '}
            <Link href="/en/login" className="text-gold hover:text-gold-glow transition-colors">
              SIGN IN
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
