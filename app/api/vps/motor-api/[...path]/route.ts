import { NextResponse, type NextRequest } from 'next/server'

const VPS = process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'

async function proxy(req: NextRequest, path: string) {
  // Forward query string
  const search = req.nextUrl.search ?? ''
  const url = `${VPS}/api/${path}${search}`

  const init: RequestInit = {
    method: req.method,
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  }

  // Forward body for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const ct = req.headers.get('content-type') ?? ''
    init.headers = { 'Content-Type': ct }
    init.body = await req.arrayBuffer()
  }

  const res = await fetch(url, init)
  const ct = res.headers.get('content-type') ?? 'application/json'
  const body = await res.arrayBuffer()

  return new NextResponse(body, {
    status: res.status,
    headers: {
      'Content-Type': ct,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  try { return await proxy(req, params.path.join('/')) }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 503 }) }
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  try { return await proxy(req, params.path.join('/')) }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 503 }) }
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  try { return await proxy(req, params.path.join('/')) }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 503 }) }
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  try { return await proxy(req, params.path.join('/')) }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 503 }) }
}
