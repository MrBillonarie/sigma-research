import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { verifyEngineMonitorSession } from '@/lib/engineMonitorAuth'
import { checkAdminAuth } from '@/lib/adminAuth'

const VPS = process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'

// El motor hace bypass de auth para requests de localhost sin headers de proxy
// (_is_authenticated en web_server.py), y este proxy reenvía desde 127.0.0.1 sin
// esos headers → el motor confía en cualquier POST que le llegue por aquí. Por eso
// las mutaciones NO pueden quedar abiertas a "cualquier sesión Supabase": un free
// podría cerrar/abrir trades reales o sobreescribir el pine del HUD. Los endpoints
// de escritura del motor solo se exponen a sesión admin firmada; el resto es lectura.
const MUTATING_PATHS = ['trades/open', 'trades/close', 'trades/', 'upload/', 'aum_update']

function isMutatingPath(path: string): boolean {
  const p = path.replace(/^\/+/, '').toLowerCase()
  return MUTATING_PATHS.some(m => p === m || p.startsWith(m))
}

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

  // Barrera de escritura: cualquier método que muta estado (o ruta sensible del
  // motor) exige sesión admin, no basta con estar logueado. Cierra el hueco de
  // que un suscriptor cualquiera dispare trades/close, trades/open o upload.
  const mutating = req.method !== 'GET' || isMutatingPath(path)
  if (mutating && !checkAdminAuth(req)) {
    return NextResponse.json(
      { error: 'Operación restringida: requiere sesión de administrador.' },
      { status: 403 }
    )
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
