import http from 'http';
import { config } from '../config';

// ─── Log schemas ─────────────────────────────────────────────────────────────

/**
 * One line written to stdout after every HTTP response.
 * All fields are present; nullable fields are explicitly null when absent
 * so log parsers never need to handle missing keys.
 */
interface RequestLog {
  timestamp: string;
  event: 'request';
  method: string;
  path: string;
  status: number;
  response_time_ms: number;
  api_key: string | null;        // masked (e.g. hrmcp_sk_AbCd...)
  customer_id: string | null;
  credits_remaining: number | null;
  rate_limit_type: string | null; // populated on 429 responses
  error_code: string | null;      // populated on 4xx / 5xx
  warnings: string[];
}

/**
 * Written once per billing event — separately from the request log.
 * Covers every credit deduction, exhaustion, expiry, and dispute.
 */
interface BillingEventLog {
  timestamp: string;
  event: 'billing_event';
  type: 'credit_deduction' | 'credits_exhausted' | 'credits_expired' | 'dispute';
  customer_id: string;
  api_key: string;               // masked
  amount: number | null;         // credits consumed (null for non-deduction events)
  credits_remaining: number | null;
  stripe_event_id: string | null;
}

// ─── Public input types ───────────────────────────────────────────────────────

export interface RequestLogData {
  req: http.IncomingMessage;
  status: number;
  startTime: number;             // Date.now() captured before processing began
  maskedKey?: string | null;
  customerId?: string | null;
  creditsRemaining?: number | null;
  rateLimitType?: string | null;
  errorCode?: string | null;
  warnings?: string[];
}

export interface BillingEventData {
  type: BillingEventLog['type'];
  customerId: string;
  maskedKey: string;
  amount?: number | null;
  creditsRemaining?: number | null;
  stripeEventId?: string | null;
}

// ─── Core emit ───────────────────────────────────────────────────────────────

function emit(record: RequestLog | BillingEventLog): void {
  // In error-only mode, suppress everything except billing events and errors.
  if (config.logLevel === 'error') {
    const isError = record.event === 'billing_event' ||
      ('status' in record && record.status >= 500) ||
      ('error_code' in record && record.error_code !== null);
    if (!isError) return;
  }
  process.stdout.write(JSON.stringify(record) + '\n');
}

// ─── Exported loggers ─────────────────────────────────────────────────────────

/**
 * Log one request. Call this after the response is sent so that
 * response_time_ms reflects the full round-trip including body flush.
 */
export function logRequest(data: RequestLogData): void {
  const url   = data.req.url ?? '/';
  const path  = url.split('?')[0]; // strip query string — never log query params

  const record: RequestLog = {
    timestamp:         new Date().toISOString(),
    event:             'request',
    method:            data.req.method ?? 'UNKNOWN',
    path,
    status:            data.status,
    response_time_ms:  Date.now() - data.startTime,
    api_key:           data.maskedKey          ?? null,
    customer_id:       data.customerId         ?? null,
    credits_remaining: data.creditsRemaining   ?? null,
    rate_limit_type:   data.rateLimitType      ?? null,
    error_code:        data.errorCode          ?? null,
    warnings:          data.warnings           ?? [],
  };

  emit(record);
}

/**
 * Log a billing event. Call this immediately when the event occurs —
 * do not batch or defer. Each deduction, exhaustion, expiry, and dispute
 * gets its own log line so billing can be reconstructed from logs alone.
 */
export function logBillingEvent(data: BillingEventData): void {
  const record: BillingEventLog = {
    timestamp:         new Date().toISOString(),
    event:             'billing_event',
    type:              data.type,
    customer_id:       data.customerId,
    api_key:           data.maskedKey,
    amount:            data.amount            ?? null,
    credits_remaining: data.creditsRemaining  ?? null,
    stripe_event_id:   data.stripeEventId     ?? null,
  };

  emit(record);
}
