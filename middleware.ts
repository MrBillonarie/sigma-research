import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Origen real detras de Caddy -- request.nextUrl.clone() resuelve mal el
// host mientras corre bajo `next start` autohospedado (siempre localhost:3000),
// rompiendo cualquier redirect. Reconstruimos con los headers forwarded.
function getOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')
  const host  = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host
  return `${proto}://${host}`
}

// Rutas que no requieren sesión — todo lo demás queda bloqueado
const PUBLIC = new Set([
  '/',
  '/en',
  '/login',
  '/en/login',
  '/registro',
  '/en/registro',
  '/recuperar',
  '/nueva-contrasena',
  '/auth/callback', // OAuth + password-recovery code exchange (no session exists yet)
  '/quienes-somos',
  '/terminos',
  '/privacidad',
  '/faq',
  '/contacto',
  '/en/contacto',
  '/recursos',
  '/reportes',
  '/planes', // pricing Free vs PRO — destino de los CTA "Activar PRO", visible sin cuenta
  '/roadmap',
  '/white-paper',
  '/api-docs',
  '/offline',
  '/demo',
  '/manifest.webmanifest',
  '/robots.txt',
  '/sitemap.xml',
  '/motor-en-vivo', // gate propio con password compartida, no requiere cuenta Supabase
])

// Verifica HMAC-signed admin session usando Web Crypto (Edge-compatible)
async function verifyAdminSession(cookieValue: string): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET
  if (!secret || !cookieValue) return false

  const dot = cookieValue.lastIndexOf('.')
  if (dot === -1) return false

  const payload = cookieValue.slice(0, dot)
  const sig     = cookieValue.slice(dot + 1)

  try {
    const enc = new TextEncoder()
    const key = await globalThis.crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify'],
    )
    // Decode stored hex signature to bytes
    if (!/^[0-9a-f]{64}$/.test(sig)) return false
    const sigBytes = new Uint8Array(sig.match(/.{2}/g)!.map(h => parseInt(h, 16)))
    // crypto.subtle.verify is timing-safe by spec
    const valid = await globalThis.crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payload))
    if (!valid) return false

    const colon   = payload.lastIndexOf(':')
    if (colon === -1) return false
    const expires = parseInt(payload.slice(colon + 1), 10)
    return !isNaN(expires) && expires > Date.now()
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas: pasan siempre
  if (PUBLIC.has(pathname)) return NextResponse.next()

  // /motor-en-vivo/* (sub-páginas del motor, ej. /motor-en-vivo/models): el
  // gate de password propio vive en la página, no en el middleware.
  if (pathname.startsWith('/motor-en-vivo/')) return NextResponse.next()

  // Secciones retiradas de la web (2026-07-02): Tax, Community Setups, LP
  // Signal y todo el Comparador (ETFs/renta fija/fondos mutuos). Los links
  // antiguos redirigen a /home en vez de dar 404.
  if (pathname === '/tax' || pathname.startsWith('/tax/') ||
      pathname === '/community-setups' || pathname.startsWith('/community-setups/') ||
      pathname === '/lp-signal' || pathname.startsWith('/lp-signal/') ||
      pathname === '/comparador' || pathname.startsWith('/comparador/')) {
    const url = new URL('/home', getOrigin(request))
    return NextResponse.redirect(url)
  }

  // /admin (login page): pasa siempre
  if (pathname === '/admin') return NextResponse.next()

  // /admin/* (dashboard y subrutas): requieren cookie HMAC válida
  if (pathname.startsWith('/admin/')) {
    const sessionCookie = request.cookies.get('sigma_admin_session')?.value ?? ''
    const valid = await verifyAdminSession(sessionCookie)
    if (!valid) {
      const adminUrl = new URL('/admin', getOrigin(request))
      return NextResponse.redirect(adminUrl)
    }
    return NextResponse.next()
  }

  // Todo lo demás requiere sesión Supabase activa
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', getOrigin(request))
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot|otf|map)).*)',
  ],
}
