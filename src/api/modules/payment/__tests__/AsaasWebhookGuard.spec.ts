import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AsaasWebhookGuard } from '../presentation/guards/AsaasWebhookGuard';

describe('AsaasWebhookGuard', () => {
  let guard: AsaasWebhookGuard;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    guard = new AsaasWebhookGuard(configService);
  });

  function createContext(
    signature?: string,
    body: Record<string, unknown> = {},
  ) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'asaas-api-signature': signature,
          },
          body,
        }),
      }),
    } as ExecutionContext;
  }

  it('should reject when the webhook secret is missing', () => {
    configService.get.mockReturnValue(undefined);

    expect(() => guard.canActivate(createContext('signature'))).toThrow(
      ForbiddenException,
    );
  });

  it('should reject when the signature header is missing', () => {
    configService.get.mockReturnValue('secret');

    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('should reject when the signature does not match the payload hash', () => {
    configService.get.mockReturnValue('secret');

    expect(() =>
      guard.canActivate(
        createContext('invalid-signature', { event: 'PAYMENT_RECEIVED' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('should allow the request when the signature is valid', () => {
    configService.get.mockReturnValue('secret');
    const body = { event: 'PAYMENT_RECEIVED', payment: { id: 'pay-1' } };
    const signature = crypto
      .createHmac('sha256', 'secret')
      .update(JSON.stringify(body))
      .digest('hex');

    const result = guard.canActivate(createContext(signature, body));

    expect(result).toBe(true);
  });
});
