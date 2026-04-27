-- Historial de señales del motor de decisión
-- Permite medir accuracy futura: ¿los BUY subieron? ¿los SELL bajaron?
-- Se consulta via /api/motor/accuracy para retroalimentar los pesos del score.

CREATE TABLE IF NOT EXISTS signal_history (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker       text        NOT NULL,
  name         text        NOT NULL,
  asset_class  text        NOT NULL,
  signal       text        NOT NULL,   -- 'comprar' | 'reducir'
  score        integer     NOT NULL,
  r1m          numeric,                -- retorno 1 mes al momento de la señal
  r1y          numeric,                -- retorno 1 año al momento de la señal
  profile      text        NOT NULL,   -- 'retail' | 'trader' | 'institucional'
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sh_ticker       ON signal_history(ticker);
CREATE INDEX IF NOT EXISTS idx_sh_generated_at ON signal_history(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sh_signal       ON signal_history(signal);

-- Vista para accuracy semanal (requiere precio actual en otra tabla o join manual)
-- Uso futuro: JOIN con etfs.rent_1m para comparar r1m_after vs r1m_at_signal
COMMENT ON TABLE signal_history IS
  'Cada fila = una señal BUY o SELL emitida por el motor con su contexto de retornos. '
  'Acumular por semanas para calcular accuracy y ajustar pesos de calcScore().';
