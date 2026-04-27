import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  // Reactivar todos los ETFs chilenos (Singular, IT NOW, Zurich) — dejar solo VTV desactivado
  const { data, error } = await db
    .from('fondos_mutuos')
    .update({ activo: true })
    .ilike('nombre', '%ETF%')
    .not('nombre', 'ilike', '%Vanguard%')
    .eq('activo', false)
    .select('nombre')

  if (error) { console.error('Error:', error.message); return }
  console.log(`Reactivados ${data?.length} fondos chilenos:`)
  data?.forEach(f => console.log(`  ✓ ${f.nombre}`))
}

main().catch(console.error)
