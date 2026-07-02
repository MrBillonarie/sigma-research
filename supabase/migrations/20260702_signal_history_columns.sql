-- ─────────────────────────────────────────────────────────────────────────────
-- SIGMA RESEARCH — Columnas faltantes en signal_history (2026-07-02)
-- El cron motor-signals insertaba con catch silencioso y fallaba por columnas
-- inexistentes; el pipeline de accuracy nunca acumulaba datos.
-- Correr en: Supabase Dashboard → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS ticker           TEXT;
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS name             TEXT;
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS asset_class      TEXT;
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS signal           TEXT;
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS score            NUMERIC;
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS r1m              NUMERIC;
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS r1y              NUMERIC;
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS profile          TEXT;
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS generated_at     TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS price_at_signal  NUMERIC;
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS conditions_met   INT;
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS conditions_total INT;
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS regime           TEXT;

CREATE INDEX IF NOT EXISTS idx_signal_history_gen ON signal_history(generated_at DESC);
