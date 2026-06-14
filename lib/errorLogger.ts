import { createClient } from '@supabase/supabase-js'

// Singleton — un solo cliente por proceso, no uno por llamada
let _sb: ReturnType<typeof createClient> | null = null
function getSb() {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }
  return _sb
}

export async function logError(
  endpoint: string,
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error))
  console.error(`[${endpoint}]`, err)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getSb() as any).from('error_logs').insert({
      endpoint,
      error_msg:   err.message,
      error_stack: err.stack ?? null,
      context:     context ?? {},
    })
  } catch {
    // Never throw from error logger
  }
}

export function withErrorTracking<T extends (...args: unknown[]) => Promise<Response>>(
  endpoint: string,
  handler: T,
): T {
  return (async (...args: unknown[]) => {
    try {
      return await handler(...args)
    } catch (e) {
      await logError(endpoint, e)
      throw e
    }
  }) as T
}
