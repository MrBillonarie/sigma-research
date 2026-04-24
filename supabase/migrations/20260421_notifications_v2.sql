-- Enhance notifications table with urgente + action fields
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS urgente     boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS accion_label text,
  ADD COLUMN IF NOT EXISTS accion_href  text;

-- Index for fast unread queries
CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications (user_id, read, created_at DESC)
  WHERE read = false;

-- RLS: users can only see their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'own_notifications'
  ) THEN
    CREATE POLICY own_notifications ON notifications
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
