import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.ADMIN_SECRET ?? 'adminsigma'
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const client = sb()
  const hoy = new Date().toISOString().slice(0, 10)

  const [
    { count: fondosTotal },
    { count: fondosHoy },
    { data: fondosRecent },
    { count: etfsTotal },
    { data: etfsRecent },
    { count: agfTotal },
  ] = await Promise.all([
    client.from('fondos_mutuos').select('*', { count: 'exact', head: true }),
    client.from('fondos_mutuos').select('*', { count: 'exact', head: true }).gte('updated_at', hoy + 'T00:00:00'),
    client.from('fondos_mutuos').select('updated_at').order('updated_at', { ascending: false }).limit(1),
    client.from('etfs').select('*', { count: 'exact', head: true }),
    client.from('etfs').select('updated_at').order('updated_at', { ascending: false }).limit(1),
    client.from('agf').select('*', { count: 'exact', head: true }),
  ])

  return NextResponse.json({
    fondos: {
      total: fondosTotal ?? 0,
      updatedToday: fondosHoy ?? 0,
      lastUpdate: fondosRecent?.[0]?.updated_at ?? null,
      pctToday: fondosTotal ? Math.round(((fondosHoy ?? 0) / fondosTotal) * 100) : 0,
    },
    etfs: {
      total: etfsTotal ?? 0,
      lastUpdate: etfsRecent?.[0]?.updated_at ?? null,
    },
    agf: {
      total: agfTotal ?? 0,
    },
  })
}
