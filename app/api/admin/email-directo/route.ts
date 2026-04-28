import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { sendSoporteRespuesta } from '@/lib/email'

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { email, nombre, mensaje } = await req.json()
  if (!email || !mensaje) {
    return NextResponse.json({ error: 'email y mensaje requeridos' }, { status: 400 })
  }

  const result = await sendSoporteRespuesta(
    email,
    nombre || 'Trader',
    '(Mensaje directo del administrador)',
    mensaje,
  )

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
