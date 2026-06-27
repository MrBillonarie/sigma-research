-- ─────────────────────────────────────────────────────────────────────────────
-- Credenciales de plataformas externas (IBKR, MT5) para sincronizar el capital
-- de Portafolio automáticamente. Binance ya existía (binance_api_key/secret).
-- IBKR usa Flex Web Service (token + query id), de solo lectura — no requiere
-- una sesión de IB Gateway como el fetcher del motor (/opt/sigma/ibkr).
-- MT5 no tiene API pública: se guardan las credenciales como referencia, sin
-- sincronización automática por ahora.
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE user_config
  ADD COLUMN IF NOT EXISTS ibkr_flex_token TEXT,
  ADD COLUMN IF NOT EXISTS ibkr_query_id   TEXT,
  ADD COLUMN IF NOT EXISTS mt5_login       TEXT,
  ADD COLUMN IF NOT EXISTS mt5_password    TEXT,
  ADD COLUMN IF NOT EXISTS mt5_server      TEXT;
