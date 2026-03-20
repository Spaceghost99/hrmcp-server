import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { AuthResult } from '../middleware/auth';
import { verifyKey, getLookupHash, hashKey, generateKey, maskKey } from './keys';

// ─── Connection pool ──────────────────────────────────────────────────────────

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is not set. Database operations are unavailable.');
    }
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on('error', (err) => {
      process.stderr.write(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'db_pool_error',
        message: err.message,
      }) + '\n');
    });
  }
  return pool;
}

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// ─── Schema migration ─────────────────────────────────────────────────────────

/**
 * Run the schema migration. Safe to call on every startup — all DDL
 * statements are idempotent. Throws if the database is unreachable.
 */
export async function migrate(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await withClient(client => client.query(sql));
}

// ─── Customer operations ──────────────────────────────────────────────────────

export interface CustomerRecord {
  id: string;
  stripe_customer_id: string | null;
  email: string;
  is_suspended: boolean;
  created_at: Date;
}

export async function createCustomer(
  email: string,
  stripeCustomerId?: string,
): Promise<CustomerRecord> {
  const { rows } = await getPool().query<CustomerRecord>(
    `INSERT INTO customers (email, stripe_customer_id)
     VALUES ($1, $2)
     RETURNING *`,
    [email, stripeCustomerId ?? null],
  );
  return rows[0];
}

export async function getCustomerByStripeId(
  stripeCustomerId: string,
): Promise<CustomerRecord | null> {
  const { rows } = await getPool().query<CustomerRecord>(
    `SELECT * FROM customers WHERE stripe_customer_id = $1`,
    [stripeCustomerId],
  );
  return rows[0] ?? null;
}

/**
 * Suspend a customer immediately (dispute / chargeback).
 * Also deactivates all their API keys atomically.
 */
export async function suspendCustomer(stripeCustomerId: string): Promise<void> {
  await withClient(async (client) => {
    await client.query('BEGIN');
    await client.query(
      `UPDATE customers SET is_suspended = TRUE WHERE stripe_customer_id = $1`,
      [stripeCustomerId],
    );
    await client.query(
      `UPDATE api_keys SET is_active = FALSE, revoked_at = NOW()
       WHERE customer_id = (
         SELECT id FROM customers WHERE stripe_customer_id = $1
       )`,
      [stripeCustomerId],
    );
    await client.query('COMMIT');
  });
}

// ─── API key operations ───────────────────────────────────────────────────────

export interface ApiKeyRecord {
  id: string;
  customer_id: string;
  key_hash: string;
  lookup_hash: string;
  credits_balance: number;
  credits_expire_at: Date | null;
  is_active: boolean;
  created_at: Date;
  revoked_at: Date | null;
}

export interface NewKeyResult {
  plaintext: string;   // returned once — never stored after this call
  masked: string;
  record: ApiKeyRecord;
}

/**
 * Generate, hash, and store a new API key for the given customer.
 * The plaintext is returned exactly once in NewKeyResult.plaintext.
 * The caller is responsible for delivering it to the customer.
 */
