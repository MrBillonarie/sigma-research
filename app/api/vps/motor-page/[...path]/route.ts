import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { verifyEngineMonitorSession } from '@/lib/engineMonitorAuth'

const VPS = process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'
const PASS = process.env.VPS_MOTOR_PASS ?? ''

function makeClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

async function getAuthCookie(): Promise<string> {
  const res = await fetch(`${VPS}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `pwd=${PASS}`,
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  })
  const cookie = res.headers.get('set-cookie') ?? ''
  const match = cookie.match(/([^;]+)/)
  return match ? match[1] : ''
}

// Proxy genérico para sub-páginas del motor (ej. /models — "Per-Model Paper
// Trading"), enlazadas desde dentro del dashboard embebido en motor-proxy.
// Mismo patrón de auth y de parcheo de HTML que motor-proxy.ts.
export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const { data: { user } } = await makeClient().auth.getUser()
  const engineCookie = cookies().get('sigma_engine_session')?.value
  if (!user && !verifyEngineMonitorSession(engineCookie)) {
    return new NextResponse(
      `<html><body style="background:#020510;color:#c9a227;font-family:monospace;padding:40px">
        <h2>SIGMA ENGINE — requiere sesión</h2>
      </body></html>`,
      { status: 401, headers: { 'Content-Type': 'text/html' } }
    )
  }

  try {
    const sessionCookie = await getAuthCookie()
    const path = params.path.join('/')

    const res = await fetch(`${VPS}/${path}`, {
      headers: sessionCookie ? { Cookie: sessionCookie } : {},
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`VPS ${res.status}`)

    let html = await res.text()

    html = html.replace(/fetch\('\/api\//g, "fetch('/api/vps/motor-api/")
    html = html.replace(/fetch\("\/api\//g, 'fetch("/api/vps/motor-api/')
    html = html.replace(/fetch\(`\/api\//g, 'fetch(`/api/vps/motor-api/')
    html = html.replace(/(url|href)\s*[:=]\s*'\/api\//g, "$1: '/api/vps/motor-api/")
    html = html.replace(/(url|href)\s*[:=]\s*"\/api\//g, '$1: "/api/vps/motor-api/')
    html = html.replace(/href="\/download\//g, 'href="/api/vps/motor-download/')
    html = html.replace(/href='\/download\//g, "href='/api/vps/motor-download/")
    html = html.replace(/id=["']auth[_-]?modal["'][^>]*>[\s\S]*?<\/div>/i, '')

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return new NextResponse(
      `<html><body style="background:#020510;color:#c9a227;font-family:monospace;padding:40px">
        <h2>SIGMA ENGINE — sin conexión</h2><p>${String(e)}</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
}
