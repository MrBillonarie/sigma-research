import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { sendContactoNotif, sendContactReply } from '@/lib/email'

function makeSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ─── Supabase-based rate limiter: max 3 por IP por hora (escala en serverless) ─
const _rlFallback = new Map<string, { count: number; reset: number }>()

async function checkRate(ip: string, sb: SupabaseClient): Promise<boolean> {
  const MAX       = 3
  const WINDOW_MS = 3_600_000
  const key       = `rl:contacto:${ip}`
  const resetAt   = new Date(Date.now() + WINDOW_MS).toISOString()

  try {
    const { data, error } = await sb
      .from('rate_limits')
      .select('count, reset_at')
      .eq('id', key)
      .maybeSingle()

    if (error) throw error

    if (!data || new Date(data.reset_at) < new Date()) {
      await sb.from('rate_limits').upsert({ id: key, count: 1, reset_at: resetAt }, { onConflict: 'id' })
      return true
    }
    if (data.count >= MAX) return false
    await sb.from('rate_limits').update({ count: data.count + 1 }).eq('id', key)
    return true
  } catch {
    const now  = Date.now()
    const slot = _rlFallback.get(ip)
    if (!slot || now > slot.reset) { _rlFallback.set(ip, { count: 1, reset: now + WINDOW_MS }); return true }
    if (slot.count >= MAX) return false
    slot.count++
    return true
  }
}

export async function POST(req: NextRequest) {
  // Un solo cliente reutilizado en rate limit + insert
  const sb = makeSb()

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!await checkRate(ip, sb)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en una hora.' }, { status: 429 })
    }

    const { nombre, empresa, email, motivo, mensaje } = await req.json() as Record<string, string>

    if (!nombre?.trim() || !email?.trim() || !mensaje?.trim())
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: 'Email no válido' }, { status: 400 })

    if (mensaje.trim().length < 10)
      return NextResponse.json({ error: 'Mensaje demasiado corto (mínimo 10 caracteres)' }, { status: 400 })

    if (mensaje.trim().length > 2000)
      return NextResponse.json({ error: 'Mensaje demasiado largo (máximo 2000 caracteres)' }, { status: 400 })

    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').trim()

    await sb.from('contact_submissions').insert({
      nombre:  stripHtml(nombre).slice(0, 100),
      empresa: empresa ? stripHtml(empresa).slice(0, 100) : null,
      email:   email.trim().toLowerCase(),
      motivo:  motivo ? stripHtml(motivo).slice(0, 100) : null,
      mensaje: stripHtml(mensaje).slice(0, 2000),
    }).then(({ error }) => { if (error) console.error('[/api/contacto] db', error) })

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
