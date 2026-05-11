import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC = new Set([
  '/',
  '/login',
  '/registro',
  '/recuperar',
  '/onboarding',
  '/quienes-somos',
  '/terminos',
  '/privacidad',
  '/faq',
  '/contacto',
  '/reportes',
  '/recursos',
])

const PROTECTED = [
  '/home',
  '/terminal',
  '/hud',
  '/journal',
  '/calendario',
  '/modelos',
  '/montecarlo',
  '/lp-defi',
  '/lp-signal',
  '/perfil',
  '/portafolio',
  '/fire',
  '/diagnosticador',
  '/ingresos-pasivos',
  '/tax',
  '/mis-reportes',
  '/motor-decision',
  '/notificaciones',
  '/comparador',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC.has(pathname)) return NextResponse.next()

  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isProtected) return NextResponse.next()

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
    '/home/:path*',
    '/terminal/:path*',
    '/hud/:path*',
    '/journal/:path*',
    '/calendario/:path*',
    '/modelos/:path*',
    '/montecarlo/:path*',
    '/lp-defi/:path*',
    '/lp-signal/:path*',
    '/perfil/:path*',
    '/portafolio/:path*',
    '/fire/:path*',
    '/diagnosticador/:path*',
    '/ingresos-pasivos/:path*',
    '/tax/:path*',
    '/mis-reportes/:path*',
    '/motor-decision/:path*',
    '/notificaciones/:path*',
    '/comparador/:path*',
  ],
}
