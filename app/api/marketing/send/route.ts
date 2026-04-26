import { NextRequest, NextResponse } from 'next/server'
import { sendMarketingEmail, MarketingPayload } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    // Protect with API secret header
    const secret = req.headers.get('x-admin-secret')
    if (!secret || secret !== process.env.ADMIN_SECRET)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subject, recipients, payload } = await req.json() as {
      subject: string
      recipients: string[]
      payload: MarketingPayload
    }

    if (!subject || !recipients?.length || !payload)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    if (recipients.length > 500)
      return NextResponse.json({ error: 'Max 500 recipients per request' }, { status: 400 })

    const { success, error } = await sendMarketingEmail(recipients, subject, payload)
    if (!success) return NextResponse.json({ error }, { status: 500 })

    return NextResponse.json({ ok: true, sent: recipients.length })
  } catch (e) {
    console.error('[/api/marketing/send]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
