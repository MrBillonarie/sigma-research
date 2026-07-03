import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { verifyEngineMonitorSession } from '@/lib/engineMonitorAuth'

const VPS = process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'
const PASS = process.env.VPS_MOTOR_PASS

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
  // The session cookie comes back in Set-Cookie
  const cookie = res.headers.get('set-cookie') ?? ''
  // Extract just the session value (e.g. "session=xxx; Path=/")
  const match = cookie.match(/([^;]+)/)
  return match ? match[1] : ''
}

export async function GET() {
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

  if (!PASS) {
    console.error('VPS_MOTOR_PASS no está configurada — abortando login al motor.')
    return new NextResponse(
      `<html><body style="background:#020510;color:#c9a227;font-family:monospace;padding:40px">
        <h2>SIGMA ENGINE — configuración incompleta</h2></body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    )
  }

  try {
    // 1. Authenticate with motor to get session cookie
    const sessionCookie = await getAuthCookie()

    // 2. Fetch authenticated dashboard HTML
    const res = await fetch(VPS, {
      headers: sessionCookie ? { Cookie: sessionCookie } : {},
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`VPS ${res.status}`)

    let html = await res.text()

    // 3. Patch all motor JS API calls → squantdesk.com proxy (hides VPS IP)
    html = html.replace(/fetch\('\/api\//g, "fetch('/api/vps/motor-api/")
    html = html.replace(/fetch\("\/api\//g, 'fetch("/api/vps/motor-api/')
    html = html.replace(/fetch\(`\/api\//g, 'fetch(`/api/vps/motor-api/')
    html = html.replace(/(url|href)\s*[:=]\s*'\/api\//g, "$1: '/api/vps/motor-api/")
    html = html.replace(/(url|href)\s*[:=]\s*"\/api\//g, '$1: "/api/vps/motor-api/')

    // 3b. Patch download links → proxy that streams the file (avoids 404 on squantdesk.com)
    html = html.replace(/href="\/download\//g, 'href="/api/vps/motor-download/')
    html = html.replace(/href='\/download\//g, "href='/api/vps/motor-download/")

    // 4. Also patch POST /login calls (not needed on squantdesk)
    // Strip login modal entirely — user is already authenticated via squantdesk
    html = html.replace(/id=["']auth[_-]?modal["'][^>]*>[\s\S]*?<\/div>/i, '')

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return new NextResponse(
      `<html><body style="background:#020510;color:#c9a227;font-family:monospace;padding:40px">
        <h2>SIGMA ENGINE — sin conexión</h2><p>${String(e)}</p>
      </body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    )
  }
}
