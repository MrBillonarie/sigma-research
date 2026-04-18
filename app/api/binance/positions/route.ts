import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function sign(secret: string, query: string) {
  return crypto.createHmac('sha256', secret).update(query).digest('hex')
}

export async function GET(req: NextRequest) {
  try {
    // Obtener usuario autenticado
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'No auth' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Obtener API keys del usuario desde Supabase
    const { data: config } = await supabase
      .from('user_config')
      .select('binance_api_key, binance_api_secret')
      .eq('user_id', user.id)
      .single()

    if (!config?.binance_api_key || !config?.binance_api_secret) {
      return NextResponse.json({ error: 'No Binance API keys configured' }, { status: 400 })
    }

    const { binance_api_key, binance_api_secret } = config

    // Llamar a Binance API — posiciones abiertas en Futures
    const timestamp = Date.now()
    const query = `timestamp=${timestamp}`
    const signature = sign(binance_api_secret, query)

    const response = await fetch(
      `https://fapi.binance.com/fapi/v2/positionRisk?${query}&signature=${signature}`,
      { headers: { 'X-MBX-APIKEY': binance_api_key } }
    )

    const positions = await response.json()

    // Filtrar solo posiciones con size > 0
    const open = Array.isArray(positions)
      ? positions.filter((p: any) => parseFloat(p.positionAmt) !== 0)
      : []

    return NextResponse.json({ positions: open })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
