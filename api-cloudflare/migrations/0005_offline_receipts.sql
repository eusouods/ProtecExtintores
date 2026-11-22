-- Durable idempotency receipts. Keep them while the associated service history exists.
CREATE TABLE IF NOT EXISTS offline_receipts (
  account_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_id, operation_id)
);
