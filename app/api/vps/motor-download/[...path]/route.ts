import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { getPlanInfo } from '@/lib/plan'
import { checkAdminSessionCookie } from '@/lib/adminAuth'

const VPS = process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'

// Proxy de descargas del motor (/download/*) -- mismo patron que motor-api,
// pero forwardeando Content-Disposition para que el navegador dispare el
// "Guardar como" con el nombre de archivo correcto. El fetch hacia el motor
// corre server-side en la misma VPS (127.0.0.1) y no necesita cookie/token propio.
//
// Gating por plan: el .pine de SIGMA TERMINAL (y strategy/HUD/modelos/engine) es
// el activo PRO más valioso → exige plan PRO o sesión de ADMIN. Ojo: NO se acepta
// la sesión de monitoreo del engine (sigma_engine_session) como bypass — esa se
// obtiene con la contraseña compartida de /motor-en-vivo (ruta pública, sin
// cuenta), un candado más débil que pagar PRO; aceptarla dejaba descargar la joya
// a cualquiera que conociera esa clave interna (leak detectado 2026-07-10).
export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const isAdmin = checkAdminSessionCookie(cookies().get('sigma_admin_session')?.value)
  const { userId, isPro } = await getPlanInfo()

  if (!userId && !isAdmin) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }
  if (!isPro && !isAdmin) {
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
