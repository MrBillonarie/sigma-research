import { createClient } from '@supabase/supabase-js'

function makeSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export type AuditAction =
  | 'admin.login'
  | 'reporte.create'
  | 'reporte.edit'
  | 'reporte.delete'
  | 'reporte.toggle'
  | 'user.plan_change'
  | 'marketing.send'
  | 'email_directo.send'
  | 'soporte.reply'
  | 'modelo.toggle'
  | 'tasas_dap.update'

export async function logAdminAction(
  action: AuditAction,
  targetId?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await makeSb()
      .from('admin_audit_log')
      .insert({
        actor:     process.env.ADMIN_EMAIL ?? 'admin',
        action,
        target_id: targetId ?? null,
        meta:      meta ?? {},
      })
  } catch {
    // Audit logging never blocks the main operation
  }
}
