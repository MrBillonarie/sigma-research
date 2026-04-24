import { NextResponse } from 'next/server'

const POOLS: Record<string, string> = {
  btc:  '0x46cf1cf8c69595804ba91dfdd8d6b960c9b0a7c4',
  bnb:  '0x172fcd41e0913e95784454622d1c3724f546f849',
  usdc: '0x4f3126d5de26413abdcf6948943fb9d0847d9818',
}

const FALLBACK = { apr: 0, feeTier: 0.0005, tvl: 0, volume24h: 0, price: 0 }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pool = (searchParams.get('pool') ?? 'btc') as keyof typeof POOLS
  const addr = POOLS[pool] ?? POOLS.btc

  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/bsc/pools/${addr}`,
      { headers: { Accept: 'application/json;version=20230302' }, next: { revalidate: 300 } }
    )
    if (!res.ok) return NextResponse.json(FALLBACK)

    const json = await res.json()
    const data = json.data?.attributes

    console.log('=== GECKO DEBUG ===')
    console.log('URL:', `https://api.geckoterminal.com/api/v2/networks/bsc/pools/${addr}`)
    console.log('Response status:', res.status)
    console.log('Raw JSON:', JSON.stringify(json).substring(0, 500))
    console.log('data.attributes keys:', Object.keys(json.data?.attributes || {}))
    console.log('volume_usd:', json.data?.attributes?.volume_usd)
    console.log('reserve_in_usd:', json.data?.attributes?.reserve_in_usd)
    console.log('=== END DEBUG ===')

    const volume24h = parseFloat(data?.volume_usd?.h24 || '0')
    const tvl       = parseFloat(data?.reserve_in_usd  || '0')
    const feeTier   = pool === 'usdc' ? 0.0001 : 0.0005
    const apr       = tvl > 0 ? (volume24h * feeTier * 365) / tvl * 100 : 0
    const price     = parseFloat(data?.base_token_price_usd || '0')

    return NextResponse.json({ apr, feeTier, tvl, volume24h, price })
  } catch {
    return NextResponse.json(FALLBACK)
  }
}
