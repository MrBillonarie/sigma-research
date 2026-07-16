import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { verifyEngineMonitorSession } from '@/lib/engineMonitorAuth'
import { checkAdminAuth } from '@/lib/adminAuth'
import { getPlanInfo, stripActionableFields } from '@/lib/plan'

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

// Vitrina free: endpoints del motor SIN datos operables que el plan free puede
// ver crudos — exactamente los que consumen el dashboard embebido y el RightBar.
// Todo lo que NO esté aquí ni sea `signals*`/`public` se RECHAZA para no-PRO
// (allowlist fail-closed): champions/matrix/models/portfolio/v2/* llevan
// entrada/SL/TP + sizing y para eso están las rutas dedicadas (/api/vps/*) que
// sí saben filtrar su shape. Cierra el bypass de pedir el crudo por este proxy.
const VITRINA = new Set([
  'trades', 'stats', 'regime', 'm2_prices', 'trainer_status',
  'notifications', 'hud_info', 'lsr', 'health',
])

function stripSignalPayload(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object') return payload
  if (Array.isArray(payload)) return stripActionableFields(payload)
  const out: Record<string, unknown> = { ...(payload as Record<string, unknown>) }
  for (const key of ['models', 'top_models', 'signals']) {
    if (Array.isArray(out[key])) out[key] = stripActionableFields(out[key])
  }
  out.gated = true
  return out
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

  // ── Barrera de lectura por plan (allowlist, fail-closed) ──────────────────
  // Un no-PRO solo lee la vitrina (crudo) y las señales (filtradas). Cualquier
  // otro endpoint del motor se rechaza aquí. Admin/monitoreo/PRO pasan todo.
  const cleanPath = path.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()
  const isSignals = cleanPath === 'signals' || cleanPath.startsWith('signals/') || cleanPath === 'public'
  const isVitrina = VITRINA.has(cleanPath) || cleanPath.startsWith('trades/')
  let stripForFree = false

  if (req.method === 'GET' && !isVitrina) {
    const engineOk = verifyEngineMonitorSession(cookies().get('sigma_engine_session')?.value)
    const adminOk  = checkAdminAuth(req)
    const privileged = engineOk || adminOk || (await getPlanInfo()).isPro
    if (!privileged) {
      if (!isSignals) {
        return NextResponse.json(
          { error: 'Contenido PRO. Accedé desde las vistas de tu plan.' }, { status: 403 }
        )
      }
      // El stream SSE no se puede filtrar campo a campo → para no-PRO va vacío
      // (el dashboard del motor degrada sin live feed, no rompe).
      if (cleanPath === 'signals/stream') {
        return new NextResponse(': gated\n\n', {
          status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' },
        })
      }
      stripForFree = true
    }
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
    const ct0 = req.headers.get('content-type') ?? ''
    init.headers = { 'Content-Type': ct0 }
    init.body = await req.arrayBuffer()
  }

  const res = await fetch(url, init)
  const ct = res.headers.get('content-type') ?? 'application/json'

  // Señales para no-PRO: modelos sin entrada/SL/TP ni sizing.
  if (stripForFree && ct.includes('json')) {
    try {
      const data = await res.json()
      return NextResponse.json(stripSignalPayload(data), {
        status: res.status,
        headers: { 'Cache-Control': 'no-store' },
      })
    } catch {
      return NextResponse.json({ error: 'Respuesta del motor inválida.' }, { status: 502 })
    }
  }

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
