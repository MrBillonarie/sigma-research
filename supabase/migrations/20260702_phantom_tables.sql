-- ─────────────────────────────────────────────────────────────────────────────
-- SIGMA RESEARCH — Phantom tables
-- Tablas que el código referencia pero no existen en prod.
-- Correr en: Supabase Dashboard → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. lp_signals — señales LP generadas por el cron y aprobadas por admin
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lp_signals (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hyp                TEXT        NOT NULL,
  hyp_text           TEXT,
  pool               TEXT,
  fee_tier           TEXT,
  range_low_pct      NUMERIC,
  range_high_pct     NUMERIC,
  kelly_pct          NUMERIC,
  days_projected     INT,
  ref_price          NUMERIC,
  is_active          BOOLEAN     NOT NULL DEFAULT FALSE,
  requires_approval  BOOLEAN     NOT NULL DEFAULT TRUE,
  approved_at        TIMESTAMPTZ,
  approved_by        TEXT,
  published_at       TIMESTAMPTZ,
  rejected_at        TIMESTAMPTZ,
  rejected_by        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ
);

ALTER TABLE lp_signals ENABLE ROW LEVEL SECURITY;

-- Lectura pública para señales activas aprobadas
CREATE POLICY "lp_signals_read_active"
  ON lp_signals FOR SELECT
  USING (is_active = true AND requires_approval = false);

-- Escritura solo service_role (cron y admin)
CREATE POLICY "lp_signals_write_service"
  ON lp_signals FOR ALL
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. fire_progress — progreso global de retos FIRE por usuario
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_progress (
  user_id        UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points         INT         NOT NULL DEFAULT 0,
  level          TEXT        NOT NULL DEFAULT 'STARTER',
  streak_days    INT         NOT NULL DEFAULT 0,
  last_daily_at  DATE,
  last_weekly_at DATE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fire_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fire_progress_own"
  ON fire_progress FOR ALL
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. fire_completions — retos completados (uno por reto por día/semana)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_completions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id    TEXT        NOT NULL,
  challenge_type  TEXT        NOT NULL CHECK (challenge_type IN ('daily','weekly')),
  points_earned   INT         NOT NULL DEFAULT 0,
  day_date        DATE,
  week_number     INT,
  week_year       INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevenir duplicados: un reto por día o por semana
  UNIQUE NULLS NOT DISTINCT (user_id, challenge_id, day_date),
  UNIQUE NULLS NOT DISTINCT (user_id, challenge_id, week_number, week_year)
);

ALTER TABLE fire_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fire_completions_own"
  ON fire_completions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fire_completions_user
  ON fire_completions(user_id, challenge_type, day_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. fire_badges — insignias ganadas por usuario
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_badges (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id   TEXT        NOT NULL,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE fire_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fire_badges_own"
  ON fire_badges FOR ALL
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. passive_positions — capital en posiciones pasivas para el portfolio total
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS passive_positions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capital    NUMERIC     NOT NULL DEFAULT 0,
  nombre     TEXT,
  plataforma TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE passive_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "passive_positions_own"
  ON passive_positions FOR ALL
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. error_logs — registro de errores de frontend (bajo impacto)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message    TEXT,
  stack      TEXT,
  url        TEXT,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Solo service_role puede leer; cualquier usuario autenticado puede insertar
CREATE POLICY "error_logs_insert_auth"
  ON error_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "error_logs_read_service"
  ON error_logs FOR SELECT
  USING (auth.role() = 'service_role');

-- Limpiar logs > 30 días automáticamente (ejecutar manualmente o con cron pg)
-- DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '30 days';
