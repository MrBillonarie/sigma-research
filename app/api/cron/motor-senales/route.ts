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

// Ventana de elegibilidad. Sólo se avisan posiciones abiertas/cerradas en los
// últimos 60 min. Cumple dos funciones:
//   - Al arrancar por primera vez no inunda con las 10 posiciones ya abiertas.
//   - Evita que una posición longeva se re-notifique cuando la purga de
//     retención borra su notificación original.
// Es holgada frente al cron (cada 2 min), así que tolera reinicios sin perder
// avisos.
const WINDOW_MIN = 60

// El motor emite 'YYYY-MM-DD HH:MM:SS[.micros]' en hora local del servidor, el
// mismo host donde corre este proceso.
function parseTs(ts?: string | null): number | null {
  if (!ts) return null
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi, sec] = m
  const t = new Date(+y, +mo - 1, +d, +h, +mi, +sec).getTime()
  return Number.isFinite(t) ? t : null
}

function withinWindow(ts?: string | null): boolean {
  const t = parseTs(ts)
  if (t === null) return false
  const ageMin = (Date.now() - t) / 60000
  return ageMin >= -5 && ageMin <= WINDOW_MIN   // -5: tolera desfase de reloj
}

/** 'DD/MM HH:MM' — legible y, a la vez, clave de idempotencia dentro del cuerpo. */
function stamp(ts?: string | null): string {
  const m = (ts ?? '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : '?'
}

const up = (v?: string | null) => (v ?? '').toUpperCase()

// El motor marca dinero real como mode='LIVE'; 'PAPER' y null son simulación.
const isReal = (mode?: string | null) => up(mode) === 'LIVE'

interface OpenPos {
  sym: string; tf: string; direction?: string; strategy?: string
  grade?: string; entry?: number; sl?: number; tp?: number
  rr?: number; kelly_pct?: number; mode?: string | null; opened_at?: string
}

interface ClosedPos {
  sym: string; tf: string; strategy?: string
  pnl_pct?: number; reason?: string; paper?: boolean; closed_at?: string
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
//
// 2026-07-21 — CAMBIO DE FUENTE. Antes se leía /api/notifications (feed rodante
// de eventos del motor). Dos problemas medidos en producción:
//   1. Repetía eventos viejos: la idempotencia usaba una ventana de 6h y el feed
//      conserva días, así que cada evento se re-notificaba cada 6h para siempre.
//      "BNB 1H LONG" del 20-jul llegó a 200+ copias.
//   2. Se saltaba órdenes reales: la apertura LIVE de NVDA 15m (12:33:19, dinero
//      real) no apareció en el feed ni 7 min después, mientras sí estaba en el
//      HUD y en trade_state.
//
// Ahora se deriva de /api/trades, que es lo que muestra el HUD: autoritativo,
// fresco y con `mode` para distinguir dinero real de papel. La idempotencia deja
// de depender de ventanas de tiempo: cada posición trae `opened_at` único, que
// va dentro del cuerpo de la notificación y sirve de clave natural.
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

  try {
    const res = await fetch(`${VPS}/api/trades`, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ ok: true, generated: [], note: 'motor no responde' })
    const data = await res.json()

    const pend: { title: string; body: string; urgent: boolean }[] = []

    for (const p of (data.open ?? []) as OpenPos[]) {
      if (!withinWindow(p.opened_at)) continue
      const real = isReal(p.mode)
      pend.push({
        title: `${p.sym} ${up(p.tf)} ${up(p.direction)}${real ? ' · REAL' : ''}`,
        body: [
          `${p.strategy} [${p.grade ?? '?'}]`,
          `Entry ${p.entry}`, `SL ${p.sl}`, `TP ${p.tp}`,
          p.rr != null ? `RR ${p.rr}:1` : null,
          p.kelly_pct != null ? `Kelly ${p.kelly_pct}%` : null,
          real ? 'DINERO REAL' : 'paper',
          `abrió ${stamp(p.opened_at)}`,   // clave de idempotencia
        ].filter(Boolean).join(' · '),
        urgent: true,
      })
    }

    for (const h of (data.history ?? []) as ClosedPos[]) {
      if (!withinWindow(h.closed_at)) continue
      const pnl = h.pnl_pct ?? 0
      const real = h.paper === false
      pend.push({
        title: `${h.sym} ${up(h.tf)} ${pnl > 0 ? 'WIN' : 'LOSS'}${real ? ' · REAL' : ''}`,
        body: [
          `${h.strategy} ${pnl >= 0 ? '+' : ''}${pnl}%`,
          h.reason ? `[${h.reason}]` : null,
          real ? 'DINERO REAL' : 'paper',
          `cerró ${stamp(h.closed_at)}`,   // clave de idempotencia
        ].filter(Boolean).join(' · '),
        urgent: real,
      })
    }

    if (pend.length === 0) return NextResponse.json({ ok: true, generated: [] })

    // Idempotencia por (usuario, título, cuerpo). El cuerpo lleva el timestamp
    // exacto de apertura/cierre, así que una posición nunca se duplica y una
    // reapertura del mismo modelo sí genera aviso nuevo. La ventana de consulta
    // (3h) cubre con holgura la de elegibilidad.
    const lookback = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('notifications')
      .select('user_id, title, body')
      .in('user_id', recipientList)
      .eq('type', 'señal')
      .gte('created_at', lookback)
    const seen = new Set((existing ?? []).map(r => `${r.user_id}|${r.title}|${r.body}`))

    const rows = pend.flatMap(n =>
      recipientList
        .filter(uid => !seen.has(`${uid}|${n.title}|${n.body}`))
        .map(uid => ({
          user_id: uid, type: 'señal', title: n.title, body: n.body,
          urgente: n.urgent, accion_label: 'Ver HUD', accion_href: '/hud', read: false,
        }))
    )
    if (rows.length === 0) return NextResponse.json({ ok: true, generated: [] })

    const { error } = await supabase.from('notifications').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Push sólo lo urgente: aperturas y cierres con dinero real.
    if (vapidConfigured) {
      const urgentRows = rows.filter(r => r.urgente)
      if (urgentRows.length > 0) await sendWebPush(supabase, urgentRows)
    }

    const titles = Array.from(new Set(rows.map(r => r.title)))
    return NextResponse.json({ ok: true, generated: titles, inserted: rows.length })
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
