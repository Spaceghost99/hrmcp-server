# hrmcp-server

An open-source MCP server for HR and recruiting workflows. Scores candidates against job descriptions using Claude, returns structured dimension scores, strengths, and gaps. Any agent framework that speaks MCP can call it natively.

**Hosted API** — use it without running anything: [hrmcp.dev](https://hrmcp.dev)
**Self-host** — deploy to Railway in under 15 minutes (see below)

---

## Endpoints

### `POST /score-candidate`

Score a candidate's resume against a job description.

**Request**

```json
{
  "resume_text": "...",
  "job_description": "...",
  "weights": {
    "skills_match": 0.40,
    "experience": 0.30,
    "industry_background": 0.20,
    "education": 0.10
  },
  "recency_window_years": 10
}
```

| Field | Type | Required | Default |
|---|---|---|---|
| `resume_text` | string | yes | — |
| `job_description` | string | yes | — |
| `weights` | object | no | `{skills_match: 0.40, experience: 0.30, industry_background: 0.20, education: 0.10}` |
| `recency_window_years` | integer > 0 | no | `10` |

Weights must sum to `1.0`. Each value must be between `0.0` and `1.0`.
Both text fields max out at 15,000 characters. Resume must be at least 50 words.

**Response — 200**

```json
{
  "overall_score": 82,
  "dimension_scores": {
    "skills_match": 88,
    "experience": 85,
    "industry_background": 74,
    "education": 70
  },
  "strengths": [
    "Five years of hands-on Python in production ML pipelines",
    "Led cross-functional team during platform migration"
  ],
  "gaps": [
    "No experience with Kubernetes",
    "MBA preferred; candidate holds a BS"
  ],
  "recency_window_used": 10,
  "model": "claude-sonnet-4-20250514",
  "warnings": []
}
```

All scores are integers 0–100. `strengths` and `gaps` are 2–4 strings each, grounded in the resume and job description — not generic observations.

**Idempotency**

Pass an `Idempotency-Key` header to cache the response for 24 hours. A retry with the same key returns the cached response without calling the model or deducting a credit.

```
Idempotency-Key: req_01J8XYZ
```

---

### `GET /health`

```json
{ "status": "ok", "model": "claude-sonnet-4-20250514" }
```

---

## Authentication

Every request to `/score-candidate` requires an API key. Pass it either way:

```
X-API-Key: hrmcp_sk_...
```
```
Authorization: Bearer hrmcp_sk_...
```

Keys are issued after a credit purchase. Get one at [hrmcp.dev/billing](https://hrmcp.dev/billing).

---

## Rate limits

Limits apply per API key on a rolling window — not a fixed clock boundary.

| Limit | Default |
|---|---|
| Per minute | 30 requests |
| Per day | 500 requests |
| Concurrent | 5 in-flight |

Every response includes current limit state:

```
X-RateLimit-Limit-Minute: 30
X-RateLimit-Remaining-Minute: 28
X-RateLimit-Reset-Minute: 1712000060
X-RateLimit-Limit-Day: 500
X-RateLimit-Remaining-Day: 497
X-RateLimit-Reset-Day: 1712041234
```

Self-hosted deployments can disable rate limiting entirely with `RATE_LIMIT_ENABLED=false`.

---

## Credits

Each successful call to `/score-candidate` deducts one credit. Credits are purchased in bundles of 100 for $5 and expire after 180 days.

| Status | Code | Meaning |
|---|---|---|
| 402 | `credits_exhausted` | Balance is zero |
| 402 | `credits_expired` | Credits exist but the bundle has expired |

---

## Error format

All errors use the same envelope:

```json
{
  "error": {
    "code": "missing_required_field",
    "message": "One or more required fields are missing.",
    "detail": { "missing_fields": ["resume_text"] }
  }
}
```

| Code | Status | Description |
|---|---|---|
| `unauthorized` | 401 | Missing, invalid, or revoked API key |
| `rate_limit_exceeded` | 429 | Rolling window limit hit; see `Retry-After` header |
| `credits_exhausted` | 402 | No credits remaining |
| `credits_expired` | 402 | Credits have passed their expiry date |
| `missing_required_field` | 400 | `resume_text` or `job_description` absent |
| `resume_too_short` | 400 | Resume under 50 words |
| `payload_too_large` | 400 | Input exceeds 15,000 characters |
| `weights_invalid_sum` | 400 | Weights do not sum to 1.0 |
| `weights_missing_keys` | 400 | One or more weight keys absent |
| `weights_negative_value` | 400 | Weight value outside 0.0–1.0 |
| `recency_window_invalid` | 400 | `recency_window_years` is not a positive integer |
| `idempotency_key_invalid` | 400 | `Idempotency-Key` header value is invalid |
| `model_unavailable` | 503 | Anthropic API timeout or outage |
| `response_parse_failure` | 500 | Model returned unparseable output |

**Warnings** are non-fatal and appear alongside a 200 response:

| Code | Trigger |
|---|---|
| `non_english_detected` | Non-Latin characters in resume or JD |
| `job_description_thin` | JD under 30 words |

---

## Self-hosting

### Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/hrmcp-server)

1. Click the button above — Railway clones the repo and provisions a Postgres service
2. Add the five required environment variables (see below)
3. Register `POST /webhooks/stripe` in your Stripe dashboard; paste the signing secret into `STRIPE_WEBHOOK_SECRET`
4. Watch the deploy log for `db_migrated` and `server_started`
5. Hit `/health` to confirm

### Run locally

```bash
git clone https://github.com/Spaceghost99/hrmcp-server.git
cd hrmcp-server
npm install
cp .env.example .env
# Fill in ANTHROPIC_API_KEY at minimum
npm run dev
```

Scoring works without `DATABASE_URL`. Auth and billing require Postgres.

---

## Environment variables

Five variables are required and will crash the server on startup if missing.

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **yes** | — | Anthropic API key |
| `DATABASE_URL` | prod only | — | PostgreSQL connection string (Railway provides this) |
| `STRIPE_SECRET_KEY` | prod only | — | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | prod only | — | Stripe webhook signing secret (`whsec_...`) |
| `PORT` | no | `3000` | Railway sets this automatically |
| `NODE_ENV` | no | `development` | Set to `production` on Railway |
| `ANTHROPIC_MODEL` | no | `claude-sonnet-4-20250514` | Model for scoring |
| `ANTHROPIC_TIMEOUT_MS` | no | `25000` | Anthropic API timeout in ms |
| `BCRYPT_ROUNDS` | no | `10` | bcrypt cost factor for key hashing |
| `RATE_LIMIT_ENABLED` | no | `true` | Set `false` to disable rate limiting |
| `RATE_LIMIT_PER_MINUTE` | no | `30` | Rolling per-minute limit per key |
| `RATE_LIMIT_PER_DAY` | no | `500` | Rolling per-day limit per key |
| `RATE_LIMIT_CONCURRENT` | no | `5` | Max in-flight requests per key |
| `MAX_RESUME_CHARS` | no | `15000` | Resume character limit |
| `MAX_JD_CHARS` | no | `15000` | Job description character limit |
| `STRIPE_PRICE_LOOKUP_KEY` | no | `credits_100` | Stripe price lookup key |
| `CREDITS_BUNDLE_SIZE` | no | `100` | Credits per purchase |
| `CREDITS_EXPIRY_DAYS` | no | `180` | Days before credits expire |
| `LOG_LEVEL` | no | `info` | `info` or `error` |
| `IDEMPOTENCY_TTL_SECONDS` | no | `86400` | Idempotency cache TTL in seconds |
| `APP_URL` | no | `http://localhost:3000` | Public base URL; used in billing links |

See `.env.example` for descriptions of every variable.

---

## Architecture

```
src/
  index.ts                  — HTTP server, request routing, middleware wiring
  config.ts                 — Environment variable loading
  middleware/
    auth.ts                 — API key extraction and validation
    rateLimit.ts            — Rolling window rate limiter (in-memory)
    logger.ts               — Structured JSON logging
  billing/
    keys.ts                 — Key generation, hashing, verification (pure functions)
    db.ts                   — PostgreSQL pool, schema migration, all queries
    stripe.ts               — Checkout sessions, webhook handler, credit lifecycle
  tools/
    score-candidate/
      handler.ts            — Input validation, orchestration
      scorer.ts             — Anthropic API call, response parsing
      schema.ts             — Zod schemas and default weights
      prompt.ts             — System prompt and user prompt builder
  errors/
    codes.ts                — Error code constants
    envelope.ts             — createError / createWarning helpers
```

**Request flow for `POST /score-candidate`:**

1. Auth — extract key, SHA-256 lookup, bcrypt verify
2. Rate limit — check rolling minute/day/concurrent windows
3. Parse + validate body
4. Idempotency — return cached response if key matches
5. Deduct credit — atomic `SELECT FOR UPDATE` in Postgres
6. Score — call Anthropic, parse and validate response
7. Cache response if idempotency key present
8. Apply `X-RateLimit-*` headers, send response
9. Release concurrent slot, write request log line

---

## Alternatives

Other hosted candidate-scoring options exist. hrmcp-server is open-source, self-hostable, and speaks MCP natively — no wrapper required for agent frameworks that support the protocol.

---

## License

Source Available. See [LICENSE](LICENSE). Self-hosting for internal use is free. Commercial hosting (offering a hosted API or SaaS based on this software to third parties) requires a separate written license — contact aaron@recruitapi.app.
