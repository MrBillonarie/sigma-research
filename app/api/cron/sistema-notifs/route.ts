export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Macro events (kept in sync with home/page.tsx)
const MACRO_EVENTS = [
  { date: '2026-04-30', time: '08:30 UTC', title: 'PCE Price Index (YoY)' },
  { date: '2026-05-01', time: '08:30 UTC', title: 'NFP (Non-Farm Payrolls)' },
  { date: '2026-05-06', time: '18:00 UTC', title: 'FOMC Meeting (Día 1)' },
  { date: '2026-05-07', time: '18:00 UTC', title: 'FOMC Decision + Press Conference' },
  { date: '2026-05-13', time: '08:30 UTC', title: 'CPI (YoY) — Mayo' },
  { date: '2026-05-29', time: '08:30 UTC', title: 'GDP Q1 2026 (Revisado)' },
  { date: '2026-06-05', time: '08:30 UTC', title: 'NFP — Junio' },
  { date: '2026-06-11', time: '08:30 UTC', title: 'CPI (YoY) — Junio' },
  { date: '2026-06-17', time: '18:00 UTC', title: 'FOMC Decision — Junio' },
  { date: '2026-06-26', time: '08:30 UTC', title: 'PCE Price Index — Junio' },
]

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = serviceClient()
  const now      = new Date()
  const results: string[] = []

  // ── 1. Macro events in < 24h ──────────────────────────────────────────────
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const todayStr     = now.toISOString().split('T')[0]
  const tomorrowStr  = tomorrow.toISOString().split('T')[0]

  const upcomingMacro = MACRO_EVENTS.filter(e => e.date === tomorrowStr || e.date === todayStr)

  for (const ev of upcomingMacro) {
    // Check if we already notified today for this event
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'mercado')
      .like('body', `%${ev.title}%`)
      .gte('created_at', new Date(now.getTime() - 23 * 3600 * 1000).toISOString())
      .limit(1)

    if (existing && existing.length > 0) continue

    // Get all user IDs
    const { data: profiles } = await supabase.from('profiles').select('id')
    if (!profiles) continue

    const rows = profiles.map((p: { id: string }) => ({
      user_id:      p.id,
      type:         'mercado',
      title:        'Evento macro mañana',
      body:         `${ev.title} · ${ev.date} · ${ev.time}`,
      urgente:      true,
      accion_label: 'Ver calendario',
      accion_href:  '/calendario',
      read:         false,
    }))

    const { error } = await supabase.from('notifications').insert(rows)
    if (!error) results.push(`macro:${ev.title}`)
  }

  // ── 2. Market movements ±2% (BTC, ETH, XAU proxy via SPX) ────────────────
  try {
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
      { next: { revalidate: 0 } }
    )
    if (cgRes.ok) {
      const prices = await cgRes.json()
      const assets = [
        { id: 'bitcoin',  symbol: 'BTC',  data: prices.bitcoin },
        { id: 'ethereum', symbol: 'ETH',  data: prices.ethereum },
        { id: 'solana',   symbol: 'SOL',  data: prices.solana },
      ]

      for (const asset of assets) {
        if (!asset.data) continue
        const change24h: number = asset.data.usd_24h_change ?? 0
        if (Math.abs(change24h) < 2) continue

        const dir      = change24h > 0 ? '+' : ''
        const tag      = `market:${asset.symbol}:${todayStr}`

        // Avoid duplicate for same day
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('type', 'mercado')
          .like('title', `%${asset.symbol}%`)
          .gte('created_at', new Date(now.getTime() - 12 * 3600 * 1000).toISOString())
          .limit(1)

        if (existing && existing.length > 0) continue

        const { data: profiles } = await supabase.from('profiles').select('id')
        if (!profiles) continue

        const rows = profiles.map((p: { id: string }) => ({
          user_id:      p.id,
          type:         'mercado',
          title:        `Movimiento relevante: ${asset.symbol}`,
          body:         `${asset.symbol} ${dir}${change24h.toFixed(1)}% en las últimas 24h · $${Math.round(asset.data.usd).toLocaleString()}`,
          urgente:      Math.abs(change24h) >= 5,
          accion_label: 'Ver terminal',
          accion_href:  '/terminal',
          read:         false,
        }))

        const { error } = await supabase.from('notifications').insert(rows)
        if (!error) results.push(tag)
      }
    }
  } catch { /* market API unavailable */ }

  return NextResponse.json({ ok: true, generated: results })
}

// GET — dry run preview (no DB writes)
export async function GET() {
  const now         = new Date()
  const tomorrowStr = new Date(now.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0]
  const todayStr    = now.toISOString().split('T')[0]

  const upcoming = MACRO_EVENTS.filter(e => e.date === tomorrowStr || e.date === todayStr)
  return NextResponse.json({
    dry_run:         true,
    today:           todayStr,
    tomorrow:        tomorrowStr,
    macro_upcoming:  upcoming,
  })
}
