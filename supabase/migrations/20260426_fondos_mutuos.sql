-- AGF (Administradoras de Fondos)
CREATE TABLE IF NOT EXISTS agf (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fondos Mutuos con rentabilidades calculadas
CREATE TABLE IF NOT EXISTS fondos_mutuos (
  id TEXT PRIMARY KEY,
  agf_id TEXT REFERENCES agf(id),
  nombre TEXT NOT NULL,
  symbol TEXT,
  run TEXT,
  real_asset_id TEXT,
  categoria TEXT,
  moneda TEXT DEFAULT 'CLP',
  rent_1m NUMERIC,
  rent_3m NUMERIC,
  rent_12m NUMERIC,
  rent_3a NUMERIC,
  tac NUMERIC,
  ultimo_precio NUMERIC,
  ultima_fecha DATE,
  activo BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fondos_nombre ON fondos_mutuos
  USING gin(to_tsvector('spanish', nombre));
CREATE INDEX IF NOT EXISTS idx_fondos_agf ON fondos_mutuos(agf_id);
CREATE INDEX IF NOT EXISTS idx_fondos_rent_12m ON fondos_mutuos(rent_12m DESC);
CREATE INDEX IF NOT EXISTS idx_fondos_activo ON fondos_mutuos(activo);
