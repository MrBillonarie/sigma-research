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
