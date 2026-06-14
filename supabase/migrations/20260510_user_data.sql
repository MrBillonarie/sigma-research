-- ─────────────────────────────────────────────────────────────────────────────
-- SIGMA RESEARCH — Portfolio + FIRE sync
-- El journal ya usa las tablas 'trades' y 'csv_trades' (existentes).
-- Esta migración agrega portfolio y FIRE persistidos en Supabase.
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Portfolio snapshot por plataforma
CREATE TABLE IF NOT EXISTS user_portfolio (
  user_id    UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform   TEXT  NOT NULL,
  value_usd  NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, platform)
);

ALTER TABLE user_portfolio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portfolio_own" ON user_portfolio FOR ALL USING (auth.uid() = user_id);

-- 2. Configuración FIRE del usuario
CREATE TABLE IF NOT EXISTS user_fire (
  user_id        UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_usd     NUMERIC DEFAULT 600000,
  monthly_income NUMERIC DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_fire ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fire_own" ON user_fire FOR ALL USING (auth.uid() = user_id);
