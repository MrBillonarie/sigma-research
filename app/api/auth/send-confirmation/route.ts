import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendConfirmationEmail } from '@/lib/email'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  try {
    const { email, firstName } = await req.json() as { email: string; firstName: string }

    if (!email || !firstName)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

    // Use magiclink for resend — user already exists, no password needed.
    // Clicking the link confirms the email and creates a session.
    const { data: linkData, error: linkError } = await sb.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${appUrl}/auth/callback` },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[send-confirmation] generateLink:', linkError?.message)
      return NextResponse.json({ error: 'No se pudo generar el enlace' }, { status: 500 })
    }

    const { success, error } = await sendConfirmationEmail(email, firstName, linkData.properties.action_link)
    if (!success) return NextResponse.json({ error }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[send-confirmation]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
