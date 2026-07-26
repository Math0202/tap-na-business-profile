-- tap-na core schema (D1)
-- Cards use random 6-char slugs; profiles are personal | table

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  card_type TEXT NOT NULL DEFAULT 'personal' CHECK (card_type IN ('personal', 'table')),
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  linkedin TEXT NOT NULL DEFAULT '',
  youtube TEXT NOT NULL DEFAULT '',
  x TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  tiktok TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  menu_url TEXT NOT NULL DEFAULT '',
  google_review TEXT NOT NULL DEFAULT '',
  check_in_url TEXT NOT NULL DEFAULT '',
  feedback_url TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  video TEXT NOT NULL DEFAULT '',
  disabled INTEGER NOT NULL DEFAULT 0,
  login_email TEXT NOT NULL DEFAULT '',
  login_phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'other',
  product_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unlinked' CHECK (status IN ('unlinked', 'linked', 'disabled')),
  profile_id TEXT,
  sale_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  linked_at TEXT,
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_cards_slug ON cards(slug);
CREATE INDEX IF NOT EXISTS idx_cards_profile ON cards(profile_id);

CREATE TABLE IF NOT EXISTS card_opens (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'nfc' CHECK (channel IN ('nfc', 'qr', 'other')),
  user_agent TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT '',
  ip_country TEXT NOT NULL DEFAULT '',
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (card_id) REFERENCES cards(id)
);

CREATE INDEX IF NOT EXISTS idx_opens_card ON card_opens(card_id);
CREATE INDEX IF NOT EXISTS idx_opens_at ON card_opens(opened_at);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  event TEXT NOT NULL DEFAULT 'General visit',
  guests INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_checkins_profile ON checkins(profile_id);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_profile ON feedback(profile_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
