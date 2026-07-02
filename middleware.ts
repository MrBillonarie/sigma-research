import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  // Renta Fija y Fondos Mutuos: sacados de circulación para todos los
  // usuarios por ahora (se evalúa más adelante dejarlos solo para usuarios
  // particulares). El código de las páginas queda intacto, solo se bloquea
  // el acceso vía redirect.
  if (pathname === '/comparador/renta-fija' || pathname.startsWith('/comparador/renta-fija/') ||
      pathname === '/comparador/fondos-mutuos' || pathname.startsWith('/comparador/fondos-mutuos/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/comparador/etfs'
    url.search   = ''
    return NextResponse.redirect(url)
  }

  // /admin (login page): pasa siempre
  if (pathname === '/admin') return NextResponse.next()

  // /admin/* (dashboard y subrutas): requieren cookie HMAC válida
  if (pathname.startsWith('/admin/')) {
    const sessionCookie = request.cookies.get('sigma_admin_session')?.value ?? ''
    const valid = await verifyAdminSession(sessionCookie)
    if (!valid) {
      const adminUrl = request.nextUrl.clone()
      adminUrl.pathname = '/admin'
      adminUrl.search   = ''
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
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search   = ''
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
