import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED = [
  '/terminal',
  '/hud',
  '/journal',
  '/calendario',
  '/reportes',
  '/modelos',
  '/montecarlo',
  '/lp-defi',
  '/perfil',
  '/admin',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only run on protected routes
  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isProtected) return NextResponse.next()

  const response = NextResponse.next()

  // Build a Supabase server client that reads/writes cookies on the request
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

  // getUser() refreshes the session if it's expired and verifies the JWT
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname) // preserve intended destination
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/terminal/:path*',
    '/hud/:path*',
    '/journal/:path*',
    '/calendario/:path*',
    '/reportes/:path*',
    '/modelos/:path*',
    '/montecarlo/:path*',
    '/lp-defi/:path*',
    '/perfil/:path*',
    '/admin/:path*',
  ],
}
