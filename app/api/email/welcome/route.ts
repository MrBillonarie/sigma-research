import { NextResponse } from 'next/server'
import { sendWelcome } from '@/lib/email'

export async function POST(req: Request) {
  const { email, nombre } = await req.json()
  if (!email || !nombre) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const { error } = await sendWelcome(email, nombre)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
