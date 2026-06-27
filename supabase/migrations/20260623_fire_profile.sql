-- ─────────────────────────────────────────────────────────────────────────────
-- FIRE Planner — perfil financiero personalizado (edad, ahorro, gasto deseado)
--
-- user_preferences nunca llegó a crearse en producción (la migración
-- 20260605_admin_security.sql que la definía no se corrió completa — por eso
-- el wizard de onboarding general también fallaba en silencio). Esta migración
-- la crea desde cero con su esquema original + las columnas nuevas de FIRE,
-- así queda autosuficiente sin depender de que la otra migración se reaplique.
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  objetivo    TEXT,             -- 'fire' | 'trading' | 'cuantitativo'
  plataformas TEXT[],           -- ['binance','ibkr','fintual','santander','cash']
  perfil      TEXT,             -- 'retail' | 'trader' | 'institucional'
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step      INT     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_preferences_own" ON user_preferences;
CREATE POLICY "user_preferences_own" ON user_preferences
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER set_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Columnas del perfil financiero FIRE
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS fire_edad            NUMERIC,
  ADD COLUMN IF NOT EXISTS fire_ahorro_mensual   NUMERIC,
  ADD COLUMN IF NOT EXISTS fire_gasto_mensual    NUMERIC,
  ADD COLUMN IF NOT EXISTS fire_completed        BOOLEAN DEFAULT FALSE;
