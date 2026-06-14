export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/adminAuth'

// Endpoint de diagnóstico — verificar conectividad con Supabase
// Acceder en: /api/health
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  // Verificar solo si las variables están presentes, sin revelar valores ni nombres
  const missingCount = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.RESEND_API_KEY,
    process.env.ADMIN_SECRET,
  ].filter(v => !v).length

  // Ping a Supabase
  let dbOk = false
  if (url && svc) {
    try {
      const sb = createClient(url, svc, { auth: { persistSession: false } })
      const { error } = await sb.from('profiles').select('id').limit(1)
      dbOk = !error
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    status:    dbOk ? 'ok' : 'degraded',
    db:        dbOk ? 'connected' : 'error',
    config:    missingCount === 0 ? 'complete' : `${missingCount} vars missing`,
    timestamp: new Date().toISOString(),
  })
}
