-- Rate limiting distribuido — comparte estado entre instancias serverless de Vercel
CREATE TABLE IF NOT EXISTS rate_limits (
  id         TEXT PRIMARY KEY,          -- clave: 'rl:endpoint:ip'
  count      INT  NOT NULL DEFAULT 1,
  reset_at   TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Limpiar entradas expiradas automáticamente (opcional, cron o manual)
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at);

-- Solo el service_role puede escribir — nunca expuesto al cliente
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limits_service_only" ON rate_limits
  USING (auth.role() = 'service_role');
