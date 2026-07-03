import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { verifyEngineMonitorSession } from '@/lib/engineMonitorAuth'

const VPS = process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'

function makeClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

async function proxy(req: NextRequest, path: string) {
  const { data: { user } } = await makeClient().auth.getUser()
  const engineCookie = cookies().get('sigma_engine_session')?.value
  if (!user && !verifyEngineMonitorSession(engineCookie)) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

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
