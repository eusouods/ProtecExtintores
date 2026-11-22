CREATE TABLE IF NOT EXISTS warranty_claims(
 id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, customer_id TEXT NOT NULL, order_code TEXT NOT NULL,
 issue_type TEXT NOT NULL, details TEXT NOT NULL, status TEXT NOT NULL,
 admin_response TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS warranty_claims_customer_idx ON warranty_claims(customer_id,created_at);
CREATE TABLE IF NOT EXISTS warranty_claim_items(
 id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, order_code TEXT NOT NULL, item_index INTEGER NOT NULL,
 product_id TEXT NOT NULL, product_name TEXT NOT NULL, quantity INTEGER NOT NULL,
 serial TEXT NOT NULL DEFAULT '', issue TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Em análise',
 diagnosis TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS warranty_claim_items_claim_idx ON warranty_claim_items(claim_id);
CREATE TABLE IF NOT EXISTS warranty_claim_events(
 id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, actor_role TEXT NOT NULL, actor_name TEXT NOT NULL,
 event TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS service_reviews(
 id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, service_code TEXT NOT NULL, rating INTEGER NOT NULL,
 quality INTEGER NOT NULL, punctuality INTEGER NOT NULL, communication INTEGER NOT NULL,
 comment TEXT NOT NULL, consent_public INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
 admin_response TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(customer_id,service_code)
);
CREATE INDEX IF NOT EXISTS service_reviews_status_idx ON service_reviews(status,created_at);
CREATE TABLE IF NOT EXISTS care_audit_events(
 id TEXT PRIMARY KEY, actor_role TEXT NOT NULL, actor_name TEXT NOT NULL, entity TEXT NOT NULL,
 entity_id TEXT NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS public_track_limits(
 ip_hash TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS system_migrations(name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
