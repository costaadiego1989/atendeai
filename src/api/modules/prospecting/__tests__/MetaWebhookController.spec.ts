import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MetaWebhookController } from '../presentation/controllers/MetaWebhookController';
import { IHandleMetaQualityEventUseCase } from '../application/use-cases/interfaces/IHandleMetaQualityEventUseCase';

function makeController(appSecret = 'test-secret', verifyToken = 'verify-token') {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'WHATSAPP_APP_SECRET') return appSecret;
      if (key === 'META_WEBHOOK_VERIFY_TOKEN') return verifyToken;
      return undefined;
    }),
  } as unknown as ConfigService;

  const handleMetaQualityEvent: jest.Mocked<IHandleMetaQualityEventUseCase> = {
    execute: jest.fn().mockResolvedValue({ processed: 1 }),
  };

  const controller = new MetaWebhookController(configService, handleMetaQualityEvent);
  return { controller, handleMetaQualityEvent };
}

function makeSignature(body: Record<string, unknown>, secret: string): string {
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');
  return `sha256=${hmac}`;
}

const optOutBody = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WABA_ID',
      changes: [
        {
          value: {
            contacts: [{ wa_id: '5511999998888' }],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

describe('MetaWebhookController', () => {
  afterEach(() => jest.clearAllMocks());

  describe('GET /meta/webhook — challenge verification', () => {
    it('returns challenge when mode and token match', () => {
      const { controller } = makeController();
      const result = controller.verifyChallenge('subscribe', 'verify-token', 'challenge-123');
      expect(result).toBe('challenge-123');
    });

    it('throws ForbiddenException when verify token does not match', () => {
      const { controller } = makeController();
      expect(() =>
        controller.verifyChallenge('subscribe', 'wrong-token', 'challenge-123'),
      ).toThrow(ForbiddenException);
    });
  });

  describe('POST /meta/webhook — opt-out processing', () => {
    it('processes opt-out event when HMAC signature is valid', async () => {
      const { controller, handleMetaQualityEvent } = makeController();
      const signature = makeSignature(optOutBody, 'test-secret');

      const result = await controller.handleEvent(optOutBody, signature);

      expect(handleMetaQualityEvent.execute).toHaveBeenCalledWith({
        phone: '5511999998888',
      });
      expect(result).toEqual({ status: 'ok' });
    });

    it('throws ForbiddenException when HMAC signature is invalid', async () => {
      const { controller } = makeController();

      await expect(
        controller.handleEvent(optOutBody, 'sha256=invalidsignature'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when signature header is missing', async () => {
      const { controller } = makeController();

      await expect(
        controller.handleEvent(optOutBody, ''),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns ok silently when payload has no contacts (no opt-out events)', async () => {
      const { controller, handleMetaQualityEvent } = makeController();
      const emptyBody = { object: 'whatsapp_business_account', entry: [] };
      const signature = makeSignature(emptyBody, 'test-secret');

      const result = await controller.handleEvent(emptyBody, signature);

      expect(handleMetaQualityEvent.execute).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'ok' });
    });
  });
});
