import { ErrorCode } from './codes';

interface ErrorDetail {
  [key: string]: unknown;
}

interface ErrorEnvelope {
  error: {
    code: ErrorCode | string;
    message: string;
    detail?: ErrorDetail;
  };
}

export function createError(
  code: ErrorCode | string,
  message: string,
  detail?: ErrorDetail
): ErrorEnvelope {
  const envelope: ErrorEnvelope = {
    error: {
      code,
      message,
    },
  };

  if (detail !== undefined) {
    envelope.error.detail = detail;
  }

  return envelope;
}

export function createWarning(
  code: string,
  message: string,
  detail?: ErrorDetail
) {
  return {
    code,
    message,
    ...(detail !== undefined ? { detail } : {}),
  };
}