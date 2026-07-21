export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { pickDaily, scaleAmt } from '@/app/(dashboard)/fire/dailyChallenges'

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

// El reto concreto del día sale del mismo módulo que usa /fire en el cliente,
// así el aviso y la pantalla nunca se contradicen.
// Nota de huso: pickDaily() usa el día local del servidor (-04, igual que el
// público objetivo), mientras isoDay() calcula la clave en UTC — misma tensión
// que ya existía entre el cron y el cliente, no se cambia acá.
const daily = () => pickDaily()

// Recordatorio diario del FIRE Planner — el hueco que faltaba: todo el resto
// de notificaciones (completaste reto, racha, insignia, nivel) es reactivo y
// solo dispara si el usuario tiene /fire abierto. Este cron es el único aviso
// PROACTIVO: llega aunque no hayas entrado al sitio en todo el día.
async function run() {
  const supabase = serviceClient()
  const today     = isoDay(0)
  const yesterday = isoDay(-1)
  const reto      = daily()

  // 1. Usuarios que terminaron el onboarding FIRE (candidatos al recordatorio).
  // Se trae fire_ahorro_mensual para escalar el monto del reto a cada usuario,
  // igual que hace scaleAmt() en la pantalla.
  const { data: prefs, error: prefsErr } = await supabase
    .from('user_preferences')
    .select('user_id, fire_ahorro_mensual')
    .eq('fire_completed', true)
  if (prefsErr) return NextResponse.json({ error: prefsErr.message }, { status: 500 })
  if (!prefs || prefs.length === 0) return NextResponse.json({ ok: true, generated: 0, note: 'no fire users' })

  const userIds = prefs.map(p => p.user_id as string)
  const ahorroBy = new Map<string, number>(prefs.map(p => [p.user_id as string, (p.fire_ahorro_mensual as number) ?? 0]))

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
    // Monto del reto escalado al ahorro real de este usuario (0 si el reto no
    // tiene componente monetario) — mismo cálculo que muestra la pantalla.
    const amt  = scaleAmt(ahorroBy.get(uid) ?? 0, reto.amountBase)
    const meta = reto.amountBase > 0 ? ` · ${reto.unitFn(amt)}` : ''

    const base = { user_id: uid, type: 'fire_daily_digest', urgente: true,
                   accion_label: 'Ver FIRE', accion_href: '/fire', read: false }

    if (didToday) {
      toInsert.push({
        ...base,
        title: '✅ Cumpliste tu misión FIRE de hoy',
        body:  `Racha actual: ${streak} ${streak === 1 ? 'día' : 'días'}. Cada día cuenta para tu libertad financiera.`,
      })
    } else if (streak > 0 || hadYesterday) {
      toInsert.push({
        ...base,
        title: `⏰ Tu racha de ${streak} ${streak === 1 ? 'día' : 'días'} está en riesgo`,
        body:  `Reto de hoy: ${reto.title}${meta}. ${reto.desc}`,
      })
    } else {
      toInsert.push({
        ...base,
        title: `Reto FIRE de hoy: ${reto.title}`,
        body:  `${reto.desc}${meta ? ` (${reto.unitFn(amt)})` : ''}`,
      })
    }
  }

  if (toInsert.length === 0) return NextResponse.json({ ok: true, generated: 0 })

  const { error } = await supabase.from('notifications').insert(toInsert)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const pushed = vapidConfigured ? await sendWebPush(supabase, toInsert) : 0

  return NextResponse.json({ ok: true, generated: toInsert.length, pushed, reto: reto.title })
}

export async function POST(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return run()
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

// GET — mismo trabajo que POST.
//
// 2026-07-21: BUGFIX. sigma_web_cron.sh invoca los endpoints con `curl` a secas,
// es decir GET. Como acá el trabajo real vivía sólo en POST y GET era un dry
// run, el cron devolvía 200 todos los días a las 20:00 sin escribir una sola
// notificación — se confirmó con 3 filas fire_daily_digest en toda la historia
// (pruebas manuales) contra ~5 días de ejecuciones "exitosas" en el log.
// El dry run sigue disponible con ?dry=1.
export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (new URL(req.url).searchParams.get('dry') === '1') {
    const reto = daily()
    return NextResponse.json({ dry_run: true, today: isoDay(0), yesterday: isoDay(-1), reto: reto.title })
  }
  return run()
}
