'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

export interface FireProfile {
  fire_edad:            number | null
  fire_ahorro_mensual:  number | null
  fire_gasto_mensual:   number | null
  fire_completed:       boolean
}

const DEFAULT_PROFILE: FireProfile = {
  fire_edad:           null,
  fire_ahorro_mensual: null,
  fire_gasto_mensual:  null,
  fire_completed:      false,
}

export function useFireProfile() {
  const [profile, setProfile] = useState<FireProfile>(DEFAULT_PROFILE)
  const [loading, setLoading] = useState(true)
  const [userId,  setUserId]  = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setLoading(false); return }
      setUserId(data.user.id)

      supabase
        .from('user_preferences')
        .select('fire_edad, fire_ahorro_mensual, fire_gasto_mensual, fire_completed')
        .eq('user_id', data.user.id)
        .maybeSingle()
        .then(({ data: row }) => {
          setProfile(row ? (row as FireProfile) : DEFAULT_PROFILE)
          setLoading(false)
        })
    })
  }, [])

  const saveProfile = useCallback(async (updates: Partial<FireProfile>) => {
    if (!userId) return
    setProfile(prev => ({ ...prev, ...updates }))
    await supabase.from('user_preferences').upsert(
      { user_id: userId, ...updates },
      { onConflict: 'user_id' }
    )
  }, [userId])

  const needsOnboarding = !loading && userId !== null && !profile.fire_completed

  return { profile, loading, needsOnboarding, saveProfile }
}
