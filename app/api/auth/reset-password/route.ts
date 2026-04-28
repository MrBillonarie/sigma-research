import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendResetPasswordEmail } from '../../../../lib/email'

// Rate limit: max 3 reset requests per IP per hour
const rateMap = new Map<string, { count: number; reset: number }>()
function checkRate(ip: string): boolean {
  const now  = Date.now()
  const slot = rateMap.get(ip)
  if (!slot || now > slot.reset) { rateMap.set(ip, { count: 1, reset: now + 3_600_000 }); return true }
  if (slot.count >= 3) return false
  slot.count++
  return true
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en una hora.' }, { status: 429 })
  }

  try {
    const { email } = await req.json() as { email: string }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
    }

    const adminSb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Try to get user's name for personalized greeting
    let firstName = 'Trader'
    try {
      const { data } = await adminSb.auth.admin.listUsers({ perPage: 1000 })
      const found = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
      const nombre = found?.user_metadata?.nombre as string | undefined
      if (nombre) firstName = nombre.split(' ')[0]
    } catch { /* ignore — use default */ }

    // Generate recovery link via admin API
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigma-research.vercel.app'}/auth/callback`
    const { data: linkData, error: linkErr } = await adminSb.auth.admin.generateLink({
      type:    'recovery',
      email:   email.toLowerCase(),
      options: { redirectTo },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      // Don't reveal whether email exists — silently succeed
      console.error('[reset-password] generateLink:', linkErr?.message)
      return NextResponse.json({ ok: true })
    }

    await sendResetPasswordEmail(email, firstName, linkData.properties.action_link)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[reset-password]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
