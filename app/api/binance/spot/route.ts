export const dynamic = 'force-dynamic'
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
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'No auth' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: config } = await supabase
      .from('user_config')
      .select('binance_api_key, binance_api_secret')
      .eq('user_id', user.id)
      .single()

    if (!config?.binance_api_key || !config?.binance_api_secret) {
      return NextResponse.json({ error: 'No Binance API keys configured' }, { status: 400 })
    }

    const { binance_api_key, binance_api_secret } = config
    const timestamp = Date.now()
    const query = `timestamp=${timestamp}`
    const signature = sign(binance_api_secret, query)

    // Spot — balances con valor > 0
    const response = await fetch(
      `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
      { headers: { 'X-MBX-APIKEY': binance_api_key } }
    )

    const account = await response.json()

    if (account.code) {
      return NextResponse.json({ error: account.msg }, { status: 400 })
    }

    const balances = (account.balances ?? []).filter(
      (b: { free: string; locked: string }) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
    )

    return NextResponse.json({ balances })
  } catch (err) {
    console.error('[/api/binance/spot]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
