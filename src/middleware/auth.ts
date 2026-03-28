import http from 'http';
import { createError } from '../errors/envelope';
import { isValidKeyFormat, maskKey } from '../billing/keys';

/**
 * The subset of a customer/key record that auth returns to callers.
 * Populated from the database row once the key is validated.
 */
export interface AuthResult {
  customer_id: string;
  key_hash: string;
  lookup_hash: string;   // SHA-256 — used by deductCredit
  masked_key: string;
  credits_balance: number;
  credits_expire_at: Date | null;
  is_active: boolean;
}

/**
 * Signature for the database lookup function injected into createAuthMiddleware.
 * Receives the SHA-256 lookup hash (not plaintext) and the plaintext key for
 * bcrypt verification, and returns the matching record or null.
 *
 * The lookup function is responsible for:
 *   1. Finding the row by lookup_hash (fast indexed query)
 *   2. Calling verifyKey(plaintext, row.key_hash) to confirm the bcrypt match
 *   3. Checking is_active — returning null for revoked keys
 */
export type KeyLookupFn = (
  lookupHash: string,
  plaintext: string,
) => Promise<AuthResult | null>;

/**
 * Extract the raw API key string from the request.
 * Checks X-API-Key first, then Authorization: Bearer <token>.
 * Returns undefined if neither header is present.
 */
function extractKey(req: http.IncomingMessage): string | undefined {
  const xApiKey = req.headers['x-api-key'];
  if (xApiKey) {
    return Array.isArray(xApiKey) ? xApiKey[0] : xApiKey;
  }

  const authorization = req.headers['authorization'];
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7).trim() || undefined;
  }

  return undefined;
}

function sendUnauthorized(
  res: http.ServerResponse,
  message: string,
  detail?: Record<string, unknown>,
): void {
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(401);
  res.end(JSON.stringify(createError('unauthorized', message, detail)));
}

/**
 * Factory that produces an auth middleware bound to a specific key-lookup
 * implementation. Wire up the real DB lookup once the database is provisioned;
 * in the interim the server will reject all requests with 401.
 *
 * Usage in index.ts:
 *   import { createAuthMiddleware } from './middleware/auth';
 *   import { lookupApiKey } from './billing/db'; // wired in step 5
 *   const authenticate = createAuthMiddleware(lookupApiKey);
 *
 * Returns the AuthResult on success, or null if the response was already
 * sent with a 401 (caller should return immediately without writing again).
 */
export function createAuthMiddleware(lookupKey: KeyLookupFn) {
  return async function authenticate(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<AuthResult | null> {
    const plaintext = extractKey(req);

    if (!plaintext) {
      sendUnauthorized(res, 'API key required.', {
        hint: 'Provide your key via the X-API-Key header or as a Bearer token in the Authorization header.',
      });
      return null;
    }

    if (!isValidKeyFormat(plaintext)) {
      sendUnauthorized(res, 'Invalid API key format.', {
        hint: 'Keys must begin with hrmcp_sk_.',
      });
      return null;
    }

    const { getLookupHash } = await import('../billing/keys');
    const lookupHash = getLookupHash(plaintext);

    let record: AuthResult | null;
    try {
      record = await lookupKey(lookupHash, plaintext);
    } catch (err) {
      // Database error — fail closed
      sendUnauthorized(res, 'Authentication service unavailable. Please retry.');
      return null;
    }

    if (!record) {
      sendUnauthorized(res, 'API key not found or has been revoked.', {
        hint: 'Purchase a key at https://recruitapi.app or contact support.',
      });
      return null;
    }

    // Attach fields computed here that the DB layer doesn't know about
    record.lookup_hash = lookupHash;
    record.masked_key  = maskKey(plaintext);

    return record;
  };
}

/**
 * Convenience type — the function returned by createAuthMiddleware.
 */
export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;
