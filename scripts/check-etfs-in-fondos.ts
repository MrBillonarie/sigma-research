import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  const { data } = await db
    .from('fondos_mutuos')
    .select('id, nombre, symbol, rent_12m, tac, agf_id')
    .ilike('nombre', '%ETF%')
    .eq('activo', true)
    .order('nombre')

  console.log(`\nTotal ETFs en fondos_mutuos: ${data?.length}\n`)
  data?.forEach(f => {
    const r12 = f.rent_12m != null ? `${f.rent_12m > 0 ? '+' : ''}${f.rent_12m.toFixed(1)}%` : '  —  '
    console.log(`  ${(f.symbol ?? '').padEnd(6)} | ${r12.padStart(7)} | ${f.nombre}`)
  })
}

main().catch(console.error)
