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
// guarda lo reciente. Se borran únicamente las YA LEÍDAS: si no la viste,
// se queda hasta que la leas.

const RETENTION_DAYS = 2
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

function cutoffISO() {
  return new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString()
}

async function run(dry: boolean) {
  const supabase = serviceClient()
  const cutoff = cutoffISO()

  // Cuántas califican (sirve de dry-run y de reporte tras el borrado)
  const { count: candidates } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .in('type', PURGE_TYPES)
    .eq('read', true)
    .lt('created_at', cutoff)

  if (dry) {
    return NextResponse.json({
      dry_run: true, retention_days: RETENTION_DAYS, cutoff,
      types: PURGE_TYPES, would_delete: candidates ?? 0,
    })
  }

  const { error, count: deleted } = await supabase
    .from('notifications')
    .delete({ count: 'exact' })
    .in('type', PURGE_TYPES)
    .eq('read', true)
    .lt('created_at', cutoff)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true, retention_days: RETENTION_DAYS, cutoff,
    types: PURGE_TYPES, deleted: deleted ?? 0,
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
