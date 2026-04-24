import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { nombre, empresa, email, motivo, mensaje } = await req.json()

    if (!nombre?.trim() || !email?.trim() || !mensaje?.trim()) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
    }

    if (mensaje.trim().length < 20) {
      return NextResponse.json({ error: 'Mensaje demasiado corto' }, { status: 400 })
    }

    const { error } = await sb.from('contact_submissions').insert({
      nombre: nombre.trim(),
      empresa: empresa?.trim() || null,
      email: email.trim().toLowerCase(),
      motivo: motivo || null,
      mensaje: mensaje.trim(),
    })

    if (error) {
      console.error('[/api/contacto]', error)
      return NextResponse.json({ error: 'Error al guardar solicitud' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('[/api/contacto]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
