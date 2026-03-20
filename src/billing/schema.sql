-- hrmcp-server database schema
-- Run via db.migrate() on startup, or psql < schema.sql for manual setup.
-- All statements are idempotent (IF NOT EXISTS / OR REPLACE).

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- ─── Customers ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id  TEXT        UNIQUE,
  email               TEXT        NOT NULL,
  is_suspended        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── API keys ────────────────────────────────────────────────────────────────
-- key_hash   : bcrypt — used for verification only, never for lookup
-- lookup_hash: SHA-256 hex of the plaintext key — fast indexed lookup

CREATE TABLE IF NOT EXISTS api_keys (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  key_hash          TEXT        NOT NULL,
  lookup_hash       TEXT        NOT NULL UNIQUE,
  credits_balance   INTEGER     NOT NULL DEFAULT 0 CHECK (credits_balance >= 0),
  credits_expire_at TIMESTAMPTZ,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_lookup_hash_idx  ON api_keys (lookup_hash);
CREATE INDEX IF NOT EXISTS api_keys_customer_id_idx  ON api_keys (customer_id);

-- ─── Idempotency cache ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS idempotency_cache (
  idempotency_key TEXT        PRIMARY KEY,
  response_status INTEGER     NOT NULL,
  response_body   JSONB       NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rows older than TTL are irrelevant; a periodic sweep keeps the table small.
CREATE INDEX IF NOT EXISTS idempotency_cache_created_at_idx ON idempotency_cache (created_at);
