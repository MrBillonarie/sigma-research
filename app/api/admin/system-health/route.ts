import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/adminAuth'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function cronStatus(lastRunISO: string | null): 'ok' | 'stale' | 'unknown' {
  if (!lastRunISO) return 'unknown'
  return Date.now() - new Date(lastRunISO).getTime() < 36 * 3_600_000 ? 'ok' : 'stale'
}

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = sb()

  const [
    fondosRes,
    signalsRes,
    accuracyRes,
    notifsRes,
    lpRes,
    reportesSinPdfRes,
    auditRes,
  ] = await Promise.all([
    client.from('fondos_mutuos').select('updated_at').order('updated_at', { ascending: false }).limit(1),
    client.from('signal_history').select('generated_at').order('generated_at', { ascending: false }).limit(1),
    client.from('signal_history').select('outcome_measured_at').not('outcome_measured_at', 'is', null).order('outcome_measured_at', { ascending: false }).limit(1),
    client.from('notifications').select('created_at').eq('type', 'mercado').order('created_at', { ascending: false }).limit(1),
    client.from('lp_signals').select('id, hyp_text, created_at').eq('requires_approval', true).eq('is_active', false),
    client.from('reportes').select('id, titulo, numero').eq('activo', true).or('url_pdf.is.null,url_pdf.eq.'),
    client.from('admin_audit_log').select('id, ts, action, target_id, meta').order('ts', { ascending: false }).limit(8),
  ])

  const fondosLast   = fondosRes.data?.[0]?.updated_at       ?? null
  const signalsLast  = signalsRes.data?.[0]?.generated_at    ?? null
  const accuracyLast = accuracyRes.data?.[0]?.outcome_measured_at ?? null
  const notifsLast   = notifsRes.data?.[0]?.created_at       ?? null

  return NextResponse.json({
    crons: {
      syncFondos:    { lastRun: fondosLast,   status: cronStatus(fondosLast)   },
      motorSignals:  { lastRun: signalsLast,  status: cronStatus(signalsLast)  },
      motorAccuracy: { lastRun: accuracyLast, status: cronStatus(accuracyLast) },
      sistemaNotifs: { lastRun: notifsLast,   status: cronStatus(notifsLast)   },
    },
    pending: {
      lpSignals:      (lpRes.data ?? []).length,
      lpItems:        (lpRes.data ?? []).slice(0, 3),
      reportesSinPdf: (reportesSinPdfRes.data ?? []).length,
      reportesItems:  (reportesSinPdfRes.data ?? []).slice(0, 3),
    },
    recentAudit: auditRes.data ?? [],
  }, { headers: { 'Cache-Control': 'no-store' } })
}
