-- Copytrading: el motor replica sus posiciones abiertas en la cuenta de
-- Binance Futures de los usuarios inscritos, proporcional a su capital.
-- Nadie queda inscrito por defecto: copytrading_enabled empieza en false
-- para todas las filas existentes y nuevas.

ALTER TABLE user_config
  ADD COLUMN IF NOT EXISTS copytrading_enabled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS copytrading_capital_usd  numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS copytrading_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motor_sym     text NOT NULL,
  motor_tf      text,
  direction     text NOT NULL,
  binance_symbol text,
  size_usd      numeric,
  status        text NOT NULL, -- 'executed' | 'skipped_no_pair' | 'skipped_no_capital' | 'error'
  binance_order_id text,
  detail        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE copytrading_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copytrading_log_service_role_only" ON copytrading_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS copytrading_log_user_id_idx ON copytrading_log(user_id);
CREATE INDEX IF NOT EXISTS copytrading_log_created_at_idx ON copytrading_log(created_at);
