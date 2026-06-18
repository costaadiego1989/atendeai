/**
 * TwilioWebhookGuard — unit tests
 * Verifies Twilio signature validation using TWILIO_AUTH_TOKEN env var.
 * Written BEFORE creating the guard (TDD: red → green).
 *
 * Twilio signs requests with HMAC-SHA1:
 *   signature = base64(hmacSha1(authToken, url + sorted_post_params))
 */
import { ExecutionContext } from '@nestjs/common';
import * as crypto from 'crypto';
import { TwilioWebhookGuard } from '../guards/TwilioWebhookGuard';

function buildMockContext(overrides: {
  headers?: Record<string, string>;
  body?: Record<string, string>;
  url?: string;
  rawBody?: Buffer;
}): ExecutionContext {
  const req = {
    headers: overrides.headers ?? {},
    body: overrides.body ?? {},
    rawBody: overrides.rawBody,
    protocol: 'https',
    get: jest.fn((header: string) => {
      if (header === 'host') return 'app.atendeai.com';
      if (header === 'x-twilio-signature') return overrides.headers?.['x-twilio-signature'] ?? '';
      return undefined;
    }),
    originalUrl: overrides.url ?? '/api/v1/voice/webhook/twiml/call-1',
  } as any;

  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

/**
 * Compute a valid Twilio signature for a given auth token, url, and POST params.
 * Follows Twilio spec: https://www.twilio.com/docs/usage/security#validating-signatures-from-twilio
 */
function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], '');
  const data = url + sortedParams;
  return crypto.createHmac('sha1', authToken).update(data).digest('base64');
}

describe('TwilioWebhookGuard', () => {
  const AUTH_TOKEN = 'test-auth-token-secret';
  const URL = 'https://app.atendeai.com/api/v1/voice/webhook/twiml/call-1';

  let guard: TwilioWebhookGuard;

  beforeEach(() => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    guard = new TwilioWebhookGuard();
  });

  afterEach(() => {
    delete process.env.TWILIO_AUTH_TOKEN;
  });

  it('rejects request with missing X-Twilio-Signature header → ForbiddenException', () => {
    const ctx = buildMockContext({ headers: {} });
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('rejects request with forged/incorrect signature → ForbiddenException', () => {
    const ctx = buildMockContext({
      headers: { 'x-twilio-signature': 'forged-signature-base64==' },
      body: { CallSid: 'CA123', CallStatus: 'ringing' },
    });
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('accepts request with valid Twilio signature', () => {
    const params = { CallSid: 'CA123', CallStatus: 'ringing' };
    const sig = computeTwilioSignature(AUTH_TOKEN, URL, params);

    const ctx = buildMockContext({
      headers: { 'x-twilio-signature': sig },
      body: params,
      url: '/api/v1/voice/webhook/twiml/call-1',
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects when TWILIO_AUTH_TOKEN env var is not set → ForbiddenException', () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    const params = { CallSid: 'CA123' };
    const sig = computeTwilioSignature('any-token', URL, params);

    const ctx = buildMockContext({
      headers: { 'x-twilio-signature': sig },
      body: params,
    });
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('rejects when POST params are tampered (signature mismatch)', () => {
    const params = { CallSid: 'CA123', CallStatus: 'ringing' };
    const sig = computeTwilioSignature(AUTH_TOKEN, URL, params);

    // Tamper body after signing
    const tamperedParams = { ...params, CallStatus: 'completed' };

    const ctx = buildMockContext({
      headers: { 'x-twilio-signature': sig },
      body: tamperedParams,
      url: '/api/v1/voice/webhook/twiml/call-1',
    });
    expect(() => guard.canActivate(ctx)).toThrow();
  });
});
