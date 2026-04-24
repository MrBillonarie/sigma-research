export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function makeClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

const TEST_NOTIFS = [
  { type: 'señal',    urgente: true,  title: 'Nueva señal PRO.MACD',        body: 'BTCUSDT LONG 4H · Entry: $76,200 · SL: $74,800 · TP: $81,000',           accion_label: 'Ver señal',    accion_href: '/terminal' },
  { type: 'mercado',  urgente: true,  title: 'Cambio de régimen HMM',       body: 'Bull → Lateral · Reducir exposición y aumentar stops',                     accion_label: 'Ver HUD',      accion_href: '/hud' },
  { type: 'mercado',  urgente: false, title: 'Movimiento relevante: BTC',   body: 'BTC +3.1% en las últimas 4 horas · $75,200 → $77,500',                     accion_label: null,           accion_href: null },
  { type: 'portfolio',urgente: false, title: 'P&L del día',                 body: '+$1,240 acumulado hoy · Win rate semanal: 73% · 5 trades ejecutados',       accion_label: 'Ver journal',  accion_href: '/journal' },
  { type: 'reporte',  urgente: false, title: 'Nuevo reporte disponible',    body: 'Reporte Mensual #002 ya está publicado · Análisis de régimen Abril 2026',   accion_label: 'Descargar',    accion_href: '/mis-reportes' },
  { type: 'sistema',  urgente: false, title: 'Objetivo FIRE no configurado',body: 'Configura tu objetivo FIRE para ver tu progreso real hacia la libertad financiera', accion_label: 'Configurar', accion_href: '/fire' },
]

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Solo disponible en desarrollo' }, { status: 403 })
  }

  const supabase = makeClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let tipo = 'all'
  try { const b = await req.json(); if (b.tipo) tipo = b.tipo } catch {}

  const toInsert = (tipo === 'all' ? TEST_NOTIFS : TEST_NOTIFS.filter(n => n.type === tipo))
    .map(n => ({ ...n, user_id: user.id, read: false }))

  const { data, error } = await supabase.from('notifications').insert(toInsert).select()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ created: data?.length ?? 0, notifications: data })
}
