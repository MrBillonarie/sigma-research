import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { signalId } = await req.json()
  if (!signalId) {
    return NextResponse.json({ error: 'signalId requerido' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Desactivar señal activa anterior
  await supabase
    .from('lp_signals')
    .update({ is_active: false })
    .eq('is_active', true)

  // Activar la señal aprobada
  const { data, error } = await supabase
    .from('lp_signals')
    .update({
      is_active:         true,
      requires_approval: false,
      approved_at:       new Date().toISOString(),
      approved_by:       'admin',
      published_at:      new Date().toISOString(),
    })
    .eq('id', signalId)
    .select()
    .single()

  if (error) return NextResponse.json({ error }, { status: 500 })

  // Notificar a todos los usuarios con una entrada en la tabla notifications
  // Obtenemos los user_ids desde profiles (todos los usuarios registrados)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')

  if (Array.isArray(profiles) && profiles.length > 0) {
    const rows = profiles.map((p: { id: string }) => ({
      user_id: p.id,
      title:   'Nueva señal LP activa',
      body:    data.hyp_text,
      type:    'lp_signal',
      read:    false,
    }))
    await supabase.from('notifications').insert(rows)
  }

  return NextResponse.json({ data })
}
