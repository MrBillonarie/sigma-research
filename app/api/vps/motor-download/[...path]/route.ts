import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { verifyEngineMonitorSession } from '@/lib/engineMonitorAuth'
import { getPlanInfo } from '@/lib/plan'

const VPS = process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'

// Proxy de descargas del motor (/download/*) -- mismo patron que motor-api,
// pero forwardeando Content-Disposition para que el navegador dispare el
// "Guardar como" con el nombre de archivo correcto. El fetch hacia el motor
// corre server-side en la misma VPS (127.0.0.1) y no necesita cookie/token
// propio, pero exigimos sesión de squantdesk antes de llegar a este proxy.
//
// Gating por plan: todo lo descargable del motor (.pine de SIGMA TERMINAL /
// strategy / HUD, archivos de modelos, engine) es activo PRO según la tabla
// Free vs PRO. La sesión interna de monitoreo del engine no pasa por planes.
export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const engineCookie = cookies().get('sigma_engine_session')?.value
  const engineOk = verifyEngineMonitorSession(engineCookie)
  const { userId, isPro } = await getPlanInfo()

  if (!userId && !engineOk) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }
  if (!isPro && !engineOk) {
    return NextResponse.json(
      { error: 'Las descargas del motor requieren plan PRO.' },
      { status: 403 }
    )
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
