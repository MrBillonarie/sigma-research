import { supabase } from './supabase'

export interface NotifyInput {
  userId:       string
  title:        string
  body:         string
  type:         string
  urgente?:     boolean
  accionLabel?: string
  accionHref?:  string
}

export async function createNotification(n: NotifyInput) {
  const { error } = await supabase.from('notifications').insert({
    user_id:      n.userId,
    title:        n.title,
    body:         n.body,
    type:         n.type,
    read:         false,
    urgente:      n.urgente ?? false,
    accion_label: n.accionLabel ?? null,
    accion_href:  n.accionHref ?? null,
  })
  // no romper el flujo del caller (fire-and-forget), pero no tragar el fallo
  if (error) console.error('[createNotification] no se pudo crear la notificación:', error.message)
}
