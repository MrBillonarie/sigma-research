import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendConfirmationEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  try {
    const { userId, email, firstName } = await req.json() as { userId: string; email: string; firstName: string }

    if (!userId || !email || !firstName)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const token   = crypto.randomUUID()
    const expires = new Date(Date.now() + 24 * 3_600_000).toISOString()

    await sb.from('email_tokens').insert({ user_id: userId, token, type: 'signup', expires_at: expires })
      .then(({ error }) => { if (error) console.error('[send-confirmation] db', error) })

    const { success, error } = await sendConfirmationEmail(email, firstName, token)
    if (!success) return NextResponse.json({ error }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[send-confirmation]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
