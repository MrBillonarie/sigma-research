-- ─────────────────────────────────────────────────────────────────────────────
-- SIGMA RESEARCH — Tablas adicionales encontradas en auditoría 2026-07-02
-- Correr en: Supabase Dashboard → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. trades — trades manuales del usuario (Journal, Tax, Diagnosticador, Home)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  par         TEXT,
  lado        TEXT        CHECK (lado IN ('LONG','SHORT')),
  resultado   TEXT        CHECK (resultado IN ('WIN','LOSS','BE')),
  entrada     TIMESTAMPTZ,
  fecha       DATE,
  entry_price NUMERIC,
  exit_price  NUMERIC,
  sl          NUMERIC,
  tp          NUMERIC,
  pnl_usd     NUMERIC     DEFAULT 0,
  pnl_pct     NUMERIC     DEFAULT 0,
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades_own" ON trades FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_fecha ON trades(user_id, fecha DESC);

-- 2. csv_trades — trades importados desde CSV de Binance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS csv_trades (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  par         TEXT,
  lado        TEXT,
  timestamp   TIMESTAMPTZ,
  qty         NUMERIC,
  price       NUMERIC,
  fee         NUMERIC     DEFAULT 0,
  pnl_neto    NUMERIC     DEFAULT 0,
  import_id   UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE csv_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csv_trades_own" ON csv_trades FOR ALL USING (auth.uid() = user_id);

-- 3. csv_imports — registro de cada importación CSV
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS csv_imports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename    TEXT,
  rows        INT         DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE csv_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csv_imports_own" ON csv_imports FOR ALL USING (auth.uid() = user_id);

-- 4. montecarlo_runs — persistencia de simulaciones Monte Carlo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS montecarlo_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prob_objetivo   NUMERIC,
  capital_inicial NUMERIC,
  target          NUMERIC,
  horizon_months  INT,
  paths           INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE montecarlo_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "montecarlo_runs_own" ON montecarlo_runs FOR ALL USING (auth.uid() = user_id);

-- 5. contact_submissions — formulario de contacto y soporte
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_submissions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT,
  email      TEXT,
  mensaje    TEXT,
  tipo       TEXT        DEFAULT 'contacto',
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  resuelto   BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_insert_any" ON contact_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "contact_read_service" ON contact_submissions FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "contact_update_service" ON contact_submissions FOR UPDATE USING (auth.role() = 'service_role');

-- 6. admin_modelos — modelos configurados desde panel admin
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_modelos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT        NOT NULL,
  descripcion TEXT,
  activo      BOOLEAN     DEFAULT TRUE,
  config      JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE admin_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_modelos_service" ON admin_modelos FOR ALL USING (auth.role() = 'service_role');

-- 7. admin_campanas — campañas de marketing desde admin
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_campanas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT        NOT NULL,
  cuerpo      TEXT,
  tipo        TEXT        DEFAULT 'email',
  enviada     BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE admin_campanas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campanas_service" ON admin_campanas FOR ALL USING (auth.role() = 'service_role');

-- 8. admin_audit_log — log de acciones del panel admin
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  accion     TEXT        NOT NULL,
  detalle    JSONB       DEFAULT '{}',
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_service" ON admin_audit_log FOR ALL USING (auth.role() = 'service_role');

-- 9. copytrading_log — log del cron de sincronización de copytrading
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS copytrading_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resultado   TEXT,
  trades_sync INT         DEFAULT 0,
  error       TEXT,
  duracion_ms INT
);
ALTER TABLE copytrading_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copytrading_log_service" ON copytrading_log FOR ALL USING (auth.role() = 'service_role');

-- 10. agf — Administradoras de Fondos (CMF Chile)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agf (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rut         TEXT        UNIQUE,
  nombre      TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE agf ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agf_read_all" ON agf FOR SELECT USING (true);
CREATE POLICY "agf_write_service" ON agf FOR ALL USING (auth.role() = 'service_role');
