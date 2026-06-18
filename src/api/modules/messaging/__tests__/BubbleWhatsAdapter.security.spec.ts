/**
 * T2-A / T2-B security tests for BubbleWhatsAdapter.validateSignature
 *
 * TDD: these tests are written BEFORE the fix is applied.
 * They document the required security behaviour and MUST FAIL against
 * the current (buggy) implementation.
 */
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { BubbleWhatsAdapter } from '../infrastructure/acl/BubbleWhatsAdapter';

describe('BubbleWhatsAdapter – signature security (T2-A / T2-B)', () => {
  let adapter: BubbleWhatsAdapter;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'BUBBLEWHATS_API_URL' ? 'https://bubblewhats.test' : undefined,
      ),
    } as unknown as ConfigService;
    adapter = new BubbleWhatsAdapter(configService);
  });

  const baseConfig = {
    channel: 'WHATSAPP' as const,
    provider: 'BUBBLEWHATS' as const,
    credentials: {},
    status: 'ACTIVE',
  };

  // ── T2-A: fail-CLOSED when webhookSecret is absent ───────────────────────

  it('T2-A: returns false (rejects) when webhookSecret is undefined', () => {
    // BUG: current code returns `true` (fails open). Fix must return false.
    expect(
      adapter.validateSignature('any-sig', { event: 'x' }, {
        ...baseConfig,
        webhookSecret: undefined,
        credentials: {},
      }),
    ).toBe(false);
  });

  it('T2-A: returns false (rejects) when webhookSecret is empty string', () => {
    // BUG: current code returns `true` (fails open). Fix must return false.
    expect(
      adapter.validateSignature('any-sig', { event: 'x' }, {
        ...baseConfig,
        webhookSecret: '',
        credentials: {},
      }),
    ).toBe(false);
  });

  it('T2-A: returns false (rejects) when credentials.webhookSecret is empty', () => {
    expect(
      adapter.validateSignature('any-sig', { event: 'x' }, {
        ...baseConfig,
        webhookSecret: undefined,
        credentials: { webhookSecret: '' },
      }),
    ).toBe(false);
  });

  // ── T2-B: HMAC must operate on raw body bytes, not JSON.stringify ─────────

  it('T2-B: accepts a signature computed over the raw body Buffer', () => {
    const rawBody = Buffer.from('{"event":"message.received","data":{"id":"1"}}');
    const correctSig = crypto
      .createHmac('sha256', 'my-secret')
      .update(rawBody)
      .digest('hex');

    const parsedBody = JSON.parse(rawBody.toString('utf8'));

    expect(
      adapter.validateSignature(correctSig, parsedBody, {
        ...baseConfig,
        webhookSecret: 'my-secret',
        credentials: {},
      }, { rawBody }),
    ).toBe(true);
  });

  it('T2-B: rejects a signature computed over JSON.stringify when rawBody is provided', () => {
    // JSON.stringify may produce a different byte sequence than the original raw body.
    // The fix must use rawBody when available.
    const rawBody = Buffer.from(' { "event" : "x" } '); // note leading space
    const parsedBody = JSON.parse(rawBody.toString('utf8'));

    // Signature computed over JSON.stringify (wrong) should NOT match when rawBody is given
    const wrongSig = crypto
      .createHmac('sha256', 'secret')
      .update(JSON.stringify(parsedBody))
      .digest('hex');

    expect(
      adapter.validateSignature(wrongSig, parsedBody, {
        ...baseConfig,
        webhookSecret: 'secret',
        credentials: {},
      }, { rawBody }),
    ).toBe(false);
  });

  it('T2-B: falls back to JSON.stringify when no rawBody is available (backward compat)', () => {
    // When rawBody is absent we still verify using JSON.stringify — better than no check.
    const body = { event: 'message.received', data: { id: '1' } };
    const sig = crypto
      .createHmac('sha256', 'secret')
      .update(JSON.stringify(body))
      .digest('hex');

    expect(
      adapter.validateSignature(sig, body, {
        ...baseConfig,
        webhookSecret: 'secret',
        credentials: {},
      }),
    ).toBe(true);
  });

  // ── T2-B: timing-safe comparison ─────────────────────────────────────────

  it('T2-B: rejects a tampered (incorrect) signature', () => {
    const body = { event: 'msg', data: {} };
    expect(
      adapter.validateSignature('deadbeef', body, {
        ...baseConfig,
        webhookSecret: 'secret',
        credentials: {},
      }),
    ).toBe(false);
  });

  it('T2-B: accepts a correct HMAC-SHA256 signature (no rawBody)', () => {
    const body = { event: 'msg', data: {} };
    const correctSig = crypto
      .createHmac('sha256', 'secret')
      .update(JSON.stringify(body))
      .digest('hex');

    expect(
      adapter.validateSignature(correctSig, body, {
        ...baseConfig,
        webhookSecret: 'secret',
        credentials: {},
      }),
    ).toBe(true);
  });
});
