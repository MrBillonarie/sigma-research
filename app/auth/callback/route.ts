import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type') // 'recovery' when coming from password reset email

  // Use NEXT_PUBLIC_APP_URL so redirects work correctly behind a reverse proxy
  // (nginx passes request.url as http://localhost:3000/... — origin would be wrong)
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  if (code || tokenHash) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    // admin.generateLink() (signup/recovery/magiclink emails) issues
    // implicit-flow tokens in the URL hash, which never reaches the server —
    // we build our own links with token_hash+type instead and verify them
    // directly via verifyOtp, fully server-side, no hash fragment involved.
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash! })

    if (!error) {
      // Password reset flow — redirect to set-new-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${appUrl}/nueva-contrasena`)
      }

      // OAuth / magic link — check if user needs onboarding
      const { data: { user } } = await supabase.auth.getUser()
      const onboardingDone = user?.user_metadata?.onboarding_done
      return NextResponse.redirect(`${appUrl}${onboardingDone ? '/home' : '/onboarding'}`)
    }
  }

  // No code or exchange failed — send back to login with error flag
  return NextResponse.redirect(`${appUrl}/login?error=auth_callback_error`)
}
