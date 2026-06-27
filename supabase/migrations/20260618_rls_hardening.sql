-- ═══════════════════════════════════════════════════════════
--  SIGMA Research — RLS hardening
--  Tablas que tenian datos de negocio sin RLS habilitado. Hoy el riesgo es bajo
--  (todo el acceso pasa por rutas server-side con SUPABASE_SERVICE_ROLE_KEY, que
--  bypassa RLS de todos modos) pero es una trampa latente: si alguna vez se
--  agrega una llamada desde el cliente con la key anon, estas tablas quedarian
--  100% abiertas a lectura/escritura publica sin que nadie lo note.
--  Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- agf / fondos_mutuos (20260426_fondos_mutuos.sql)
ALTER TABLE IF EXISTS public.agf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only_agf" ON public.agf;
CREATE POLICY "service_role_only_agf" ON public.agf USING (auth.role() = 'service_role');

ALTER TABLE IF EXISTS public.fondos_mutuos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only_fondos_mutuos" ON public.fondos_mutuos;
CREATE POLICY "service_role_only_fondos_mutuos" ON public.fondos_mutuos USING (auth.role() = 'service_role');

-- signal_history (20260427_signal_history.sql, 20260428_signal_history_v2.sql)
ALTER TABLE IF EXISTS public.signal_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only_signal_history" ON public.signal_history;
CREATE POLICY "service_role_only_signal_history" ON public.signal_history USING (auth.role() = 'service_role');

-- tasas_dap (20260427_tasas_dap.sql)
ALTER TABLE IF EXISTS public.tasas_dap ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only_tasas_dap" ON public.tasas_dap;
CREATE POLICY "service_role_only_tasas_dap" ON public.tasas_dap USING (auth.role() = 'service_role');

-- contact_submissions y admin_audit_log: creadas fuera de las migraciones del
-- repo (directo en el SQL Editor en algun momento). Si no existen, el ALTER se
-- ignora silenciosamente gracias a IF EXISTS.
ALTER TABLE IF EXISTS public.contact_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only_contact_submissions" ON public.contact_submissions;
CREATE POLICY "service_role_only_contact_submissions" ON public.contact_submissions USING (auth.role() = 'service_role');

ALTER TABLE IF EXISTS public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only_admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "service_role_only_admin_audit_log" ON public.admin_audit_log USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════
--  NOTA — admin_sessions (creada en 20260605_admin_security.sql)
--  Iba a reemplazar el secret crudo en la cookie de admin por un token opaco,
--  pero lib/adminAuth.ts terminó usando cookies HMAC-firmadas *stateless* en su
--  lugar. La tabla nunca se lee ni se escribe en ningún archivo del repo —
--  no es una vulnerabilidad (ya tiene RLS service-role-only) pero es deuda
--  técnica: no hay revocación server-side de sesiones admin activas, solo
--  expiran por tiempo (2h). Si se quiere "cerrar sesión en todos los
--  dispositivos" en el futuro, implementarlo usando esta tabla en vez de
--  crear una nueva. No se elimina la tabla aquí (acción destructiva, sin
--  beneficio de seguridad real ya que está correctamente bloqueada).
-- ═══════════════════════════════════════════════════════════

-- ─── Verificación ────────────────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('agf','fondos_mutuos','signal_history','tasas_dap','contact_submissions','admin_audit_log');
