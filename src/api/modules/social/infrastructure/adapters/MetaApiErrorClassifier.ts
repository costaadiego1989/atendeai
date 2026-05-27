import { isAxiosError } from 'axios';

export type MetaApiErrorType =
  | 'TOKEN_EXPIRED'
  | 'RATE_LIMITED'
  | 'PERMISSION_DENIED'
  | 'TRANSIENT'
  | 'UNKNOWN';

export interface ClassifiedMetaError {
  type: MetaApiErrorType;
  message: string;
  code?: number;
  subcode?: number;
  httpStatus?: number;
  retryAfterMs?: number;
}

export function classifyMetaApiError(error: unknown): ClassifiedMetaError {
  if (!isAxiosError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    return { type: 'UNKNOWN', message };
  }

  const httpStatus = error.response?.status;
  const data = error.response?.data?.error;
  const code = data?.code;
  const subcode = data?.subcode;
  const message = data?.message || error.message;

  if (code === 190 || subcode === 463 || subcode === 467) {
    return {
      type: 'TOKEN_EXPIRED',
      message,
      code,
      subcode,
      httpStatus,
    };
  }

  if (httpStatus === 429 || code === 4 || code === 17 || code === 32) {
    const retryAfterHeader = error.response?.headers?.['retry-after'];
    const retryAfterMs = retryAfterHeader
      ? parseInt(retryAfterHeader, 10) * 1000
      : 60000;

    return {
      type: 'RATE_LIMITED',
      message,
      code,
      subcode,
      httpStatus,
      retryAfterMs,
    };
  }

  if (code === 10 || code === 200 || code === 299) {
    return {
      type: 'PERMISSION_DENIED',
      message,
      code,
      subcode,
      httpStatus,
    };
  }

  if (httpStatus && httpStatus >= 500) {
    return {
      type: 'TRANSIENT',
      message,
      code,
      subcode,
      httpStatus,
      retryAfterMs: 5000,
    };
  }

  if (code === 1 || code === 2) {
    return {
      type: 'TRANSIENT',
      message,
      code,
      subcode,
      httpStatus,
      retryAfterMs: 5000,
    };
  }

  return {
    type: 'UNKNOWN',
    message,
    code,
    subcode,
    httpStatus,
  };
}
