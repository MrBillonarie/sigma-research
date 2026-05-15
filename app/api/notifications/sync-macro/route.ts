import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MOCK_EVENTS } from '@/app/data/mockEvents'

// Crea notificaciones para eventos HIGH de las próximas 48h si no existen aún
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ ok: false }, { status: 400 })

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const now       = new Date()
    const in48h     = new Date(now.getTime() + 48 * 3600 * 1000)
    const todayStr  = now.toISOString().split('T')[0]
    const limitStr  = in48h.toISOString().split('T')[0]

    const upcoming = MOCK_EVENTS.filter(e =>
      e.impact === 'HIGH' &&
      e.event_date >= todayStr &&
      e.event_date <= limitStr
    )

    if (!upcoming.length) return NextResponse.json({ ok: true, created: 0 })

    // Verificar cuáles ya existen para no duplicar
    const { data: existing } = await sb
      .from('notifications')
      .select('accion_label')
      .eq('user_id', userId)
      .eq('type', 'mercado')
      .gte('created_at', new Date(now.getTime() - 48 * 3600 * 1000).toISOString())

    const existingLabels = new Set((existing ?? []).map(n => n.accion_label))

    const toInsert = upcoming
      .filter(e => !existingLabels.has(e.id))
      .map(e => {
        const daysUntil = Math.round((new Date(e.event_date).getTime() - now.getTime()) / 86400000)
        const when = daysUntil === 0 ? 'HOY' : daysUntil === 1 ? 'MAÑANA' : `en ${daysUntil} días`
        return {
          user_id:      userId,
          title:        `⚡ ${e.title}`,
          body:         `${when} · ${e.event_date} ${e.event_time} ET — ${e.currency} · ${e.description.slice(0, 120)}`,
          type:         'mercado',
          read:         false,
          urgente:      daysUntil === 0,
          accion_label: e.id,
          accion_href:  '/calendario',
        }
      })

    if (!toInsert.length) return NextResponse.json({ ok: true, created: 0 })

    const { error } = await sb.from('notifications').insert(toInsert)
    if (error) return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })

    return NextResponse.json({ ok: true, created: toInsert.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
