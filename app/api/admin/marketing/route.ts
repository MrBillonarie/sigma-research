import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/adminAuth'
import { sendMarketingEmail } from '@/lib/email'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { segmento, subject, title, subtitle, body, ctaText, ctaUrl } = await req.json()

  if (!subject || !title || !body || !ctaText || !ctaUrl) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  const { data } = await sb().auth.admin.listUsers({ page: 1, perPage: 1000 })
  let users = (data?.users ?? []).filter(u => !!u.email_confirmed_at && u.email)

  if (segmento === 'pro')  users = users.filter(u => u.app_metadata?.plan === 'pro')
  if (segmento === 'free') users = users.filter(u => (u.app_metadata?.plan ?? 'free') !== 'pro')

  if (users.length === 0) {
    return NextResponse.json({ error: 'No hay destinatarios para ese segmento' }, { status: 400 })
  }

  const emails = users.map(u => u.email!)
  const result = await sendMarketingEmail(emails, subject, { title, subtitle, body, ctaText, ctaUrl })

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Error al enviar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sent: emails.length })
}
