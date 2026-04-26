import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendContactoNotif, sendContactReply } from '@/lib/email'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Simple in-memory rate limiter: max 3 requests per IP per hour ────────────
const ratemap = new Map<string, { count: number; reset: number }>()
function checkRate(ip: string): boolean {
  const now  = Date.now()
  const slot = ratemap.get(ip)
  if (!slot || now > slot.reset) { ratemap.set(ip, { count: 1, reset: now + 3_600_000 }); return true }
  if (slot.count >= 3) return false
  slot.count++
  return true
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!checkRate(ip)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en una hora.' }, { status: 429 })
    }

    const { nombre, empresa, email, motivo, mensaje } = await req.json() as Record<string, string>

    // Validation
    if (!nombre?.trim() || !email?.trim() || !mensaje?.trim())
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: 'Email no válido' }, { status: 400 })

    if (mensaje.trim().length < 10)
      return NextResponse.json({ error: 'Mensaje demasiado corto (mínimo 10 caracteres)' }, { status: 400 })

    if (mensaje.trim().length > 2000)
      return NextResponse.json({ error: 'Mensaje demasiado largo (máximo 2000 caracteres)' }, { status: 400 })

    // Persist to DB (non-blocking on failure)
    await sb.from('contact_submissions').insert({
      nombre:  nombre.trim(),
      empresa: empresa?.trim() || null,
      email:   email.trim().toLowerCase(),
      motivo:  motivo || null,
      mensaje: mensaje.trim(),
    }).then(({ error }) => { if (error) console.error('[/api/contacto] db', error) })

    // Send both emails in parallel — failures are logged, not surfaced
    await Promise.allSettled([
      sendContactoNotif({
        nombre: nombre.trim(), email: email.trim().toLowerCase(),
        empresa: empresa?.trim(), motivo, mensaje: mensaje.trim(),
      }),
      sendContactReply(
        email.trim().toLowerCase(),
        nombre.trim(),
        motivo || 'Consulta general',
        mensaje.trim(),
      ),
    ])

    return NextResponse.json({ ok: true, message: 'Mensaje enviado correctamente' }, { status: 201 })
  } catch (err) {
    console.error('[/api/contacto]', err)
    return NextResponse.json({ error: 'Error interno. Intenta nuevamente.' }, { status: 500 })
  }
}
