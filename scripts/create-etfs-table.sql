-- Tabla ETFs internacionales
create table if not exists etfs (
  ticker          text primary key,
  nombre          text not null,
  descripcion     text,
  indice          text,          -- "S&P 500", "NASDAQ-100", "MSCI World", etc.
  exposicion      text,          -- "USA", "Global", "Emergentes", "Chile", etc.
  sector          text,          -- "Tecnología", "Salud", null si es broad market
  divisa          text default 'USD',
  aum             numeric,       -- Assets Under Management en USD
  volumen_avg     numeric,       -- Volumen diario promedio (acciones)
  expense_ratio   numeric,       -- TER %
  dividend_yield  numeric,       -- Yield %
  precio          numeric,       -- Precio actual USD
  rent_1m         numeric,
  rent_3m         numeric,
  rent_12m        numeric,
  rent_3a         numeric,
  updated_at      timestamptz default now()
);

-- Índice para búsqueda por nombre
create index if not exists etfs_nombre_idx on etfs using gin (to_tsvector('spanish', nombre));
