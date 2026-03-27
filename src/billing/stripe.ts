import crypto from 'crypto';
import Stripe from 'stripe';
import { config } from '../config';
import {
  createCustomer,
  getCustomerByStripeId,
  createApiKey,
  addCredits,
  suspendCustomer,
} from './db';
import { logBillingEvent } from '../middleware/logger';
import { maskKey } from './keys';

// ─── Stripe client ────────────────────────────────────────────────────────────

// Initialised lazily so the server starts without STRIPE_SECRET_KEY in
// environments that don't use billing (local dev, self-hosted).
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    if (!config.stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set. Stripe operations are unavailable.');
    }
    _stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
  }
  return _stripe;
}

// ─── Price ID cache ───────────────────────────────────────────────────────────
// The price lookup key never changes at runtime, so one fetch per process is
// sufficient. A null sentinel means "not yet fetched".

let cachedPriceId: string | null = null;

async function getPriceId(): Promise<string> {
  if (cachedPriceId) return cachedPriceId;

  const { data } = await getStripe().prices.list({
    lookup_keys: [config.stripePriceLookupKey],
    active: true,
    limit: 1,
  });

  if (!data[0]) {
    throw new Error(
      `No active Stripe price found for lookup key "${config.stripePriceLookupKey}". ` +
      'Create it in the Stripe dashboard before accepting payments.',
    );
  }

  cachedPriceId = data[0].id;
  return cachedPriceId;
}

// ─── Checkout session ─────────────────────────────────────────────────────────

export interface CheckoutSession {
  url: string;
  session_id: string;
}

/**
 * Create a Stripe Checkout session for a one-time credit purchase.
 *
 * @param email           Customer email — pre-fills the Stripe form.
 * @param idempotencyKey  Caller-supplied key. Stripe deduplicates session
 *                        creation within 24 h when the same key is reused.
 */
export async function createCheckoutSession(
  email: string,
  idempotencyKey: string,
): Promise<CheckoutSession> {
  const priceId = await getPriceId();

  const session = await getStripe().checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${config.appUrl}/cancel`,
      metadata: { email },
    },
    { idempotencyKey },
  );

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL.');
  }

  return { url: session.url, session_id: session.id };
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

export interface WebhookResult {
  handled:  boolean;
  event_id: string;
  type:     string;
  detail?:  string;
}

/**
 * Verify the Stripe webhook signature and dispatch to the appropriate handler.
 * rawBody must be the unparsed request body Buffer — do not JSON.parse it first.
 */
export async function handleWebhook(
  rawBody: Buffer,
  signature: string,
): Promise<WebhookResult> {
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      config.stripeWebhookSecret,
    );
  } catch (err: any) {
    throw new WebhookSignatureError(err.message ?? 'Invalid webhook signature');
  }

  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutCompleted(event);

    case 'charge.dispute.created':
      return handleDisputeCreated(event);

    default:
      // Acknowledge unknown events so Stripe doesn't retry them.
      return { handled: false, event_id: event.id, type: event.type };
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  event: Stripe.Event,
): Promise<WebhookResult> {
  const session = event.data.object as Stripe.Checkout.Session;

  const stripeCustomerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id ?? null;

  const email =
    session.customer_details?.email ??
    session.metadata?.email ??
    null;

  if (!email) {
    throw new Error(`checkout.session.completed (${event.id}): no email on session`);
  }

  // Upsert the customer — idempotent if the webhook fires more than once.
  let customer = stripeCustomerId
    ? await getCustomerByStripeId(stripeCustomerId)
    : null;

  if (!customer) {
    customer = await createCustomer(email, stripeCustomerId ?? undefined);
  }

  // Calculate credit expiry.
  const expireAt = new Date();
  expireAt.setDate(expireAt.getDate() + config.creditsExpiryDays);

  // Check whether this customer already has an active key (repeat purchase).
  // addCredits tops up the existing key; createApiKey issues a new one.
  let maskedKey: string;
  let creditsRemaining: number;

  const existing = stripeCustomerId
    ? await getCustomerByStripeId(stripeCustomerId)
    : null;

  // Attempt to top up an existing key first.
  const topped = existing
    ? await addCredits(customer.id, config.creditsBundleSize, expireAt)
    : null;

  if (topped) {
    maskedKey       = maskKey('hrmcp_sk_'); // we don't have plaintext for existing keys
    creditsRemaining = topped.credits_balance;
  } else {
    // First purchase — issue a new key.
    const newKey = await createApiKey(customer.id, config.creditsBundleSize, expireAt);
    maskedKey        = newKey.masked;
    creditsRemaining = newKey.record.credits_balance;

    // Emit key_created lifecycle log.
    emitKeyCreated(customer.id, newKey.masked, event.id);
  }

  return {
    handled:  true,
    event_id: event.id,
    type:     event.type,
    detail:   `customer=${customer.id} credits_added=${config.creditsBundleSize}`,
  };
}

async function handleDisputeCreated(
  event: Stripe.Event & { data: { object: Stripe.Dispute } },
): Promise<WebhookResult> {
  const dispute = event.data.object;

  const stripeCustomerId = typeof dispute.charge === 'string'
    ? await getCustomerIdFromCharge(dispute.charge)
    : null;

  if (!stripeCustomerId) {
    return {
      handled:  true,
      event_id: event.id,
      type:     event.type,
      detail:   'no stripe_customer_id found on dispute charge — skipping suspension',
    };
  }

  const customer = await getCustomerByStripeId(stripeCustomerId);

  await suspendCustomer(stripeCustomerId);

  logBillingEvent({
    type:            'dispute',
    customerId:      customer?.id ?? stripeCustomerId,
    maskedKey:       '(all keys suspended)',
    stripeEventId:   event.id,
    amount:          null,
    creditsRemaining: null,
  });

  return {
    handled:  true,
    event_id: event.id,
    type:     event.type,
    detail:   `stripe_customer=${stripeCustomerId} suspended`,
  };
}

// ─── Idempotency key helpers ──────────────────────────────────────────────────

/**
 * Derive a stable Stripe idempotency key from caller-supplied inputs.
 * Stripe deduplicates requests that share both idempotency key and endpoint
 * within 24 hours.
 */
export function stripeIdempotencyKey(...parts: string[]): string {
  return crypto
    .createHash('sha256')
    .update(parts.join(':'))
    .digest('hex')
    .slice(0, 64); // Stripe max is 255 chars; 64 hex chars is unambiguous
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getCustomerIdFromCharge(chargeId: string): Promise<string | null> {
  try {
    const charge = await getStripe().charges.retrieve(chargeId);
    return typeof charge.customer === 'string'
      ? charge.customer
      : charge.customer?.id ?? null;
  } catch {
    return null;
  }
}

function emitKeyCreated(
  customerId: string,
  maskedKey: string,
  stripeEventId: string,
): void {
  process.stdout.write(JSON.stringify({
    timestamp:       new Date().toISOString(),
    event:           'key_lifecycle',
    type:            'key_created',
    customer_id:     customerId,
    api_key:         maskedKey,
    stripe_event_id: stripeEventId,
  }) + '\n');
}

// ─── Error types ──────────────────────────────────────────────────────────────

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}
