-- ─────────────────────────────────────────────────────────────────────────────
-- /journal (trade manual): el formulario siempre intenta guardar pnl_pct,
-- pero esa columna nunca existió en la tabla trades — cada insert fallaba con
-- PGRST204 ("Could not find the 'pnl_pct' column"), y el formulario se
-- limpiaba igual aunque el guardado fallara silenciosamente (sin aviso).
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS pnl_pct numeric DEFAULT 0;
