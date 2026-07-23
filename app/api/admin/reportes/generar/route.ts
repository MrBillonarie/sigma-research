export const dynamic     = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/adminAuth'
import { construirBorrador } from '@/lib/researchReport'

// Borrador del research semanal. No publica nada: devuelve el JSON para que el
// admin lo revise, complete los huecos y recien ahi guarde el reporte.

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const override = req.nextUrl.searchParams.get('numero')
  let numero = override ? parseInt(override, 10) : NaN

  if (!Number.isFinite(numero)) {
    // Siguiente edicion = la mayor publicada + 1. Se consulta con service role
    // porque `reportes` no es legible con la anon key.
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data } = await sb
      .from('reportes')
      .select('numero')
      .order('numero', { ascending: false })
      .limit(1)
    numero = (data?.[0]?.numero ?? 0) + 1
  }

  try {
    const draft = await construirBorrador({ numero })
    return NextResponse.json({ ok: true, draft }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[admin/reportes/generar]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
