export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Retención de notificaciones ─────────────────────────────────────────────
// Las señales del motor son el 99% de la tabla (12.916 de 13.020 al 2026-07-21)
// y no había purga: la fila más antigua era del 20-may. Tres de los cuatro
// usuarios PRO tenían el 100% sin leer, o sea que la campanita dejó de
// comunicar.
//
// El registro permanente de señales vive en Telegram, así que acá sólo se
// guarda lo reciente.
//
// Dos plazos: las leídas se van a los 2 días (ya cumplieron su función) y las
// NO leídas a los 3. El segundo plazo hizo falta porque con purga sólo de
// leídas quedaban 10.171 sin leer contra 446 leídas — tres de los cuatro
// usuarios PRO nunca las abren, así que sus notificaciones jamás cumplían la
// condición de borrado y se acumulaban sin techo.

const RETENTION_READ_DAYS   = 2
const RETENTION_UNREAD_DAYS = 3
const PURGE_TYPES = ['señal']   // solo señales; fire/soporte/mercado son de bajo volumen

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

const cutoffISO = (days: number) => new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()

async function run(dry: boolean) {
  const supabase = serviceClient()
  const cutRead   = cutoffISO(RETENTION_READ_DAYS)
  const cutUnread = cutoffISO(RETENTION_UNREAD_DAYS)

  const sweep = async (isRead: boolean, cutoff: string) => {
    if (dry) {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .in('type', PURGE_TYPES).eq('read', isRead).lt('created_at', cutoff)
      return { count: count ?? 0, error: null as string | null }
    }
    const { error, count } = await supabase
      .from('notifications')
      .delete({ count: 'exact' })
      .in('type', PURGE_TYPES).eq('read', isRead).lt('created_at', cutoff)
    return { count: count ?? 0, error: error?.message ?? null }
  }

  const read   = await sweep(true,  cutRead)
  const unread = await sweep(false, cutUnread)
  const err = read.error ?? unread.error
  if (err) return NextResponse.json({ error: err }, { status: 500 })

  return NextResponse.json({
    ...(dry ? { dry_run: true } : { ok: true }),
    types: PURGE_TYPES,
    read:   { retention_days: RETENTION_READ_DAYS,   cutoff: cutRead,   [dry ? 'would_delete' : 'deleted']: read.count },
    unread: { retention_days: RETENTION_UNREAD_DAYS, cutoff: cutUnread, [dry ? 'would_delete' : 'deleted']: unread.count },
    total: read.count + unread.count,
  })
}

// GET hace el trabajo (sigma_web_cron.sh invoca con curl = GET). ?dry=1 previsualiza.
export async function GET(req: Request) {
  if (!checkCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return run(new URL(req.url).searchParams.get('dry') === '1')
}

export async function POST(req: Request) {
  if (!checkCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return run(false)
}
