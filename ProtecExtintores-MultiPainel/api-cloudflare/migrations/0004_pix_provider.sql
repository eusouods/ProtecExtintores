CREATE TABLE IF NOT EXISTS pix_provider_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  config_cipher TEXT NOT NULL,
  config_iv TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
