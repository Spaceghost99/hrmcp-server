import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function optionalNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.error(`FATAL: Environment variable ${key} must be a number. Got: ${value}`);
    process.exit(1);
  }
  return parsed;
}

export const config = {
  // Server
  port: optionalNumber('PORT', 3000),
  nodeEnv: optional('NODE_ENV', 'development'),

  // Anthropic
  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  anthropicModel: optional('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'),
  anthropicTimeoutMs: optionalNumber('ANTHROPIC_TIMEOUT_MS', 25000),

  // Database
  databaseUrl: optional('DATABASE_URL', ''),

  // Auth
  bcryptRounds: optionalNumber('BCRYPT_ROUNDS', 10),

  // Rate limiting
  rateLimitEnabled: optional('RATE_LIMIT_ENABLED', 'true') === 'true',
  rateLimitPerMinute: optionalNumber('RATE_LIMIT_PER_MINUTE', 30),
  rateLimitPerDay: optionalNumber('RATE_LIMIT_PER_DAY', 500),
  rateLimitConcurrent: optionalNumber('RATE_LIMIT_CONCURRENT', 5),

  // Payload limits
  maxResumeChars: optionalNumber('MAX_RESUME_CHARS', 15000),
  maxJdChars: optionalNumber('MAX_JD_CHARS', 15000),

  // Stripe
  stripeSecretKey: optional('STRIPE_SECRET_KEY', ''),
  stripeWebhookSecret: optional('STRIPE_WEBHOOK_SECRET', ''),
  stripePriceLookupKey: optional('STRIPE_PRICE_LOOKUP_KEY', 'credits_100'),
  creditsBundleSize: optionalNumber('CREDITS_BUNDLE_SIZE', 100),
  creditsExpiryDays: optionalNumber('CREDITS_EXPIRY_DAYS', 180),

  // Logging
  logLevel: optional('LOG_LEVEL', 'info'),

  // Idempotency
  idempotencyTtlSeconds: optionalNumber('IDEMPOTENCY_TTL_SECONDS', 86400),

  // App
  appUrl: optional('APP_URL', 'http://localhost:3000'),
};