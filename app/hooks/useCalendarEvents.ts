'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/app/lib/supabase'
import { MOCK_EVENTS, type MacroEvent } from '@/app/data/mockEvents'

// Fusiona eventos de Supabase (manuales) con el dataset mock (presets).
// Los eventos de Supabase tienen prioridad si hay colisión de ID.
function mergeAndSort(db: MacroEvent[], mock: MacroEvent[]): MacroEvent[] {
  const dbIds = new Set(db.map(e => e.id))
  const combined = [...db, ...mock.filter(e => !dbIds.has(e.id))]
  return combined.sort((a, b) => {
    const d = a.event_date.localeCompare(b.event_date)
    return d !== 0 ? d : a.event_time.localeCompare(b.event_time)
  })
}

export interface CalendarEventState {
  events: MacroEvent[]
  loading: boolean
  error: string | null
  usingMock: boolean
  createEvent: (payload: Omit<MacroEvent, 'id'>) => Promise<void>
  updateEvent: (id: string, updates: Partial<MacroEvent>) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  refetch: () => Promise<void>
}

export function useCalendarEvents(): CalendarEventState {
  const [events,    setEvents]    = useState<MacroEvent[]>(MOCK_EVENTS)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [usingMock, setUsingMock] = useState(false)

  const fetchEvents = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('macro_events')
        .select('*')
        .order('event_date', { ascending: true })

      if (fetchError) {
        // La tabla no existe todavía (42P01) → fallback silencioso a mock
        if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
          setEvents(MOCK_EVENTS)
          setUsingMock(true)
          setError(null)
          return
        }
        throw fetchError
      }

      setEvents(mergeAndSort((data ?? []) as MacroEvent[], MOCK_EVENTS))
      setUsingMock(false)
      setError(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.warn('[useCalendarEvents] Usando datos mock:', msg)
      setEvents(MOCK_EVENTS)
      setUsingMock(true)
      // Solo mostrar error si no es de tabla inexistente
      if (!msg.includes('does not exist') && !msg.includes('42P01')) {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial + suscripción Realtime
  useEffect(() => {
    fetchEvents()

    const channel = supabase
      .channel('macro_events_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'macro_events' },
        () => { fetchEvents() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchEvents])

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  const createEvent = useCallback(async (payload: Omit<MacroEvent, 'id'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado')

    const { error } = await supabase.from('macro_events').insert({
      ...payload,
      user_id:   user.id,
      is_manual: true,
      source:    'MANUAL',
    })
    if (error) throw error
    // Realtime disparará refetch automáticamente
  }, [])

  const updateEvent = useCallback(async (id: string, updates: Partial<MacroEvent>) => {
    const { error } = await supabase
      .from('macro_events')
      .update(updates)
      .eq('id', id)
    if (error) throw error

    // Actualización optimista en mock (no afecta DB)
    if (id.startsWith('mock_')) {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    }
  }, [])

  const deleteEvent = useCallback(async (id: string) => {
    // Eventos mock se eliminan solo localmente
    if (id.startsWith('mock_')) {
      setEvents(prev => prev.filter(e => e.id !== id))
      return
    }
    const { error } = await supabase.from('macro_events').delete().eq('id', id)
    if (error) throw error
  }, [])

  return { events, loading, error, usingMock, createEvent, updateEvent, deleteEvent, refetch: fetchEvents }
}
