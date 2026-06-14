-- ─────────────────────────────────────────────────────────────────────────────
-- Sigma Research — Admin tables migration
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Paste → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. admin_modelos ─────────────────────────────────────────────────────────
-- Estado persistente de los toggles ON/OFF del panel admin de modelos ML.

CREATE TABLE IF NOT EXISTS public.admin_modelos (
  tag        TEXT PRIMARY KEY,
  activo     BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Datos iniciales (los 6 modelos del panel)
INSERT INTO public.admin_modelos (tag, activo) VALUES
  ('HMM-01',   true),
  ('GARCH-02', true),
  ('XGB-03',   true),
  ('NLP-04',   false),
  ('STAT-05',  true),
  ('VAR-06',   true)
ON CONFLICT (tag) DO NOTHING;

-- RLS: solo el service_role (admin API) puede leer y escribir
ALTER TABLE public.admin_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_modelos"
  ON public.admin_modelos
  USING (auth.role() = 'service_role');


-- ── 2. admin_campanas ────────────────────────────────────────────────────────
-- Historial de campañas de marketing enviadas desde el panel admin.

CREATE TABLE IF NOT EXISTS public.admin_campanas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segmento    TEXT NOT NULL DEFAULT 'todos',  -- 'todos' | 'pro' | 'free'
  subject     TEXT NOT NULL,
  title       TEXT,
  sent_count  INTEGER NOT NULL DEFAULT 0,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: solo el service_role (admin API) puede leer y escribir
ALTER TABLE public.admin_campanas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_campanas"
  ON public.admin_campanas
  USING (auth.role() = 'service_role');


-- ── Verificación ─────────────────────────────────────────────────────────────
SELECT 'admin_modelos' AS tabla, count(*) AS filas FROM public.admin_modelos
UNION ALL
SELECT 'admin_campanas', count(*) FROM public.admin_campanas;
