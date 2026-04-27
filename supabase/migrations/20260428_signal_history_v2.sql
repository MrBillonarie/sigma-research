-- Fase 1 del ciclo de retroalimentación: guardar contexto completo por señal
-- y columnas de outcome para medir accuracy 22+ días después.

ALTER TABLE signal_history
  ADD COLUMN IF NOT EXISTS price_at_signal    numeric,        -- precio spot al emitir la señal
  ADD COLUMN IF NOT EXISTS conditions_met     integer,        -- X de calcConditions()
  ADD COLUMN IF NOT EXISTS conditions_total   integer,        -- Y de calcConditions()
  ADD COLUMN IF NOT EXISTS regime             text,           -- 'risk-on' | 'risk-off' | 'neutral'
  ADD COLUMN IF NOT EXISTS outcome_return     numeric,        -- retorno real % medido 22d después
  ADD COLUMN IF NOT EXISTS outcome_correct    boolean,        -- ¿la señal acertó la dirección?
  ADD COLUMN IF NOT EXISTS outcome_measured_at timestamptz;   -- cuándo se midió el outcome

-- Índice parcial: señales pendientes de medir (tienen precio, sin outcome aún)
CREATE INDEX IF NOT EXISTS idx_sh_pending_outcome
  ON signal_history(generated_at)
  WHERE outcome_measured_at IS NULL AND price_at_signal IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sh_outcome_correct
  ON signal_history(outcome_correct, asset_class, score)
  WHERE outcome_measured_at IS NOT NULL;

COMMENT ON COLUMN signal_history.price_at_signal IS
  'Precio spot del activo en el momento de emitir la señal. '
  'Usado 22+ días después para calcular outcome_return.';

COMMENT ON COLUMN signal_history.outcome_return IS
  '(price_22d - price_at_signal) / price_at_signal * 100. '
  'Positivo = subió, negativo = bajó.';
