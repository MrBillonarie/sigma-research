CREATE TABLE IF NOT EXISTS tasas_dap (
  id        TEXT PRIMARY KEY,
  nombre    TEXT NOT NULL,
  d30       NUMERIC,
  d60       NUMERIC,
  d90       NUMERIC,
  d180      NUMERIC,
  d360      NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Datos iniciales con las tasas actuales
INSERT INTO tasas_dap (id, nombre, d30, d60, d90, d180, d360) VALUES
  ('banco-internacional', 'Banco Internacional', 0.40, 0.42, 0.44, 0.46, 0.50),
  ('banco-consorcio',     'Banco Consorcio',     0.40, 0.42, 0.44, 0.46, 0.50),
  ('btg-pactual',         'BTG Pactual',         0.39, 0.41, 0.43, 0.45, 0.49),
  ('banco-ripley',        'Banco Ripley',        0.39, 0.41, 0.43, 0.45, 0.48),
  ('banco-security',      'Banco Security',      0.37, 0.39, 0.41, 0.43, 0.47),
  ('banco-bice',          'Banco BICE',          0.37, 0.39, 0.41, 0.43, 0.47),
  ('bancoestado',         'BancoEstado',         0.35, 0.37, 0.39, 0.41, 0.45),
  ('banco-de-chile',      'Banco de Chile',      0.34, 0.36, 0.38, 0.40, 0.44),
  ('itau',                'Itaú',                0.34, 0.36, 0.38, 0.40, 0.44),
  ('scotiabank',          'Scotiabank',          0.32, 0.34, 0.36, 0.38, 0.42),
  ('bci',                 'BCI',                 0.32, 0.34, 0.36, 0.38, 0.42),
  ('santander',           'Santander',           0.30, 0.32, 0.34, 0.36, 0.40),
  ('banco-falabella',     'Banco Falabella',     0.30, 0.32, 0.34, 0.36, 0.40)
ON CONFLICT (id) DO NOTHING;
