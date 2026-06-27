-- Asocia contact_submissions con el usuario logueado que la creó, para que
-- /soporte pueda listar "mis tickets". No se agregan policies RLS nuevas:
-- el acceso sigue pasando por /api/soporte (service role + auth.getUser()
-- manual), igual que el resto de las tablas de este proyecto.
ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contact_submissions_user_id_idx ON contact_submissions(user_id);
