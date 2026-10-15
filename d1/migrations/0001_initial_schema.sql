PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'guest')),
  password_hash TEXT,
  password_salt TEXT,
  owner_setup_completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash);

CREATE TABLE IF NOT EXISTS app_list (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES app_list(id),
  key TEXT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'slate',
  rank INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tags_list_idx ON tags(list_id, rank);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES app_list(id),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  reserved_by TEXT REFERENCES accounts(id),
  purchased_by TEXT REFERENCES accounts(id),
  name TEXT NOT NULL,
  description TEXT,
  quantity TEXT,
  status TEXT NOT NULL DEFAULT 'to_buy' CHECK(status IN ('to_buy', 'reserved', 'bought', 'archived')),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS items_list_status_idx ON items(list_id, status, updated_at);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id TEXT NOT NULL REFERENCES items(id),
  tag_id TEXT NOT NULL REFERENCES tags(id),
  PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE IF NOT EXISTS item_links (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id),
  label TEXT,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES app_list(id),
  item_id TEXT REFERENCES items(id),
  account_id TEXT REFERENCES accounts(id),
  event_type TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS activity_list_idx ON activity_log(list_id, created_at DESC);
