-- ─────────────────────────────────────────────────────────────────────────────
-- SIGMA RESEARCH — Soporte como chat usuario ↔ admin (2026-07-02)
-- Correr en: Supabase Dashboard → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. Asegurar columnas del sistema de tickets en contact_submissions
--    (defensivo: si la tabla fue creada con el esquema mínimo, las agrega)
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS motivo     TEXT;
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS empresa    TEXT;
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'pendiente';
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS respuesta  TEXT;
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 1. support_messages — hilo de conversación de cada ticket
CREATE TABLE IF NOT EXISTS support_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID        NOT NULL REFERENCES contact_submissions(id) ON DELETE CASCADE,
  sender     TEXT        NOT NULL CHECK (sender IN ('user','admin')),
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- El usuario puede leer los mensajes de SUS tickets
CREATE POLICY "support_msgs_read_own" ON support_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contact_submissions cs
    WHERE cs.id = ticket_id AND cs.user_id = auth.uid()
  ));

-- Escritura solo vía service_role (las APIs validan propiedad y estado)
CREATE POLICY "support_msgs_service" ON support_messages FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_support_msgs_ticket ON support_messages(ticket_id, created_at);
