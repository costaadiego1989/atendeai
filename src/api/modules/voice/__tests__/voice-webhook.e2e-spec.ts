import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('VoiceWebhookController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let callId: string;

  const tenantCnpj = `ve${Date.now()}`.slice(-14);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: { companyName: 'Voice E2E Store', cnpj: tenantCnpj, plan: 'ESSENCIAL' },
    });
    tenantId = tenant.id;

    // Create voice agent config
    await prisma.voiceAgentConfig.create({
      data: {
        tenantId,
        enabled: true,
        voiceId: 'voice-test',
        language: 'pt-BR',
        maxDiscount: 15,
        maxInstallments: 6,
        minInstallmentValue: 50,
        callWindowStart: '09:00',
        callWindowEnd: '18:00',
        blockedDays: [],
        greeting: 'Olá, estou ligando sobre um débito.',
        transferPhone: '+5511999999999',
      },
    });

    // Create a voice call record
    const call = await prisma.voiceCall.create({
      data: {
        tenantId,
        contactId: '00000000-0000-0000-0000-000000000001',
        direction: 'OUTBOUND',
        status: 'RINGING',
      },
    });
    callId = call.id;
  });

  afterAll(async () => {
    await prisma.voiceCall.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.voiceAgentConfig.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await app.close();
  });

  describe('POST /api/v1/voice/webhook/twiml/:callId', () => {
    it('should return TwiML with greeting', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/voice/webhook/twiml/${callId}`)
        .expect(201);

      expect(response.headers['content-type']).toContain('text/xml');
      expect(response.text).toContain('Olá, estou ligando sobre um débito.');
      expect(response.text).toContain('<Gather');
      expect(response.text).toContain('speech');

      // Verify call status was updated
      const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
      expect(call!.status).toBe('IN_PROGRESS');
    });

    it('should return 404 for nonexistent call', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/voice/webhook/twiml/00000000-0000-0000-0000-000000000099')
        .expect(404);

      expect(response.text).toContain('Erro interno');
    });
  });

  describe('POST /api/v1/voice/webhook/gather/:callId', () => {
    it('should handle positive speech result', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/voice/webhook/gather/${callId}`)
        .send({ SpeechResult: 'Sim, quero pagar agora', Confidence: '0.92' })
        .expect(201);

      expect(response.headers['content-type']).toContain('text/xml');
      expect(response.text).toContain('link de pagamento');

      // Verify outcome was set
      const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
      expect(call!.outcome).toBe('NEGOTIATED');
    });

    it('should handle transfer request', async () => {
      // Reset outcome for this test
      await prisma.voiceCall.update({ where: { id: callId }, data: { outcome: null } });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/voice/webhook/gather/${callId}`)
        .send({ SpeechResult: 'Quero falar com supervisor', Confidence: '0.88' })
        .expect(201);

      expect(response.text).toContain('transferir');
      expect(response.text).toContain('+5511999999999');

      const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
      expect(call!.outcome).toBe('TRANSFERRED');
    });

    it('should handle negative speech result', async () => {
      await prisma.voiceCall.update({ where: { id: callId }, data: { outcome: null } });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/voice/webhook/gather/${callId}`)
        .send({ SpeechResult: 'Não posso agora', Confidence: '0.85' })
        .expect(201);

      expect(response.text).toContain('condições especiais');

      const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
      expect(call!.outcome).toBe('REFUSED');
    });

    it('should handle unclear speech', async () => {
      await prisma.voiceCall.update({ where: { id: callId }, data: { outcome: null } });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/voice/webhook/gather/${callId}`)
        .send({ SpeechResult: 'hmm talvez', Confidence: '0.4' })
        .expect(201);

      expect(response.text).toContain('não entendi bem');
    });

    it('should store transcript entries', async () => {
      const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
      const transcript = call!.transcript as any[];
      expect(transcript.length).toBeGreaterThanOrEqual(1);
      expect(transcript[0]).toEqual(
        expect.objectContaining({ role: 'customer' }),
      );
    });
  });

  describe('POST /api/v1/voice/webhook/status/:callId', () => {
    it('should update call status from Twilio callback', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/voice/webhook/status/${callId}`)
        .send({ CallStatus: 'completed', CallDuration: '45' })
        .expect(200);

      expect(response.text).toBe('OK');

      const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
      expect(call!.status).toBe('COMPLETED');
      expect(call!.duration).toBe(45);
    });

    it('should handle no-answer status', async () => {
      // Create a fresh call for this test
      const newCall = await prisma.voiceCall.create({
        data: {
          tenantId,
          contactId: '00000000-0000-0000-0000-000000000002',
          direction: 'OUTBOUND',
          status: 'RINGING',
        },
      });

      await request(app.getHttpServer())
        .post(`/api/v1/voice/webhook/status/${newCall.id}`)
        .send({ CallStatus: 'no-answer', CallDuration: '0' })
        .expect(200);

      const updated = await prisma.voiceCall.findUnique({ where: { id: newCall.id } });
      expect(updated!.status).toBe('NO_ANSWER');
      expect(updated!.outcome).toBe('NO_ANSWER');
    });

    it('should include recording URL when provided', async () => {
      const newCall = await prisma.voiceCall.create({
        data: {
          tenantId,
          contactId: '00000000-0000-0000-0000-000000000003',
          direction: 'OUTBOUND',
          status: 'IN_PROGRESS',
        },
      });

      await request(app.getHttpServer())
        .post(`/api/v1/voice/webhook/status/${newCall.id}`)
        .send({
          CallStatus: 'completed',
          CallDuration: '120',
          RecordingUrl: 'https://api.twilio.com/recordings/RE123',
        })
        .expect(200);

      const updated = await prisma.voiceCall.findUnique({ where: { id: newCall.id } });
      expect(updated!.recordingUrl).toBe('https://api.twilio.com/recordings/RE123');
    });
  });
});
