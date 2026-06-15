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
  '/quienes-somos',
  '/terminos',
  '/privacidad',
  '/faq',
  '/contacto',
  '/en/contacto',
  '/recursos',
  '/reportes',
  '/offline',
  '/demo',
  '/sigma-live',
])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas: pasan siempre
  if (PUBLIC.has(pathname)) return NextResponse.next()

  // Admin: tiene su propio sistema de auth HMAC (cookie sigma_admin_session)
  if (pathname.startsWith('/admin')) return NextResponse.next()

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
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    // Aplica a todas las rutas excepto assets estáticos y rutas de API
    // Las rutas /api/ manejan su propio auth internamente
    '/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot|otf|map)).*)',
  ],
}
