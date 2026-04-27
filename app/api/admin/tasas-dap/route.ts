import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function PUT(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.ADMIN_SECRET ?? 'adminsigma'
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { id, d30, d60, d90, d180, d360 } = body

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await sb()
    .from('tasas_dap')
    .update({ d30, d60, d90, d180, d360, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
