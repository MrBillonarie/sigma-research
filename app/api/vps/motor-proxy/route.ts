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

// PERF-7: la cookie de sesión del motor y el HTML del dashboard se cachean a
// nivel de módulo. Antes se hacía login (POST /login) + GET del dashboard en
// CADA carga de /hud = 2 round-trips al VPS por request. El dashboard es el
// mismo para todos (el gating por plan ocurre en los data-endpoints motor-api),
// así que un microcache de segundos es seguro.
let _session: { cookie: string; ts: number } | null = null
const SESSION_TTL = 5 * 60_000
let _htmlCache: { body: string; ts: number } | null = null
const HTML_TTL = 5_000

async function getAuthCookie(force = false): Promise<string> {
  if (!force && _session && Date.now() - _session.ts < SESSION_TTL) return _session.cookie
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
  const val = match ? match[1] : ''
  if (val) _session = { cookie: val, ts: Date.now() }
  return val
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
    // 0. Microcache: el dashboard reescrito es el mismo para todos → si está
    //    fresco, se sirve sin tocar el VPS.
    if (_htmlCache && Date.now() - _htmlCache.ts < HTML_TTL) {
      return new NextResponse(_htmlCache.body, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }

    // 1-2. Sesión del motor (cacheada) + GET del dashboard. Si vuelve no-ok, se
    //      reintenta UNA vez con login fresco (la sesión pudo expirar en el motor).
    let html = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      const sessionCookie = await getAuthCookie(attempt === 1)
      const res = await fetch(VPS, {
        headers: sessionCookie ? { Cookie: sessionCookie } : {},
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
      })
      if (res.ok) { html = await res.text(); break }
      _session = null
      if (attempt === 1) throw new Error(`VPS ${res.status}`)
    }

    // 3. Patch all motor JS API calls → squantdesk.com proxy (hides VPS IP)
    html = html.replace(/fetch\('\/api\//g, "fetch('/api/vps/motor-api/")
    html = html.replace(/fetch\("\/api\//g, 'fetch("/api/vps/motor-api/')
    html = html.replace(/fetch\(`\/api\//g, 'fetch(`/api/vps/motor-api/')
    html = html.replace(/(url|href)\s*[:=]\s*'\/api\//g, "$1: '/api/vps/motor-api/")
    html = html.replace(/(url|href)\s*[:=]\s*"\/api\//g, '$1: "/api/vps/motor-api/')

    // 3b. Patch download links → proxy that streams the file (avoids 404 on squantdesk.com)
    html = html.replace(/href="\/download\//g, 'href="/api/vps/motor-download/')
    html = html.replace(/href='\/download\//g, "href='/api/vps/motor-download/")

    // 3c. Patch the browser's live-price fetch. El dashboard del motor pega
    // directo a https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT
    // (Binance SPOT) para todo lo no-commodity. En el embed ese fetch cross-origin
    // lo bloquea el CSP/geo → LIVE cae a `entry` y P&L live queda 0.00% (SOL);
    // y peor, SPOT ni siquiera lista AAPL/XLE (perps tradfi) → siempre stale.
    // Se redirige a un proxy same-origin server-side que usa Binance Futures
    // (tiene los perps AAPL/XLE/SPY/…) + fallback a los caches yfinance del motor.
    html = html.replace(
      /https:\/\/api\.binance\.com\/api\/v3\/ticker\/price\?symbol=/g,
      '/api/vps/binance-price?symbol='
    )

    // 4. Also patch POST /login calls (not needed on squantdesk)
    // Strip login modal entirely — user is already authenticated via squantdesk
    html = html.replace(/id=["']auth[_-]?modal["'][^>]*>[\s\S]*?<\/div>/i, '')


    // 5. Hide the motor engine's own bell/panel/toast notification widget -
    // duplicates the unified sidebar bell (per-model signals are already
    // bridged there via /api/cron/motor-senales), so suppress it here
    // instead of touching dashboard.py (still used standalone off-proxy).
    html = html.replace('</head>', '<style>#bell-btn,#bell-panel,#toast-container{display:none!important}</style></head>')
    _htmlCache = { body: html, ts: Date.now() }
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
