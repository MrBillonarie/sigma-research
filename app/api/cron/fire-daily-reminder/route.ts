export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const vapidConfigured = !!(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@squantdesk.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function checkCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (auth.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
}

// Mismo criterio de "día" que usa el cliente en FireChallenges.tsx
// (getToday() = new Date().toISOString().split('T')[0], calendario UTC).
function isoDay(offsetDays = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

// Espejo de computeStreak() en FireChallenges.tsx, en UTC puro para que el
// cron pueda correr en cualquier huso horario sin desalinearse del cliente.
function computeStreak(completed: Record<string, string[]>, frozen: string[], todayStr: string): number {
  const hasToday = (completed[todayStr]?.length ?? 0) > 0 || frozen.includes(todayStr)
  let streak = 0
  const base = new Date(`${todayStr}T00:00:00.000Z`)
  for (let i = hasToday ? 0 : 1; i < 365; i++) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().split('T')[0]
    if ((completed[key]?.length ?? 0) > 0 || frozen.includes(key)) streak++
    else break
  }
  return streak
}

interface FireRow {
  user_id:       string
  completed:     Record<string, string[]> | null
  frozen_dates:  string[] | null
  max_streak:    number | null
}

// Recordatorio diario del FIRE Planner — el hueco que faltaba: todo el resto
// de notificaciones (completaste reto, racha, insignia, nivel) es reactivo y
// solo dispara si el usuario tiene /fire abierto. Este cron es el único aviso
// PROACTIVO: llega aunque no hayas entrado al sitio en todo el día.
export async function POST(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = serviceClient()
  const today     = isoDay(0)
  const yesterday = isoDay(-1)

  // 1. Usuarios que terminaron el onboarding FIRE (candidatos al recordatorio)
  const { data: prefs, error: prefsErr } = await supabase
    .from('user_preferences')
    .select('user_id')
    .eq('fire_completed', true)
  if (prefsErr) return NextResponse.json({ error: prefsErr.message }, { status: 500 })
  if (!prefs || prefs.length === 0) return NextResponse.json({ ok: true, generated: 0, note: 'no fire users' })

  const userIds = prefs.map(p => p.user_id as string)

  // 2. Progreso real de esos usuarios (fire_challenges — puede no existir aún
  // para quien nunca tocó un reto, se trata como estado vacío)
  const { data: rows } = await supabase
    .from('fire_challenges')
    .select('user_id, completed, frozen_dates, max_streak')
    .in('user_id', userIds)
  const byUser = new Map<string, FireRow>((rows ?? []).map(r => [r.user_id, r as FireRow]))

  // 3. No duplicar si el cron ya corrió hoy para este usuario (idempotencia)
  const { data: already } = await supabase
    .from('notifications')
    .select('user_id')
    .eq('type', 'fire_daily_digest')
    .gte('created_at', `${today}T00:00:00.000Z`)
  const alreadyNotified = new Set((already ?? []).map(n => n.user_id as string))

  const toInsert: Record<string, unknown>[] = []

  for (const uid of userIds) {
    if (alreadyNotified.has(uid)) continue
    const row       = byUser.get(uid)
    const completed = row?.completed ?? {}
    const frozen    = row?.frozen_dates ?? []
    const didToday  = (completed[today]?.length ?? 0) > 0
    const streak    = computeStreak(completed, frozen, today)
    const hadYesterday = (completed[yesterday]?.length ?? 0) > 0 || frozen.includes(yesterday)

    // urgente:true en las 3 variantes — así se fijan arriba en la campanita
    // (bucket "// URGENTES") junto a las señales de trading, en vez de quedar
    // escondidas abajo en "// RECIENTES" donde nadie las ve sin hacer scroll.
    if (didToday) {
      toInsert.push({
        user_id:      uid,
        type:         'fire_daily_digest',
        title:        '✅ Cumpliste tu misión FIRE de hoy',
        body:         `Racha actual: ${streak} ${streak === 1 ? 'día' : 'días'}. Cada día cuenta para tu libertad financiera.`,
        urgente:      true,
        accion_label: 'Ver FIRE',
        accion_href:  '/fire',
        read:         false,
      })
    } else if (streak > 0 || hadYesterday) {
      toInsert.push({
        user_id:      uid,
        type:         'fire_daily_digest',
        title:        `⏰ Tu racha de ${streak} ${streak === 1 ? 'día' : 'días'} está en riesgo`,
        body:         'Aún no completas tu misión FIRE de hoy. Complétala antes de medianoche — recuerda ahorrar para tu futuro.',
        urgente:      true,
        accion_label: 'Ver FIRE',
        accion_href:  '/fire',
        read:         false,
      })
    } else {
      toInsert.push({
        user_id:      uid,
        type:         'fire_daily_digest',
        title:        'Recuerda tu misión FIRE de hoy',
        body:         'Un hábito pequeño y diario te acerca a tu libertad financiera. Entra y completa tu reto de hoy.',
        urgente:      true,
        accion_label: 'Ver FIRE',
        accion_href:  '/fire',
        read:         false,
      })
    }
  }

  if (toInsert.length === 0) return NextResponse.json({ ok: true, generated: 0 })

  const { error } = await supabase.from('notifications').insert(toInsert)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const pushed = vapidConfigured ? await sendWebPush(supabase, toInsert) : 0

  return NextResponse.json({ ok: true, generated: toInsert.length, pushed })
}

// ── Web Push real (llega sin abrir el sitio) ──────────────────────────────
// Complementa la campanita in-app de arriba — solo alcanza a quien activó el
// botón "Activar recordatorio diario" en /fire (FirePushOptIn.tsx), el resto
// solo ve la notificación cuando entra al sitio.
async function sendWebPush(
  supabase: ReturnType<typeof serviceClient>,
  rows: Record<string, unknown>[]
): Promise<number> {
  const userIds = rows.map(r => r.user_id as string)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth_key')
    .in('user_id', userIds)
  if (!subs || subs.length === 0) return 0

  const byUser = new Map<string, Record<string, unknown>>(rows.map(r => [r.user_id as string, r]))
  let sent = 0
  const staleIds: string[] = []

  await Promise.allSettled(subs.map(async sub => {
    const notif = byUser.get(sub.user_id as string)
    if (!notif) return
    const payload = JSON.stringify({
      title: notif.title,
      body:  notif.body,
      url:   notif.accion_href ?? '/fire',
    })
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth_key as string } },
        payload
      )
      sent++
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) staleIds.push(sub.id as string)
    }
  }))

  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds)
  }

  return sent
}

// GET — dry run preview (no DB writes) — admin/cron only
export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ dry_run: true, today: isoDay(0), yesterday: isoDay(-1) })
}
