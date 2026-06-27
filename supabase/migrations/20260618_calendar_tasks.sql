-- ═══════════════════════════════════════════════════════════
--  SIGMA Research — Tareas privadas de usuario en el calendario
--  Privadas: cada usuario solo ve y edita las suyas (RLS owner-only).
--  Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.calendar_tasks (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  task_date   DATE        NOT NULL,
  task_time   TEXT        NOT NULL DEFAULT '09:00',
  description TEXT,
  done        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calendar_tasks_updated_at ON public.calendar_tasks;
CREATE TRIGGER calendar_tasks_updated_at
  BEFORE UPDATE ON public.calendar_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_calendar_tasks_date ON public.calendar_tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_user ON public.calendar_tasks(user_id);

-- ─── Row Level Security — solo el propietario, sin excepciones ────────────────
ALTER TABLE public.calendar_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_tasks_own"
  ON public.calendar_tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Realtime ──────────────────────────────────────────────────────────────────
-- Ejecutar también en Supabase Dashboard → Database → Replication → calendar_tasks → enable
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_tasks;

-- ═══════════════════════════════════════════════════════════
--  Cierre de hueco en macro_events: cualquier usuario autenticado
--  podía insertar/editar/borrar eventos del calendario PÚBLICO
--  (owner_insert/update/delete con WITH CHECK auth.uid()=user_id,
--  pero el botón "+ EVENTO" no estaba restringido a admin).
--  El calendario real ahora lo llena el cron (service role, bypassa RLS).
--  Las tareas personales van a calendar_tasks (privadas, arriba).
-- ═══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "owner_insert" ON public.macro_events;
DROP POLICY IF EXISTS "owner_update" ON public.macro_events;
DROP POLICY IF EXISTS "owner_delete" ON public.macro_events;
-- "authenticated_read" se mantiene: todos pueden seguir leyendo el calendario real.
