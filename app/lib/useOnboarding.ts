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

export function useOnboarding() {
  const [prefs,   setPrefs]   = useState<UserPreferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [userId,  setUserId]  = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setLoading(false); return }
      setUserId(data.user.id)

      supabase
        .from('user_preferences')
        .select('objetivo, plataformas, perfil, onboarding_completed, onboarding_step')
        .eq('user_id', data.user.id)
        .maybeSingle()
        .then(({ data: row }) => {
          if (row) setPrefs(row as UserPreferences)
          setLoading(false)
        })
    })
  }, [])

  async function savePrefs(updates: Partial<UserPreferences>) {
    if (!userId) return
    const next = { ...prefs, ...updates }
    setPrefs(next)
    await supabase.from('user_preferences').upsert({
      user_id: userId,
      ...next,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  async function completeOnboarding() {
    await savePrefs({ onboarding_completed: true, onboarding_step: 3 })
  }

  const showWizard = !loading && userId !== null && !prefs.onboarding_completed

  return { prefs, loading, showWizard, savePrefs, completeOnboarding }
}
