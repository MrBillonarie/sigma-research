export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/adminAuth'

// Endpoint de diagnóstico — verificar conectividad con Supabase
// Acceder en: /api/health
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  const checks: Record<string, string> = {
    supabase_url:    url  ? 'OK' : 'FALTA',
    anon_key:        anon ? 'OK' : 'FALTA',
    service_key:     svc  ? 'OK' : 'FALTA',
    resend_key:      process.env.RESEND_API_KEY      ? 'OK' : 'FALTA',
    admin_secret:    process.env.ADMIN_SECRET         ? 'OK' : 'FALTA',
    app_url:         process.env.NEXT_PUBLIC_APP_URL  ? 'OK' : 'no definida',
  }

  // Intentar ping a Supabase
  let dbStatus = 'no testado'
  if (url && svc) {
    try {
      const sb = createClient(url, svc, { auth: { persistSession: false } })
      const { error } = await sb.from('profiles').select('id').limit(1)
      dbStatus = error ? `ERROR: ${error.message}` : 'OK — DB conectada'
    } catch (e) {
      dbStatus = `EXCEPTION: ${e instanceof Error ? e.message : 'unknown'}`
    }
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: checks,
    db: dbStatus,
  })
}
