import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ─── Plan del usuario — única fuente de verdad ────────────────────────────────
// El plan vive en app_metadata.plan (solo escribible via service role desde el
// admin — el usuario no puede editarlo). getUser() valida el JWT contra el
// servidor de auth y devuelve el registro fresco, así que un cambio de plan por
// admin se refleja sin esperar el refresh del token.
//
// Valores conocidos de plan: 'free' (default), 'pro', 'anual'.
// 'anon' = sin sesión.

export interface PlanInfo {
  userId: string | null
  plan: string
  isPro: boolean   // pro o anual — acceso a lo accionable
}

export async function getPlanInfo(): Promise<PlanInfo> {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, plan: 'anon', isPro: false }
    const plan = (user.app_metadata?.plan as string) ?? 'free'
    return { userId: user.id, plan, isPro: plan === 'pro' || plan === 'anual' }
  } catch {
    // Ante cualquier fallo de auth se degrada a anónimo — nunca a PRO
    return { userId: null, plan: 'anon', isPro: false }
  }
}

// ─── Filtrado de campos accionables (señales) ─────────────────────────────────
// Para usuarios no-PRO se eliminan del payload los campos que convierten una
// señal en operable: entrada/SL/TP y todo el sizing (Kelly, notional, riesgo).
// Los estados, grades y métricas de performance (win rate, CAGR, DD) quedan —
// son la vitrina del plan free. El filtrado es server-side: un blur en el
// cliente no protege nada.
const ACTIONABLE_FIELDS = new Set([
  'price', 'sl', 'tp',
  'open_trade_entry',
  'notional_usd', 'risk_usd', 'reward_usd_at_tp',
  'size_factor_x', 'equity_used',
  'eff_risk_pct', '_kelly_ledger',
])

function stripFields<T>(list: T, fields: Set<string>): T {
  if (!Array.isArray(list)) return list
  return list.map(item => {
    if (item === null || typeof item !== 'object') return item
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(item)) {
      if (!fields.has(k)) out[k] = v
    }
    return out
  }) as T
}

export function stripActionableFields<T>(list: T): T {
  return stripFields(list, ACTIONABLE_FIELDS)
}

// ─── Detalle del Inspector de modelos — PRO ───────────────────────────────────
// La vitrina queda libre (grade, CAGR, WR, DD, trades, veredictos resumidos
// wft_verdict/val_mc que se muestran en la card). El detalle de validación
// profunda y sizing (walk-forward, Monte Carlo, Kelly, live/bayesian,
// robustez) es del Inspector expandido → exclusivo PRO.
const INSPECTOR_FIELDS = new Set([
  'val_wft', 'wft_windows', 'wft_pass_rate',
  'mc_confidence', 'mc_cagr_p05', 'mc_dd_p95', 'val_confidence',
  'score', 'robustness_score', 'robustness_action', 'robustness_gates',
  'n_live_trades', 'live_wr', 'ev',
  'lsr', 'lsr_long_pct', 'oi_change_pct', 'funding_pct', 'fg', 'fg_label',
  'recommendation', 'reason', 'regime_ok',
  'stress_mult', 'ens_mult', 'conf_mult',
])

export function stripInspectorFields<T>(list: T): T {
  return stripFields(list, INSPECTOR_FIELDS)
}
