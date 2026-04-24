-- ─────────────────────────────────────────────────────────────────────────────
-- SIGMA RESEARCH — Community setups & reputation
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Profiles (one row per auth user)
CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username          TEXT UNIQUE,
  reputation        INT  DEFAULT 0 CHECK (reputation >= 0),
  bio               TEXT,
  avatar_url        TEXT,
  setups_published  INT  DEFAULT 0,
  setups_won        INT  DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_read_all"    ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own"  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Community setups
CREATE TABLE IF NOT EXISTS community_setups (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  par          TEXT    NOT NULL,
  tipo         TEXT    NOT NULL CHECK (tipo IN ('LONG','SHORT','LP')),
  entry        NUMERIC,
  sl           NUMERIC,
  tp           NUMERIC,
  range_low    NUMERIC,
  range_high   NUMERIC,
  fee_tier     TEXT,
  protocol     TEXT,
  rr           NUMERIC,
  timeframe    TEXT,
  metodologia  TEXT,
  estado       TEXT    DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INVALIDO','EJECUTADO','EN_RANGO','FUERA_RANGO')),
  nota         TEXT,
  fecha        DATE    DEFAULT CURRENT_DATE,
  votos_up     INT     DEFAULT 0,
  votos_down   INT     DEFAULT 0,
  activo       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_setups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "setups_read_active"  ON community_setups FOR SELECT USING (activo = true);
CREATE POLICY "setups_insert_own"   ON community_setups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "setups_update_own"   ON community_setups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "setups_delete_own"   ON community_setups FOR DELETE USING (auth.uid() = user_id);

-- 3. Setup votes (prevents double voting)
CREATE TABLE IF NOT EXISTS setup_votes (
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  setup_id  UUID REFERENCES community_setups(id) ON DELETE CASCADE,
  vote_type TEXT CHECK (vote_type IN ('up','down')),
  PRIMARY KEY (user_id, setup_id)
);

ALTER TABLE setup_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes_all_own" ON setup_votes FOR ALL USING (auth.uid() = user_id);

-- 4. Trigger: recalculate vote counts + reputation after each vote
CREATE OR REPLACE FUNCTION recalc_votes_and_rep()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _setup_id UUID := COALESCE(NEW.setup_id, OLD.setup_id);
  _user_id  UUID;
  _net_rep  INT;
BEGIN
  -- Update vote counts on the setup
  UPDATE community_setups
  SET
    votos_up   = (SELECT COUNT(*) FROM setup_votes WHERE setup_id = _setup_id AND vote_type = 'up'),
    votos_down = (SELECT COUNT(*) FROM setup_votes WHERE setup_id = _setup_id AND vote_type = 'down')
  WHERE id = _setup_id
  RETURNING user_id INTO _user_id;

  -- Recalculate reputation as sum of net upvotes across all active setups
  SELECT COALESCE(SUM(GREATEST(0, votos_up - votos_down)), 0)
  INTO _net_rep
  FROM community_setups
  WHERE user_id = _user_id AND activo = true;

  UPDATE profiles SET reputation = _net_rep, updated_at = NOW()
  WHERE id = _user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_vote_change
  AFTER INSERT OR UPDATE OR DELETE ON setup_votes
  FOR EACH ROW EXECUTE FUNCTION recalc_votes_and_rep();

-- 5. Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nombre')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
