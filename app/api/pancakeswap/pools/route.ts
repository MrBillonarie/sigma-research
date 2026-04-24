import { NextResponse } from 'next/server'

const POOL_ADDRESSES: Record<string, string> = {
  btc:  '0x46Cf1cF8c69595804ba91dFdd8d6b960c9B0a7C4',
  bnb:  '0x172fcD41E0913e95784454622d1c3724f546f849',
  usdc: '0xf972ab87b37e5b77c7b3a5e87d0fa41d5b6b19ac',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pool = searchParams.get('pool') ?? 'btc'
  const addr = POOL_ADDRESSES[pool] ?? POOL_ADDRESSES.btc

  try {
    const res = await fetch(
      `https://api.pancakeswap.info/api/v3/bsc/pools/${addr}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 300 } }
    )
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 })
  }
}
