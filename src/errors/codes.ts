export const ErrorCodes = {
  // Validation errors
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  RESUME_TOO_SHORT: 'resume_too_short',
  WEIGHTS_INVALID_SUM: 'weights_invalid_sum',
  WEIGHTS_MISSING_KEYS: 'weights_missing_keys',
  WEIGHTS_NEGATIVE_VALUE: 'weights_negative_value',
  RECENCY_WINDOW_INVALID: 'recency_window_invalid',
  PAYLOAD_TOO_LARGE: 'payload_too_large',
  IDEMPOTENCY_KEY_INVALID: 'idempotency_key_invalid',

  // Auth & billing errors
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  CREDITS_EXHAUSTED: 'credits_exhausted',
  CREDITS_EXPIRED: 'credits_expired',

  // Runtime errors
  MODEL_UNAVAILABLE: 'model_unavailable',
  RESPONSE_PARSE_FAILURE: 'response_parse_failure',

  // Warnings (non-fatal)
  NON_ENGLISH_DETECTED: 'non_english_detected',
  JOB_DESCRIPTION_THIN: 'job_description_thin',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];