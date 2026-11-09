CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  iterations INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS employee_auth (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  employee_id TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin','employee')),
  username TEXT NOT NULL,
  employee_id TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);