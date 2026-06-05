-- Admin sessions — tokens de sesión opacos para reemplazar raw secret en cookie
CREATE TABLE IF NOT EXISTS admin_sessions (
  token       TEXT PRIMARY KEY,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_sessions_service_only" ON admin_sessions
  USING (auth.role() = 'service_role');

-- Error logs — observabilidad sin Sentry externo
CREATE TABLE IF NOT EXISTS error_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint    TEXT,
  error_msg   TEXT,
  error_stack TEXT,
  context     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_endpoint ON error_logs(endpoint);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "error_logs_service_only" ON error_logs
  USING (auth.role() = 'service_role');

-- User preferences — onboarding y perfil de usuario
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
CREATE POLICY "user_preferences_own" ON user_preferences
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at en cada modificación
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
