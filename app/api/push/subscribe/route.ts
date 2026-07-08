export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function authClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  const { data: { user } } = await authClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const endpoint = body?.endpoint as string | undefined
  const p256dh   = body?.keys?.p256dh as string | undefined
  const authKey  = body?.keys?.auth as string | undefined
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: 'Suscripción inválida.' }, { status: 400 })
  }

  const svc = serviceClient()
  const { error } = await svc.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint, p256dh, auth_key: authKey },
    { onConflict: 'endpoint' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const { data: { user } } = await authClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const endpoint = body?.endpoint as string | undefined
  if (!endpoint) return NextResponse.json({ error: 'Falta endpoint.' }, { status: 400 })

  const svc = serviceClient()
  const { error } = await svc.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