export async function createApiKey(
  customerId: string,
  creditsBalance: number,
  creditsExpireAt: Date | null,
): Promise<NewKeyResult> {
  const plaintext   = generateKey();
  const keyHash     = await hashKey(plaintext);
  const lookupHash  = getLookupHash(plaintext);

  const { rows } = await getPool().query<ApiKeyRecord>(
    `INSERT INTO api_keys
       (customer_id, key_hash, lookup_hash, credits_balance, credits_expire_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [customerId, keyHash, lookupHash, creditsBalance, creditsExpireAt],
  );

  return {
    plaintext,
    masked: maskKey(plaintext),
    record: rows[0],
  };
}

/**
 * Revoke all active API keys for a customer.
 */
export async function revokeApiKeys(customerId: string): Promise<void> {
  await getPool().query(
    `UPDATE api_keys
     SET is_active = FALSE, revoked_at = NOW()
     WHERE customer_id = $1 AND is_active = TRUE`,
    [customerId],
  );
}

/**
 * Add credits to a customer's most recently created active key.
 * Called from the Stripe webhook after a successful payment.
 */
export async function addCredits(
  customerId: string,
  amount: number,
  expireAt: Date,
): Promise<ApiKeyRecord | null> {
  const { rows } = await getPool().query<ApiKeyRecord>(
    `UPDATE api_keys
     SET credits_balance   = credits_balance + $2,
         credits_expire_at = $3
     WHERE id = (
       SELECT id FROM api_keys
       WHERE customer_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1
     )
     RETURNING *`,
    [customerId, amount, expireAt],
  );
  return rows[0] ?? null;
}

// ─── Auth lookup ──────────────────────────────────────────────────────────────

/**
 * Implements KeyLookupFn from middleware/auth.ts.
 * 1. Finds the row by lookup_hash (indexed, fast).
 * 2. Bcrypt-verifies the plaintext against key_hash.
 * 3. Checks is_active — returns null for revoked keys.
 * 4. Checks the customer is not suspended.
 */
export async function lookupApiKey(
  lookupHash: string,
  plaintext: string,
): Promise<AuthResult | null> {
  const { rows } = await getPool().query<
    ApiKeyRecord & { is_suspended: boolean }
  >(
    `SELECT k.*, c.is_suspended
     FROM api_keys k
     JOIN customers c ON c.id = k.customer_id
     WHERE k.lookup_hash = $1`,
    [lookupHash],
  );

  const row = rows[0];
  if (!row) return null;
  if (!row.is_active || row.is_suspended) return null;

  const valid = await verifyKey(plaintext, row.key_hash);
  if (!valid) return null;

  return {
    customer_id:       row.customer_id,
    key_hash:          row.key_hash,
    lookup_hash:       lookupHash,  // passed through so auth middleware can attach it
    masked_key:        '',          // filled in by auth middleware after this returns
    credits_balance:   row.credits_balance,
    credits_expire_at: row.credits_expire_at,
    is_active:         row.is_active,
  };
}

// ─── Credit deduction ─────────────────────────────────────────────────────────

export type DeductResult =
  | { ok: true;  credits_remaining: number }
  | { ok: false; reason: 'credits_exhausted' | 'credits_expired' };

/**
 * Atomically deduct one credit from the key identified by lookup_hash.
 * Uses SELECT ... FOR UPDATE to prevent double-spend under concurrent load.
 */
export async function deductCredit(lookupHash: string): Promise<DeductResult> {
  return withClient(async (client) => {
    await client.query('BEGIN');

    const { rows } = await client.query<{
      id: string;
      credits_balance: number;
      credits_expire_at: Date | null;
    }>(
      `SELECT id, credits_balance, credits_expire_at
       FROM api_keys
       WHERE lookup_hash = $1
       FOR UPDATE`,
      [lookupHash],
    );

    const row = rows[0];

    if (!row || row.credits_balance <= 0) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'credits_exhausted' };
    }

    if (row.credits_expire_at && row.credits_expire_at < new Date()) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'credits_expired' };
    }

    const { rows: updated } = await client.query<{ credits_balance: number }>(
      `UPDATE api_keys
       SET credits_balance = credits_balance - 1
       WHERE id = $1
       RETURNING credits_balance`,
      [row.id],
    );

    await client.query('COMMIT');
    return { ok: true, credits_remaining: updated[0].credits_balance };
  });
}

// ─── Idempotency cache ────────────────────────────────────────────────────────

export interface CachedResponse {
  response_status: number;
  response_body:   unknown;
}

export async function getCachedResponse(
  idempotencyKey: string,
): Promise<CachedResponse | null> {
  const cutoff = new Date(Date.now() - config.idempotencyTtlSeconds * 1000);
  const { rows } = await getPool().query<CachedResponse>(
    `SELECT response_status, response_body
     FROM idempotency_cache
     WHERE idempotency_key = $1 AND created_at > $2`,
    [idempotencyKey, cutoff],
  );
  return rows[0] ?? null;
}

export async function cacheResponse(
  idempotencyKey: string,
  status: number,
  body: unknown,
): Promise<void> {
  await getPool().query(
    `INSERT INTO idempotency_cache (idempotency_key, response_status, response_body)
     VALUES ($1, $2, $3)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [idempotencyKey, status, JSON.stringify(body)],
  );
}

/**
 * Delete idempotency cache rows older than the configured TTL.
 * Call this on a periodic interval (e.g. once per hour) to keep the table small.
 */
export async function pruneIdempotencyCache(): Promise<void> {
  const cutoff = new Date(Date.now() - config.idempotencyTtlSeconds * 1000);
  await getPool().query(
    `DELETE FROM idempotency_cache WHERE created_at < $1`,
    [cutoff],
  );
}
