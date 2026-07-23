// Lista de destinatarios para los avisos de reportes.
//
// Los emails viven en Supabase Auth (auth.users), NO en `profiles` — esa tabla
// no tiene columna email. El aviso de nuevo reporte consultaba `profiles.email`
// y fallaba en silencio (catch que traga el error), así que nunca salía ningún
// correo. Este módulo es la fuente correcta y única.

import { createClient } from '@supabase/supabase-js'

export interface Destinatario { email: string; nombre: string }

const PER = 1000
const MAX_PAGINAS = 20   // techo de seguridad: 20.000 usuarios

/**
 * @param soloConfirmados por defecto true — mandar a direcciones sin confirmar
 *   ensucia la reputación del remitente y dispara rebotes.
 */
export async function listarDestinatarios(soloConfirmados = true): Promise<Destinatario[]> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const out: Destinatario[] = []
  const vistos = new Set<string>()

  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: PER })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const users = data?.users ?? []
    if (!users.length) break

    for (const u of users) {
      if (!u.email) continue
      if (soloConfirmados && !u.email_confirmed_at) continue
      const email = u.email.toLowerCase()
      if (vistos.has(email)) continue
      vistos.add(email)
      out.push({
        email: u.email,
        nombre: (u.user_metadata?.nombre as string) || u.email.split('@')[0],
      })
    }

    if (users.length < PER) break
  }

  return out
}
