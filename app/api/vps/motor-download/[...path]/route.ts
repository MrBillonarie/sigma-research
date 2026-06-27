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

// Proxy de descargas del motor (/download/*) -- mismo patron que motor-api,
// pero forwardeando Content-Disposition para que el navegador dispare el
// "Guardar como" con el nombre de archivo correcto. El fetch hacia el motor
// corre server-side en la misma VPS (127.0.0.1) y no necesita cookie/token
// propio, pero exigimos sesión de squantdesk antes de llegar a este proxy.
export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const { data: { user } } = await makeClient().auth.getUser()
  const engineCookie = cookies().get('sigma_engine_session')?.value
  if (!user && !verifyEngineMonitorSession(engineCookie)) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  try {
    const path = params.path.join('/')
    const url = `${VPS}/download/${path}`

    const res = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
    const body = await res.arrayBuffer()

    const headers: Record<string, string> = {
      'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    }
    const disposition = res.headers.get('content-disposition')
    if (disposition) headers['Content-Disposition'] = disposition

    return new NextResponse(body, { status: res.status, headers })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 503 })
  }
}
