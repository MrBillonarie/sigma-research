'use client'
import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export interface UserPreferences {
  objetivo:    string | null
  plataformas: string[]
  perfil:      string | null
  onboarding_completed: boolean
  onboarding_step:      number
}

const DEFAULT_PREFS: UserPreferences = {
  objetivo:    null,
  plataformas: [],
  perfil:      null,
  onboarding_completed: false,
  onboarding_step:      0,
}

const SESSION_KEY = 'sigma_onboarding'

function readCache(): UserPreferences | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as UserPreferences) : null
  } catch { return null }
}

function writeCache(prefs: UserPreferences): void {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(prefs)) } catch {}
}

function clearCache(): void {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

export function useOnboarding() {
  const [prefs,   setPrefs]   = useState<UserPreferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [userId,  setUserId]  = useState<string | null>(null)

  useEffect(() => {
    // Leer caché antes de ir a la red — evita query Supabase en cada navegación
    const cached = readCache()
    if (cached?.onboarding_completed) {
      setPrefs(cached)
      setLoading(false)
      // Aún necesitamos el userId para posibles updates
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) setUserId(data.user.id)
      })
      return
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setLoading(false); return }
      setUserId(data.user.id)

      supabase
        .from('user_preferences')
        .select('objetivo, plataformas, perfil, onboarding_completed, onboarding_step')
        .eq('user_id', data.user.id)
        .maybeSingle()
        .then(({ data: row }) => {
          const result = row ? (row as UserPreferences) : DEFAULT_PREFS
          setPrefs(result)
          writeCache(result)
          setLoading(false)
        })
    })
  }, [])

  async function savePrefs(updates: Partial<UserPreferences>) {
    if (!userId) return
    const next = { ...prefs, ...updates }
    setPrefs(next)
    writeCache(next)
    await supabase.from('user_preferences').upsert({
      user_id: userId,
      ...next,
    }, { onConflict: 'user_id' })
  }

  async function completeOnboarding() {
    await savePrefs({ onboarding_completed: true, onboarding_step: 3 })
    clearCache()
  }

  const showWizard = !loading && userId !== null && !prefs.onboarding_completed

  return { prefs, loading, showWizard, savePrefs, completeOnboarding }
}
