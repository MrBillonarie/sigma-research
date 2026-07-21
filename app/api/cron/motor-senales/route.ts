export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const VPS = process.env.VPS_URL ?? process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'
const OWNER_USER_ID = process.env.OWNER_USER_ID ?? ''

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

// 2026-07-21: BUGFIX de re-notificación en loop.
//
// El motor expone un feed rodante de los últimos ~50 eventos, que incluye
// eventos de días anteriores. La idempotencia de abajo mira una ventana de 6h,
// así que pasadas esas 6h un evento viejo "ya no figura como notificado" y se
// volvía a insertar — para siempre y a todos los destinatarios.
//
// Medido: "BNB 1H LONG" (evento del 20-jul 12:03) se había notificado 200+
// veces, en tandas separadas por exactamente 6h. De ahí las 12.916 filas de
// tipo señal: eran ~50 eventos reales repetidos en loop. Además confundía al
// usuario, porque la campanita mostraba "hace 3m" una señal de ayer que ya no
// estaba abierta en el HUD.
//
// Ahora sólo se procesan eventos recientes. La ventana es holgada respecto del
// cron (corre cada 2 min) para tolerar reinicios o atrasos sin perder señales.
const MAX_EVENT_AGE_MIN = 30

// El motor emite 'YYYY-MM-DD HH:MM:SS' en hora local del servidor, el mismo
// host donde corre este proceso.
function isFresh(ts: string): boolean {
  if (!ts) return false
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return false
  const [, y, mo, d, h, mi, s] = m
  const when = new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime()
  if (!Number.isFinite(when)) return false
  const ageMin = (Date.now() - when) / 60000
  return ageMin >= -5 && ageMin <= MAX_EVENT_AGE_MIN   // -5: tolera desfase de reloj
}

interface MotorEvent {
  ts: string
  type: string
  sym: string
  tf: string
  strategy: string
  direction?: string
  grade?: string
  entry?: number
  sl?: number
  tp?: number
  kelly_pct?: number
  rr?: number
  pnl_pct?: number
  reason?: string
}

// ── Destinatarios: owner + usuarios PRO/anual ─────────────────────────────────
// Beneficio "Alertas en tiempo real" del plan PRO (tabla Free vs PRO): las
// aperturas/cierres per-model del motor llegan a la campanita (y por web push
// si el usuario lo activó). Los usuarios free NO reciben señales — sus
// alertas básicas son las de precio (RightBar) y los avisos de mercado/FIRE.
async function getProUserIds(supabase: ReturnType<typeof serviceClient>): Promise<string[]> {
  const ids = new Set<string>()
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) break
    for (const u of data.users) {
      const plan = (u.app_metadata?.plan as string) ?? 'free'
      if (plan === 'pro' || plan === 'anual') ids.add(u.id)
    }
    if (data.users.length < 200) break
  }
  return Array.from(ids)
}

// Puente motor → campanita unificada. Historia: hasta 2026-07-10 solo iba al
// owner (estudio interno, señales silenciadas del grupo público de Telegram
// desde 2026-05-31). Ahora también hace fan-out a suscriptores PRO como
// beneficio del plan.
export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = serviceClient()

  const recipients = new Set<string>()
  if (OWNER_USER_ID) recipients.add(OWNER_USER_ID)
  for (const id of await getProUserIds(supabase)) recipients.add(id)
  if (recipients.size === 0) {
    return NextResponse.json({ ok: true, generated: [], note: 'sin destinatarios' })
  }
  const recipientList = Array.from(recipients)

  const results: string[] = []

  try {
    const res = await fetch(`${VPS}/api/notifications`, {
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ ok: true, generated: [] })

    const data = await res.json()
    const events: MotorEvent[] = (data.events || []).filter(
      (e: MotorEvent) =>
        (e.type === 'per_model_open' || e.type === 'per_model_close') && isFresh(e.ts)
    )
    const sinceWindow = new Date(Date.now() - 6 * 3600 * 1000).toISOString()

    for (const e of events) {
      const isOpen = e.type === 'per_model_open'
      const isShort = e.direction === 'short'
      const title = isOpen
        ? `${e.sym} ${(e.tf || '').toUpperCase()} ${isShort ? 'SHORT' : 'LONG'}`
        : `${e.sym} ${(e.tf || '').toUpperCase()} ${(e.pnl_pct ?? 0) > 0 ? 'WIN' : 'LOSS'}`
      const body = isOpen
        ? `${e.strategy} [${e.grade ?? '?'}] · Entry ${e.entry} · SL ${e.sl} · TP ${e.tp} · Kelly ${e.kelly_pct}% · RR ${e.rr}:1`
        : `${e.strategy} ${(e.pnl_pct ?? 0) >= 0 ? '+' : ''}${e.pnl_pct}% [${e.reason ?? ''}]`

      // Idempotencia por usuario: quién ya recibió este evento en la ventana
      const { data: existing } = await supabase
        .from('notifications')
        .select('user_id')
        .in('user_id', recipientList)
        .eq('type', 'señal')
        .eq('title', title)
        .eq('body', body)
        .gte('created_at', sinceWindow)
      const done = new Set((existing ?? []).map(r => r.user_id as string))

      const rows = recipientList
        .filter(uid => !done.has(uid))
        .map(uid => ({
          user_id:      uid,
          type:         'señal',
          title,
          body,
          urgente:      isOpen,
          accion_label: 'Ver HUD',
          accion_href:  '/hud',
          read:         false,
        }))
      if (rows.length === 0) continue

      const { error } = await supabase.from('notifications').insert(rows)
      if (!error) {
        results.push(`${title} ×${rows.length}`)
        // Push real solo en aperturas (lo urgente); los cierres se ven en la campanita
        if (isOpen && vapidConfigured) await sendWebPush(supabase, rows)
      }
    }

    return NextResponse.json({ ok: true, generated: results })
  } catch {
    return NextResponse.json({ ok: true, generated: [] })
  }
}

// ── Web Push (mismo patrón que fire-daily-reminder, con limpieza de subs muertas)
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
      url:   notif.accion_href ?? '/hud',
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
