import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  // Solo desactivar ETFs reales (que tienen ticker sin prefijo FINV-)
  // Los Fondos de Inversión ETF Singular tienen IDs tipo FINV-XXXX → se quedan
  const { data, error } = await db
    .from('fondos_mutuos')
    .update({ activo: false })
    .ilike('nombre', '%ETF%')
    .not('id', 'ilike', 'FINV-%')
    .select('id, nombre')

  if (error) { console.error('Error:', error.message); return }
  console.log(`Desactivados ${data?.length} ETFs reales de fondos_mutuos:`)
  data?.forEach(f => console.log(`  ✓ ${f.nombre}`))
}

main().catch(console.error)
