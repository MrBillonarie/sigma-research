'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/app/lib/supabase'
import { MOCK_EVENTS, type MacroEvent } from '@/app/data/mockEvents'

interface TaskRow {
  id: string
  title: string
  task_date: string
  task_time: string
  description: string | null
  done: boolean
}

function taskToEvent(t: TaskRow): MacroEvent {
  return {
    id: t.id,
    title: t.title,
    currency: '',
    impact: 'LOW',
    type: 'TASK',
    event_date: t.task_date,
    event_time: t.task_time,
    previous: '', forecast: '',
    actual: t.done ? 'Hecho' : '',
    description: t.description ?? '',
    source: 'TASK',
    is_manual: true,
    country: '',
    is_task: true,
    done: t.done,
  }
}

function sortByDate(events: MacroEvent[]): MacroEvent[] {
  return [...events].sort((a, b) => {
    const d = a.event_date.localeCompare(b.event_date)
    return d !== 0 ? d : a.event_time.localeCompare(b.event_time)
  })
}

export interface CalendarEventState {
  events: MacroEvent[]
  loading: boolean
  error: string | null
  usingMock: boolean
  createTask: (payload: { title: string; task_date: string; task_time: string; description: string }) => Promise<void>
  updateTask: (id: string, updates: Partial<{ title: string; task_date: string; task_time: string; description: string; done: boolean }>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  refetch: () => Promise<void>
}

export function useCalendarEvents(): CalendarEventState {
  const [newsEvents, setNewsEvents] = useState<MacroEvent[]>(MOCK_EVENTS)
  const [taskEvents, setTaskEvents] = useState<MacroEvent[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [usingMock, setUsingMock] = useState(false)

  // ─── Noticias reales (públicas, solo lectura para el usuario) ────────────────
  const fetchNews = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('macro_events')
        .select('*')
        .order('event_date', { ascending: true })

      if (fetchError) {
        if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
          setNewsEvents(MOCK_EVENTS)
          setUsingMock(true)
          setError(null)
          return
        }
        throw fetchError
      }

      const real = (data ?? []) as MacroEvent[]
      if (real.length === 0) {
        // Tabla existe pero vacía — seguimos mostrando referencia, pero avisando que es mock
        setNewsEvents(MOCK_EVENTS)
        setUsingMock(true)
      } else {
        setNewsEvents(real)
        setUsingMock(false)
      }
      setError(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.warn('[useCalendarEvents] Usando datos mock:', msg)
      setNewsEvents(MOCK_EVENTS)
      setUsingMock(true)
      if (!msg.includes('does not exist') && !msg.includes('42P01')) {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Tareas privadas del usuario ──────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setTaskEvents([]); return }

    const { data, error: fetchError } = await supabase
      .from('calendar_tasks')
      .select('*')
      .order('task_date', { ascending: true })

    if (fetchError) {
      console.warn('[useCalendarEvents] tareas:', fetchError.message)
      setTaskEvents([])
      return
    }
    setTaskEvents(((data ?? []) as TaskRow[]).map(taskToEvent))
  }, [])

  const refetch = useCallback(async () => {
    await Promise.all([fetchNews(), fetchTasks()])
  }, [fetchNews, fetchTasks])

  useEffect(() => {
    refetch()

    const newsChannel = supabase
      .channel('macro_events_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'macro_events' }, () => { fetchNews() })
      .subscribe()

    const tasksChannel = supabase
      .channel('calendar_tasks_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_tasks' }, () => { fetchTasks() })
      .subscribe()

    return () => {
      supabase.removeChannel(newsChannel)
      supabase.removeChannel(tasksChannel)
    }
  }, [fetchNews, fetchTasks, refetch])

  // ─── CRUD de tareas ─────────────────────────────────────────────────────────
  const createTask = useCallback(async (payload: { title: string; task_date: string; task_time: string; description: string }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado')

    const { error } = await supabase.from('calendar_tasks').insert({
      title:       payload.title,
      task_date:   payload.task_date,
      task_time:   payload.task_time,
      description: payload.description,
      user_id:     user.id,
    })
    if (error) throw error
  }, [])

  const updateTask = useCallback(async (id: string, updates: Partial<{ title: string; task_date: string; task_time: string; description: string; done: boolean }>) => {
    const { error } = await supabase.from('calendar_tasks').update(updates).eq('id', id)
    if (error) throw error
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase.from('calendar_tasks').delete().eq('id', id)
    if (error) throw error
  }, [])

  return {
    events: sortByDate([...newsEvents, ...taskEvents]),
    loading, error, usingMock,
    createTask, updateTask, deleteTask,
    refetch,
  }
}
