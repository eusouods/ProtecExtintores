CREATE TABLE IF NOT EXISTS seller_auth (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  seller_id TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE sessions_new (
  token_hash TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin','employee','seller')),
  username TEXT NOT NULL,
  employee_id TEXT,
  seller_id TEXT,
  expires_at INTEGER NOT NULL
);
INSERT INTO sessions_new(token_hash,role,username,employee_id,expires_at)
  SELECT token_hash,role,username,employee_id,expires_at FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS service_claims (
  service_id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  claimed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS service_claims_employee_idx ON service_claims(employee_id);
