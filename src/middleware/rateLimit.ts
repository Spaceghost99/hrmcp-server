import http from 'http';
import { config } from '../config';
import { createError } from '../errors/envelope';
import { ErrorCodes } from '../errors/codes';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

// ─── In-memory store ────────────────────────────────────────────────────────

interface KeyState {
  minuteWindow: number[]; // epoch-ms timestamps of completed requests (last 60 s)
  dayWindow: number[];    // epoch-ms timestamps of completed requests (last 24 h)
  concurrent: number;     // count of currently in-flight requests
}

const store = new Map<string, KeyState>();

function getState(apiKey: string): KeyState {
  let state = store.get(apiKey);
  if (!state) {
    state = { minuteWindow: [], dayWindow: [], concurrent: 0 };
    store.set(apiKey, state);
  }
  return state;
}

/** Remove timestamps that have fallen outside their window. */
function prune(state: KeyState, now: number): void {
  const minuteCutoff = now - MINUTE_MS;
  const dayCutoff = now - DAY_MS;
  state.minuteWindow = state.minuteWindow.filter(t => t >= minuteCutoff);
  state.dayWindow = state.dayWindow.filter(t => t >= dayCutoff);
}

// Evict fully-idle keys every 5 minutes to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of store.entries()) {
    prune(state, now);
    if (state.minuteWindow.length === 0 && state.dayWindow.length === 0 && state.concurrent === 0) {
      store.delete(key);
    }
  }
}, 5 * 60_000).unref(); // .unref() so this timer doesn't keep the process alive

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * Returned on success. The caller must:
 *   1. Apply `headers` to the response before calling writeHead.
 *   2. Call `release()` once the response has been sent so the concurrent
 *      counter is decremented and the request timestamp is recorded.
 */
export interface RateLimitInfo {
  headers: Record<string, string>;
  release: () => void;
}

// ─── Middleware factory ──────────────────────────────────────────────────────

/**
 * Returns a per-key rate-limit checker using rolling windows.
 *
 * When RATE_LIMIT_ENABLED is false (self-hosted opt-out), the middleware
 * still returns a valid RateLimitInfo so callers need no special-casing —
 * it simply skips all enforcement and omits the X-RateLimit headers.
 */
export function createRateLimitMiddleware(opts?: {
  perMinute?: number;
  perDay?: number;
  concurrent?: number;
  enabled?: boolean;
}) {
  const enabled    = opts?.enabled    ?? config.rateLimitEnabled;
  const perMinute  = opts?.perMinute  ?? config.rateLimitPerMinute;
  const perDay     = opts?.perDay     ?? config.rateLimitPerDay;
  const concurrent = opts?.concurrent ?? config.rateLimitConcurrent;

  return async function checkRateLimit(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    apiKey: string,
  ): Promise<RateLimitInfo | null> {

    // ── Rate limiting disabled (self-hosted) ────────────────────────────────
    if (!enabled) {
      return {
        headers: {},
        release: () => {},
      };
    }

    const now   = Date.now();
    const state = getState(apiKey);
    prune(state, now);

    // ── Concurrent limit ────────────────────────────────────────────────────
    if (state.concurrent >= concurrent) {
      send429(res, 'concurrent', 5);
      return null;
    }

    // ── Per-minute rolling window ───────────────────────────────────────────
    if (state.minuteWindow.length >= perMinute) {
      const oldest        = state.minuteWindow[0];
      const retryAfterMs  = oldest + MINUTE_MS - now;
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      send429(res, 'per_minute', retryAfterSec);
      return null;
    }

    // ── Per-day rolling window ──────────────────────────────────────────────
    if (state.dayWindow.length >= perDay) {
      const oldest        = state.dayWindow[0];
      const retryAfterMs  = oldest + DAY_MS - now;
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      send429(res, 'per_day', retryAfterSec);
      return null;
    }

    // ── All checks passed — reserve a concurrent slot ───────────────────────
    state.concurrent += 1;

    // Compute reset timestamps (epoch seconds, rolling from oldest entry).
    const minuteReset = state.minuteWindow.length > 0
      ? Math.ceil((state.minuteWindow[0] + MINUTE_MS) / 1000)
      : Math.ceil((now + MINUTE_MS) / 1000);

    const dayReset = state.dayWindow.length > 0
      ? Math.ceil((state.dayWindow[0] + DAY_MS) / 1000)
      : Math.ceil((now + DAY_MS) / 1000);

    const headers: Record<string, string> = {
      'X-RateLimit-Limit-Minute':     String(perMinute),
      'X-RateLimit-Remaining-Minute': String(perMinute - state.minuteWindow.length - 1),
      'X-RateLimit-Reset-Minute':     String(minuteReset),
      'X-RateLimit-Limit-Day':        String(perDay),
      'X-RateLimit-Remaining-Day':    String(perDay - state.dayWindow.length - 1),
      'X-RateLimit-Reset-Day':        String(dayReset),
    };

    /**
     * Call once after the response is sent.
     * Records the request timestamp into both windows and releases the
     * concurrent slot. Safe to call multiple times (idempotent after first).
     */
    let released = false;
    function release(): void {
      if (released) return;
      released = true;
      const ts = Date.now();
      state.minuteWindow.push(ts);
      state.dayWindow.push(ts);
      state.concurrent = Math.max(0, state.concurrent - 1);
    }

    return { headers, release };
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function send429(
  res: http.ServerResponse,
  limitType: 'per_minute' | 'per_day' | 'concurrent',
  retryAfterSeconds: number,
): void {
  const messages: Record<typeof limitType, string> = {
    per_minute:  'You have exceeded the per-minute request limit.',
    per_day:     'You have exceeded the daily request limit.',
    concurrent:  'Too many simultaneous requests for this API key.',
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.writeHead(429);
  res.end(JSON.stringify(
    createError(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      messages[limitType],
      {
        limit_type:           limitType,
        retry_after_seconds:  retryAfterSeconds,
      },
    ),
  ));
}

/** Convenience type — the function returned by createRateLimitMiddleware. */
export type RateLimitMiddleware = ReturnType<typeof createRateLimitMiddleware>;
