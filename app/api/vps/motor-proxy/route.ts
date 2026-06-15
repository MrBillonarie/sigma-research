import { NextResponse } from 'next/server'

const VPS = process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'
const PASS = '0808'

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
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
}
