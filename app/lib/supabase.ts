import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Faltan variables de entorno de Supabase.\n' +
    'Crea .env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  )
}

// createBrowserClient (from @supabase/ssr) persists the session in cookies
// so the Next.js middleware can read it server-side. Do NOT use createClient
// from @supabase/supabase-js here — that uses localStorage and is invisible
// to the middleware, causing every protected route to redirect to /login.
export const supabase = createBrowserClient(url, key)
