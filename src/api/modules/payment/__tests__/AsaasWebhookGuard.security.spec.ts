/**
 * T2-E security tests for AsaasWebhookGuard
 *
 * TDD: written BEFORE the fix.  Tests that will FAIL against the current code:
 * - timingSafeEqual must be used (we can't test timing directly, but we verify
 *   the guard uses rawBody when available and rejects mismatched sigs correctly)
 */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AsaasWebhookGuard } from '../presentation/guards/AsaasWebhookGuard';

describe('AsaasWebhookGuard – timing-safe + rawBody (T2-E)', () => {
  let guard: AsaasWebhookGuard;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;
    guard = new AsaasWebhookGuard(configService);
  });

  function makeContext(opts: {
    signature?: string;
    rawBody?: Buffer;
    body?: Record<string, unknown>;
  }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'asaas-api-signature': opts.signature },
          rawBody: opts.rawBody,
          body: opts.body ?? {},
        }),
      }),
    } as ExecutionContext;
  }

  // ── rawBody preference ────────────────────────────────────────────────────

  it('T2-E: accepts a signature computed over rawBody bytes (not JSON.stringify)', () => {
    configService.get.mockReturnValue('webhook-secret');

    // Raw body has extra whitespace — JSON.stringify would differ
    const rawBody = Buffer.from(' { "event" : "PAYMENT_RECEIVED" } ');
    const correctSig = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(rawBody)
      .digest('hex');

    const ctx = makeContext({ signature: correctSig, rawBody });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('T2-E: rejects when sig was computed over JSON.stringify but rawBody is provided', () => {
    configService.get.mockReturnValue('webhook-secret');

    const rawBody = Buffer.from(' { "event" : "PAYMENT_RECEIVED" } ');
    const parsedBody = JSON.parse(rawBody.toString('utf8'));

    // sig over JSON.stringify (wrong when rawBody differs)
    const wrongSig = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(JSON.stringify(parsedBody))
      .digest('hex');

    const ctx = makeContext({ signature: wrongSig, rawBody, body: parsedBody });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  // ── timing-safe comparison does not change accept/reject semantics ────────

  it('T2-E: still accepts a valid signature (timingSafeEqual path)', () => {
    configService.get.mockReturnValue('secret');
    const body = { event: 'PAYMENT_RECEIVED', payment: { id: 'pay-1' } };
    const rawBody = Buffer.from(JSON.stringify(body));
    const sig = crypto
      .createHmac('sha256', 'secret')
      .update(rawBody)
      .digest('hex');

    expect(guard.canActivate(makeContext({ signature: sig, rawBody, body }))).toBe(true);
  });

  it('T2-E: still rejects an invalid signature (timingSafeEqual path)', () => {
    configService.get.mockReturnValue('secret');
    const rawBody = Buffer.from('{"event":"PAYMENT_RECEIVED"}');
    expect(() =>
      guard.canActivate(
        makeContext({ signature: 'invalid-sig', rawBody }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('T2-E: falls back to JSON.stringify when rawBody is absent', () => {
    configService.get.mockReturnValue('secret');
    const body = { event: 'PAYMENT_RECEIVED' };
    const sig = crypto
      .createHmac('sha256', 'secret')
      .update(JSON.stringify(body))
      .digest('hex');

    // No rawBody in context
    expect(guard.canActivate(makeContext({ signature: sig, body }))).toBe(true);
  });
});
