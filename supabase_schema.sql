-- ═══════════════════════════════════════════════════════════
--  Sigma Research — Supabase Schema
--  Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── 1. TRADES (Journal) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fecha       date        NOT NULL,
  par         text        NOT NULL,
  lado        text        NOT NULL CHECK (lado IN ('LONG','SHORT')),
  entry_price numeric,
  exit_price  numeric,
  sl          numeric,
  tp          numeric,
  size_usd    numeric,
  pnl_usd     numeric,
  pnl_pct     numeric,
  resultado   text        CHECK (resultado IN ('WIN','LOSS','BREAKEVEN')),
  notas       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_trades" ON trades
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 2. PORTFOLIO ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  ibkr                numeric     DEFAULT 0,
  binance_spot        numeric     DEFAULT 0,
  binance_futures     numeric     DEFAULT 0,
  fintual             numeric     DEFAULT 0,
  santander           numeric     DEFAULT 0,
  cash                numeric     DEFAULT 0,
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_portfolio" ON portfolio
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 3. REPORTES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reportes (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  numero      int,
  titulo      text,
  fecha       date,
  descripcion text,
  url_pdf     text,
  activo      boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_reportes" ON reportes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seed with first report
INSERT INTO reportes (numero, titulo, fecha, descripcion, url_pdf, activo)
VALUES (1, 'Reporte Mensual #001', '2026-03-05', 'Análisis macroeconómico: SPX, BTC, Gold. Régimen HMM + señales PRO.MACD activas. Equity curve Q1 2026.', '', true)
ON CONFLICT DO NOTHING;

-- ─── 4. MONTECARLO RUNS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS montecarlo_runs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fecha         date        DEFAULT CURRENT_DATE,
  modo          text        DEFAULT 'manual',  -- 'manual' | 'csv'
  capital       numeric,
  n_trades      int,
  anios         int,
  mu_mensual    numeric,
  sigma_mensual numeric,
  sharpe        numeric,
  var_95        numeric,
  p50_final     numeric,
  prob_objetivo numeric,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE montecarlo_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_mc_runs" ON montecarlo_runs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── CSV IMPORT TABLES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS csv_trades (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp   timestamptz NOT NULL,
  symbol      text        NOT NULL,
  pnl_bruto   numeric     DEFAULT 0,
  commission  numeric     DEFAULT 0,
  funding_fee numeric     DEFAULT 0,
  pnl_neto    numeric     DEFAULT 0,
  tipo        text        NOT NULL CHECK (tipo IN ('WIN','LOSS','LIQUIDATION','FUNDING')),
  raw_txids   text[]      DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE csv_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_csv_trades" ON csv_trades
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS csv_imports (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename    text,
  total_trades int,
  date_from   timestamptz,
  date_to     timestamptz,
  imported_at timestamptz DEFAULT now()
);

ALTER TABLE csv_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_csv_imports" ON csv_imports
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 6. PROFILES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                uuid        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username          text,
  reputation        int         DEFAULT 0,
  setups_published  int         DEFAULT 0,
  setups_won        int         DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_own_write" ON profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─── 7. USER CONFIG (API keys por usuario) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS user_config (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  binance_api_key     text,
  binance_api_secret  text,
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE user_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_config" ON user_config
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 8. COMMUNITY SETUPS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_setups (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  par         text        NOT NULL,
  tipo        text        NOT NULL CHECK (tipo IN ('LONG','SHORT','LP')),
  entry       numeric,
  sl          numeric,
  tp          numeric,
  range_low   numeric,
  range_high  numeric,
  fee_tier    text,
  protocol    text,
  rr          numeric,
  timeframe   text,
  metodologia text,
  nota        text,
  fecha       date        DEFAULT CURRENT_DATE,
  activo      boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE community_setups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_setups_public_read" ON community_setups
  FOR SELECT USING (true);

CREATE POLICY "community_setups_own_insert" ON community_setups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "community_setups_own_update" ON community_setups
  FOR UPDATE USING (auth.uid() = user_id);

-- ─── 9. SETUP VOTES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS setup_votes (
  user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  setup_id  uuid REFERENCES community_setups(id) ON DELETE CASCADE NOT NULL,
  vote_type text NOT NULL CHECK (vote_type IN ('up','down')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, setup_id)
);

ALTER TABLE setup_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "setup_votes_own" ON setup_votes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 10. CONTACT SUBMISSIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_submissions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     text        NOT NULL,
  empresa    text,
  email      text        NOT NULL,
  motivo     text,
  mensaje    text        NOT NULL,
  leido      boolean     DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_insert_public" ON contact_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "contact_admin_read" ON contact_submissions
  FOR SELECT USING (auth.role() = 'service_role');

-- ─── 11. FIRE PROGRESS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_progress (
  user_id       uuid  REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  points        int   DEFAULT 0,
  level         text  DEFAULT 'STARTER',
  streak_days   int   DEFAULT 0,
  streak_weeks  int   DEFAULT 0,
  last_daily_at date,
  last_weekly_at date,
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE fire_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fire_progress_own" ON fire_progress
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 12. FIRE COMPLETIONS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_completions (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  challenge_id   text        NOT NULL,
  challenge_type text        NOT NULL CHECK (challenge_type IN ('daily','weekly')),
  points_earned  int         NOT NULL,
  day_date       date,
  week_number    int,
  week_year      int,
  completed_at   timestamptz DEFAULT now()
);

ALTER TABLE fire_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fire_completions_own" ON fire_completions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 13. FIRE BADGES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_badges (
  user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_id  text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE fire_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fire_badges_own" ON fire_badges
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
