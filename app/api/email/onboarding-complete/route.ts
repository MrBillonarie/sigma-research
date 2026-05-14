import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import * as React from 'react'
import OnboardingCompleteEmail from '@/emails/OnboardingCompleteEmail'

export async function POST(req: NextRequest) {
  try {
    const { email, nombre, perfil } = await req.json() as {
      email: string
      nombre: string
      perfil: 'retail' | 'trader' | 'institucional'
    }

    if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 })

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return NextResponse.json({ ok: true }) // silencioso en dev

    const resend = new Resend(resendKey)
    const html   = await render(React.createElement(OnboardingCompleteEmail, {
      firstName: nombre || 'Trader',
      perfil:    perfil || 'trader',
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigma-research.io'}/home`,
    }))

    const domainVerified = process.env.DOMAIN_VERIFIED === 'true'
    const adminTo = process.env.EMAIL_ADMIN_TO ?? 'squantdesk@gmail.com'
    const dest    = domainVerified ? email : adminTo
    const subj    = domainVerified
      ? `${nombre || 'Trader'}, tu configuración en Sigma está lista`
      : `[ONBOARDING] ${nombre || 'Trader'} (${email}) — perfil: ${perfil}`

    const { error } = await resend.emails.send({
      from:    process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
      to:      dest,
      subject: subj,
      html,
    })

    if (error) {
      console.error('[email:onboarding-complete]', error)
      return NextResponse.json({ ok: false, error: error.message })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[email:onboarding-complete]', e)
    return NextResponse.json({ ok: true }) // falla silenciosa — no bloquea onboarding
  }
}
