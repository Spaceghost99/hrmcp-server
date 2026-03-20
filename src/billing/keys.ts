import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { config } from '../config';

const KEY_PREFIX = 'hrmcp_sk_';

/**
 * Generate a new API key.
 * Format: hrmcp_sk_<43-char base64url-encoded 32 random bytes>
 * This is the only place plaintext keys are produced.
 */
export function generateKey(): string {
  const random = crypto.randomBytes(32).toString('base64url');
  return `${KEY_PREFIX}${random}`;
}

/**
 * Derive a fast, indexed lookup hash from a plaintext key.
 * Stored alongside the bcrypt hash so the DB can find the right row
 * without iterating all rows through bcrypt.
 * SHA-256 is not reversible to the plaintext — safe to store.
 */
export function getLookupHash(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Bcrypt-hash a plaintext key for storage.
 * Used once at key-creation time.
 */
export async function hashKey(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, config.bcryptRounds);
}

/**
 * Verify a plaintext key against a stored bcrypt hash.
 * Used at authentication time.
 */
export async function verifyKey(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Mask a key for safe inclusion in logs.
 * Shows prefix + first 4 random chars, then ellipsis.
 * Example: hrmcp_sk_AbCd...
 */
export function maskKey(key: string): string {
  const visibleEnd = KEY_PREFIX.length + 4;
  if (key.length <= visibleEnd) return `${key.slice(0, 8)}...`;
  return `${key.slice(0, visibleEnd)}...`;
}

/**
 * Confirm the key has the expected prefix and minimum length.
 * Does NOT validate against the database — format check only.
 */
export function isValidKeyFormat(key: string): boolean {
  return (
    typeof key === 'string' &&
    key.startsWith(KEY_PREFIX) &&
    key.length > KEY_PREFIX.length + 10
  );
}
