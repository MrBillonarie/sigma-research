-- ─────────────────────────────────────────────────────────────────────────────
-- FIRE Challenges — progreso server-side (espejo de ChallengeStore en
-- FireChallenges.tsx, que hoy vive solo en localStorage del navegador).
--
-- Necesario para que un cron pueda saber si un usuario cumplió su misión del
-- día y mandarle un recordatorio proactivo por la campanita, sin que tenga
-- que abrir /fire primero.
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fire_challenges (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  completed            JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- { "2026-07-08": ["mon","wa1"] }
  weekly_progress      JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- { "2026-W28": { "wa1": 3 } }
  max_streak           INT         NOT NULL DEFAULT 0,
  total_completed      INT         NOT NULL DEFAULT 0,
  total_saved          NUMERIC     NOT NULL DEFAULT 0,
  total_points         INT         NOT NULL DEFAULT 0,
  notified_streaks     INT[]       NOT NULL DEFAULT '{}',
  notified_missed_date DATE,
  earned_badges        TEXT[]      NOT NULL DEFAULT '{}',
  notified_level_idx   INT         NOT NULL DEFAULT 0,
  last_ahorro_seen     NUMERIC,
  last_gasto_seen      NUMERIC,
  streak_freezes       INT         NOT NULL DEFAULT 0,
  frozen_dates         TEXT[]      NOT NULL DEFAULT '{}',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fire_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fire_challenges_own" ON fire_challenges;
CREATE POLICY "fire_challenges_own" ON fire_challenges
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- update_updated_at_column() ya existe (creada en 20260623_fire_profile.sql)
DROP TRIGGER IF EXISTS set_fire_challenges_updated_at ON fire_challenges;
CREATE TRIGGER set_fire_challenges_updated_at
  BEFORE UPDATE ON fire_challenges
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
