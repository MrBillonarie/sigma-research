import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function auth(req: NextRequest) {
  const header = req.headers.get('authorization') ?? ''
  const secret = process.env.ADMIN_SECRET ?? 'adminsigma'
  return header === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await sb().auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = data.users.map(u => ({
    id: u.id,
    email: u.email ?? '',
    nombre: (u.user_metadata?.nombre as string) ?? '',
    created_at: u.created_at,
    confirmed: !!u.email_confirmed_at,
    last_sign_in: u.last_sign_in_at ?? null,
    plan: (u.app_metadata?.plan as string) ?? 'free',
  }))

  return NextResponse.json({ users, total: data.total })
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id, plan } = await req.json()
  if (!id || !['free', 'pro'].includes(plan)) {
    return NextResponse.json({ error: 'id y plan (free|pro) requeridos' }, { status: 400 })
  }

  const { error } = await sb().auth.admin.updateUserById(id, {
    app_metadata: { plan },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
