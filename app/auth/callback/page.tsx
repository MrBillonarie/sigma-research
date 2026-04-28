'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/nueva-contrasena')
      } else if (event === 'SIGNED_IN' && session) {
        router.replace('/home')
      }
    })

    // Safety fallback after 10 s
    const timeout = setTimeout(() => router.replace('/login'), 10_000)

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
