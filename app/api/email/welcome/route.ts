import { NextRequest, NextResponse } from 'next/server'
import { sendWelcome } from '@/lib/email'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { email, nombre } = await req.json().catch(() => ({}))
  if (!email || !nombre) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const { error } = await sendWelcome(email, nombre)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
