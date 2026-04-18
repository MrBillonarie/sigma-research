'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'

// Handles Supabase OAuth and email-confirmation redirects.
// Supabase's detectSessionInUrl:true (default) auto-exchanges the PKCE code
// on client init; we just wait for the SIGNED_IN event.
export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // 1. If a session already exists (e.g. implicit flow already resolved), go now.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/terminal')
        return
      }
    })

    // 2. Otherwise wait for the SIGNED_IN event triggered by the PKCE exchange.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/terminal')
      }
    })

    // 3. Safety fallback: if nothing resolves in 8 s, send to login.
    const timeout = setTimeout(() => router.replace('/login'), 8_000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-7 h-7 border border-gold flex items-center justify-center animate-pulse">
          <span className="display-heading text-gold text-sm leading-none">Σ</span>
        </div>
        <p className="section-label text-text-dim">Autenticando…</p>
      </div>
    </main>
  )
}
