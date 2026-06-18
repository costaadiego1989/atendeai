/**
 * T4-C: VoiceWebhookController guard tests
 * Verifies that webhook endpoints reject requests with missing/forged Twilio signatures.
 * Written BEFORE wiring TwilioWebhookGuard (TDD: red → green).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { VoiceWebhookController } from '../presentation/controllers/VoiceWebhookController';
import { TwilioWebhookGuard } from '../guards/TwilioWebhookGuard';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ProcessGatherWebhookUseCase } from '../application/use-cases/ProcessGatherWebhookUseCase';
import { ProcessCallOutcomeUseCase } from '../application/use-cases/ProcessCallOutcomeUseCase';

function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], '');
  return crypto
    .createHmac('sha1', authToken)
    .update(url + sortedParams)
    .digest('base64');
}

describe('VoiceWebhookController – T4-C Twilio signature enforcement', () => {
  let app: INestApplication;
  const AUTH_TOKEN = 'test-webhook-secret';

  const prismaMock = {
    voiceCall: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'call-1',
        tenantId: 'tenant-test',
        status: 'RINGING',
        outcome: null,
        transcript: [],
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    voiceAgentConfig: {
      findUnique: jest.fn().mockResolvedValue({
        greeting: 'Olá teste',
        tenantId: 'tenant-test',
      }),
    },
  };

  const processGatherMock = {
    execute: jest.fn().mockResolvedValue({
      twiml: '<?xml version="1.0" encoding="UTF-8"?><Response><Say>OK</Say></Response>',
    }),
  };

  const processCallOutcomeMock = {
    execute: jest.fn(),
    executeScoped: jest.fn().mockResolvedValue({ updated: true }),
  };

  beforeAll(async () => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [VoiceWebhookController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: ProcessGatherWebhookUseCase, useValue: processGatherMock },
        { provide: ProcessCallOutcomeUseCase, useValue: processCallOutcomeMock },
        TwilioWebhookGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    await app.close();
  });

  describe('POST /voice/webhook/twiml/:callId', () => {
    it('rejects request without X-Twilio-Signature → 403', async () => {
      await request(app.getHttpServer())
        .post('/voice/webhook/twiml/call-1')
        .send({ CallSid: 'CA123' })
        .expect(403);
    });

    it('rejects request with forged X-Twilio-Signature → 403', async () => {
      await request(app.getHttpServer())
        .post('/voice/webhook/twiml/call-1')
        .set('X-Twilio-Signature', 'totally-forged-signature==')
        .send({ CallSid: 'CA123' })
        .expect(403);
    });

    it('accepts request with valid Twilio signature → 2xx', async () => {
      // Supertest binds to a random port; we need to get it AFTER listening.
      // Start listening first, then read the port.
      const httpServer = app.getHttpServer();
      await new Promise<void>((resolve) => {
        if (httpServer.listening) return resolve();
        httpServer.listen(0, '127.0.0.1', resolve);
      });
      const port = (httpServer.address() as any)?.port ?? 80;
      const url = `http://127.0.0.1:${port}/voice/webhook/twiml/call-1`;
      const params = { CallSid: 'CA123', CallStatus: 'ringing' };
      const sig = computeTwilioSignature(AUTH_TOKEN, url, params);

      const response = await request(httpServer)
        .post('/voice/webhook/twiml/call-1')
        .set('X-Twilio-Signature', sig)
        .type('form')
        .send(params);

      expect([200, 201]).toContain(response.status);
    });
  });

  describe('POST /voice/webhook/gather/:callId', () => {
    it('rejects request without X-Twilio-Signature → 403', async () => {
      await request(app.getHttpServer())
        .post('/voice/webhook/gather/call-1')
        .send({ SpeechResult: 'sim', Confidence: '0.9' })
        .expect(403);
    });
  });

  describe('POST /voice/webhook/status/:callId', () => {
    it('rejects request without X-Twilio-Signature → 403', async () => {
      await request(app.getHttpServer())
        .post('/voice/webhook/status/call-1')
        .send({ CallStatus: 'completed', CallDuration: '60' })
        .expect(403);
    });
  });
});
