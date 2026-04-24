-- ═══════════════════════════════════════════════════════════
--  SIGMA Research — Macro Events Table
--  Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── Tabla principal ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.macro_events (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT        NOT NULL,
  currency     TEXT        NOT NULL DEFAULT 'USD',
  impact       TEXT        NOT NULL DEFAULT 'MED'
               CHECK (impact IN ('HIGH', 'MED', 'LOW')),
  type         TEXT        NOT NULL DEFAULT 'MACRO'
               CHECK (type IN ('MACRO', 'CRYPTO')),
  event_date   DATE        NOT NULL,
  event_time   TEXT        NOT NULL DEFAULT '00:00',
  previous     TEXT,
  forecast     TEXT,
  actual       TEXT,
  description  TEXT,
  source       TEXT        NOT NULL DEFAULT 'MANUAL',
  is_manual    BOOLEAN     NOT NULL DEFAULT TRUE,
  country      TEXT        NOT NULL DEFAULT 'US',
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Trigger: auto-actualizar updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS macro_events_updated_at ON public.macro_events;
CREATE TRIGGER macro_events_updated_at
  BEFORE UPDATE ON public.macro_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Índices para performance ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_macro_events_date   ON public.macro_events(event_date);
CREATE INDEX IF NOT EXISTS idx_macro_events_impact ON public.macro_events(impact);
CREATE INDEX IF NOT EXISTS idx_macro_events_user   ON public.macro_events(user_id);
CREATE INDEX IF NOT EXISTS idx_macro_events_type   ON public.macro_events(type);

-- ─── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.macro_events ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden leer todos los eventos
CREATE POLICY "authenticated_read"
  ON public.macro_events FOR SELECT
  TO authenticated
  USING (true);

-- Solo el propietario puede crear eventos manuales
CREATE POLICY "owner_insert"
  ON public.macro_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Solo el propietario puede editar sus eventos
CREATE POLICY "owner_update"
  ON public.macro_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Solo el propietario puede borrar sus eventos
CREATE POLICY "owner_delete"
  ON public.macro_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── Habilitar Realtime ────────────────────────────────────────────────────────
-- Ejecutar también en Supabase Dashboard → Database → Replication → macro_events → enable
ALTER PUBLICATION supabase_realtime ADD TABLE public.macro_events;
