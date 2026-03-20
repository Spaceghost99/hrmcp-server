import http from 'http';
import { config } from './config';
import { createAuthMiddleware } from './middleware/auth';
import { createRateLimitMiddleware, RateLimitInfo } from './middleware/rateLimit';
import { logRequest, logBillingEvent } from './middleware/logger';
import {
  migrate,
  lookupApiKey,
  deductCredit,
  getCachedResponse,
  cacheResponse,
  pruneIdempotencyCache,
} from './billing/db';
import { handleWebhook, WebhookSignatureError } from './billing/stripe';
import { handleScoreCandidate } from './tools/score-candidate/handler';
import { createError } from './errors/envelope';
import { ErrorCodes } from './errors/codes';

// ─── Middleware instances ─────────────────────────────────────────────────────

const authenticate   = createAuthMiddleware(lookupApiKey);
const checkRateLimit = createRateLimitMiddleware();

// ─── Body helpers ─────────────────────────────────────────────────────────────

async function parseJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/** Read the raw body as a Buffer — required for Stripe webhook signature verification. */
async function readRawBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ─── Idempotency key validation ───────────────────────────────────────────────

function validateIdempotencyKey(value: string): boolean {
  return value.length > 0 && value.length <= 255 && /^[\x20-\x7E]+$/.test(value);
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  res.setHeader('Content-Type', 'application/json');

  // ── GET /health ─────────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', model: config.anthropicModel }));
    logRequest({ req, status: 200, startTime });
    return;
  }

  // ── POST /webhooks/stripe ───────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/webhooks/stripe') {
    let status = 200;
    try {
      const rawBody  = await readRawBody(req);
      const signature = req.headers['stripe-signature'];

      if (!signature || Array.isArray(signature)) {
        status = 400;
        res.writeHead(400);
        res.end(JSON.stringify(createError('bad_request', 'Missing stripe-signature header.')));
        return;
      }

      const result = await handleWebhook(rawBody, signature);
      res.writeHead(200);
      res.end(JSON.stringify({ received: true, handled: result.handled, type: result.type }));
    } catch (err) {
      if (err instanceof WebhookSignatureError) {
        status = 400;
        res.writeHead(400);
        res.end(JSON.stringify(createError('bad_request', 'Webhook signature verification failed.')));
      } else {
        status = 500;
        res.writeHead(500);
        res.end(JSON.stringify(createError('internal_error', 'Webhook processing failed.')));
        process.stderr.write(JSON.stringify({
          timestamp: new Date().toISOString(),
          event: 'webhook_error',
          message: err instanceof Error ? err.message : String(err),
        }) + '\n');
      }
    } finally {
      logRequest({ req, status, startTime });
    }
    return;
  }

  // ── POST /score-candidate ───────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/score-candidate') {
    let status = 200;
    let errorCode: string | null = null;
    let creditsRemaining: number | null = null;
    let rateLimitInfo: RateLimitInfo | null = null;
    let customerId: string | null = null;
    let maskedKey: string | null = null;
    let warnings: string[] = [];

    try {
      // 1. Auth
      const auth = await authenticate(req, res);
      if (!auth) {
        status = 401;
        errorCode = 'unauthorized';
        return;
      }
      customerId = auth.customer_id;
      maskedKey  = auth.masked_key;

      // 2. Rate limit
      rateLimitInfo = await checkRateLimit(req, res, auth.customer_id);
      if (!rateLimitInfo) {
        status = 429;
        errorCode = ErrorCodes.RATE_LIMIT_EXCEEDED;
        return;
      }

      // 3. Parse body
      let body: unknown;
      try {
        body = await parseJsonBody(req);
      } catch {
        status = 400;
        errorCode = 'invalid_json';
        res.writeHead(400);
        res.end(JSON.stringify(createError('invalid_json', 'Request body must be valid JSON.')));
        return;
      }

      // 4. Idempotency key
      const idempotencyKey = req.headers['idempotency-key'];
      const idempKey = Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey;

      if (idempKey !== undefined) {
        if (!validateIdempotencyKey(idempKey)) {
          status = 400;
          errorCode = ErrorCodes.IDEMPOTENCY_KEY_INVALID;
          res.writeHead(400);
          res.end(JSON.stringify(createError(
            ErrorCodes.IDEMPOTENCY_KEY_INVALID,
            'Idempotency-Key must be a non-empty printable ASCII string of at most 255 characters.',
          )));
          return;
        }

        // 5. Check idempotency cache — replay without touching the model or credits
        const cached = await getCachedResponse(idempKey);
        if (cached) {
          status = cached.response_status;
          if (rateLimitInfo) {
            for (const [k, v] of Object.entries(rateLimitInfo.headers)) res.setHeader(k, v);
          }
          res.setHeader('X-Idempotent-Replay', 'true');
          res.writeHead(cached.response_status);
          res.end(JSON.stringify(cached.response_body));
          return;
        }
      }

      // 6. Deduct credit (atomic, before model call)
      const deduct = await deductCredit(auth.lookup_hash);
      if (!deduct.ok) {
        status = 402;
        errorCode = deduct.reason === 'credits_expired'
          ? ErrorCodes.CREDITS_EXPIRED
          : ErrorCodes.CREDITS_EXHAUSTED;

        logBillingEvent({
          type:            deduct.reason,
          customerId:      auth.customer_id,
          maskedKey:       auth.masked_key,
          amount:          null,
          creditsRemaining: 0,
          stripeEventId:   null,
        });

        res.writeHead(402);
        res.end(JSON.stringify(createError(
          errorCode,
          deduct.reason === 'credits_expired'
            ? 'Your credits have expired. Purchase a new bundle to continue.'
            : 'Your credit balance is zero. Purchase more credits to continue.',
          { purchase_url: `${config.appUrl}/billing` },
        )));
        return;
      }

      creditsRemaining = deduct.credits_remaining;

      // Log the deduction
      logBillingEvent({
        type:            'credit_deduction',
        customerId:      auth.customer_id,
        maskedKey:       auth.masked_key,
        amount:          1,
        creditsRemaining: deduct.credits_remaining,
        stripeEventId:   null,
      });

      // 7. Score
      const result = await handleScoreCandidate(body);
      status    = result.status;
      errorCode = result.body?.error?.code ?? null;
      warnings  = (result.body?.warnings ?? []).map((w: any) => w.code ?? String(w));

      // 8. Cache successful responses keyed by idempotency key
      if (idempKey && result.status === 200) {
        await cacheResponse(idempKey, result.status, result.body);
      }

      // 9. Apply rate-limit headers and send
      for (const [k, v] of Object.entries(rateLimitInfo.headers)) res.setHeader(k, v);
      res.setHeader('X-Credits-Remaining', String(deduct.credits_remaining));
      res.writeHead(result.status);
      res.end(JSON.stringify(result.body));

    } catch (err) {
      status    = 500;
      errorCode = 'internal_error';
      res.writeHead(500);
      res.end(JSON.stringify(createError('internal_error', 'An unexpected error occurred.')));
      process.stderr.write(JSON.stringify({
        timestamp: new Date().toISOString(),
        event:     'unhandled_error',
        message:   err instanceof Error ? err.message : String(err),
        stack:     err instanceof Error ? err.stack   : undefined,
      }) + '\n');
    } finally {
      rateLimitInfo?.release();
      logRequest({
        req,
        status,
        startTime,
        maskedKey,
        customerId,
        creditsRemaining,
        errorCode,
        warnings,
      });
    }
    return;
  }

  // ── 404 ─────────────────────────────────────────────────────────────────────
  res.writeHead(404);
  res.end(JSON.stringify(createError('not_found', 'The requested endpoint does not exist.')));
  logRequest({ req, status: 404, startTime });
});

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start() {
  // Run schema migration before accepting traffic.
  if (config.databaseUrl) {
    try {
      await migrate();
      process.stdout.write(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'db_migrated',
      }) + '\n');
    } catch (err) {
      process.stderr.write(JSON.stringify({
        timestamp: new Date().toISOString(),
        event:   'db_migration_failed',
        message: err instanceof Error ? err.message : String(err),
      }) + '\n');
      process.exit(1);
    }
  }

  // Prune stale idempotency cache rows once per hour.
  if (config.databaseUrl) {
    setInterval(async () => {
      try { await pruneIdempotencyCache(); } catch { /* non-fatal */ }
    }, 60 * 60_000).unref();
  }

  server.listen(config.port, () => {
    process.stdout.write(JSON.stringify({
      timestamp: new Date().toISOString(),
      event:     'server_started',
      port:      config.port,
      node_env:  config.nodeEnv,
      model:     config.anthropicModel,
    }) + '\n');
  });
}

start();
