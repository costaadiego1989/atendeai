import { VoiceWebhookController } from '../presentation/controllers/VoiceWebhookController';
import { Request, Response } from 'express';

describe('VoiceWebhookController', () => {
  let controller: VoiceWebhookController;
  let prisma: any;
  let res: jest.Mocked<Response>;

  beforeEach(() => {
    prisma = {
      voiceCall: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      voiceAgentConfig: {
        findUnique: jest.fn(),
      },
    };

    controller = new VoiceWebhookController(prisma);

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
    } as any;
  });

  describe('handleTwiml', () => {
    it('should return TwiML with greeting when call exists', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue({
        id: 'call-1',
        tenantId: 'tenant-1',
      });
      prisma.voiceAgentConfig.findUnique.mockResolvedValue({
        greeting: 'Olá, tudo bem?',
        transferPhone: '+5511999999999',
      });

      await controller.handleTwiml('call-1', {} as Request, res);

      expect(res.type).toHaveBeenCalledWith('text/xml');
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Olá, tudo bem?'));
      expect(prisma.voiceCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'IN_PROGRESS' },
        }),
      );
    });

    it('should return 404 when call not found', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue(null);

      await controller.handleTwiml('nonexistent', {} as Request, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Erro interno'));
    });

    it('should use default greeting when config has no greeting', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue({
        id: 'call-1',
        tenantId: 'tenant-1',
      });
      prisma.voiceAgentConfig.findUnique.mockResolvedValue({
        greeting: null,
      });

      await controller.handleTwiml('call-1', {} as Request, res);

      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('estou entrando em contato sobre um assunto importante'),
      );
    });
  });

  describe('handleGather', () => {
    const mockCall = {
      id: 'call-1',
      tenantId: 'tenant-1',
      transcript: [],
      outcome: null,
    };

    it('should handle positive response', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue(mockCall);
      const req = { body: { SpeechResult: 'Sim, quero pagar', Confidence: '0.9' } } as any;

      await controller.handleGather('call-1', req, res);

      expect(res.type).toHaveBeenCalledWith('text/xml');
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('link de pagamento'));
      expect(prisma.voiceCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ outcome: 'NEGOTIATED' }),
        }),
      );
    });

    it('should handle negative response', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue(mockCall);
      const req = { body: { SpeechResult: 'Não, agora não posso', Confidence: '0.85' } } as any;

      await controller.handleGather('call-1', req, res);

      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('condições especiais'));
      expect(prisma.voiceCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ outcome: 'REFUSED' }),
        }),
      );
    });

    it('should handle transfer request with transfer phone', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue(mockCall);
      prisma.voiceAgentConfig.findUnique.mockResolvedValue({
        transferPhone: '+5511888888888',
      });
      const req = { body: { SpeechResult: 'Quero falar com um supervisor', Confidence: '0.9' } } as any;

      await controller.handleGather('call-1', req, res);

      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('transferir'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('+5511888888888'));
      expect(prisma.voiceCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ outcome: 'TRANSFERRED' }),
        }),
      );
    });

    it('should handle transfer request without transfer phone', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue(mockCall);
      prisma.voiceAgentConfig.findUnique.mockResolvedValue({
        transferPhone: '',
      });
      const req = { body: { SpeechResult: 'Quero falar com gerente', Confidence: '0.9' } } as any;

      await controller.handleGather('call-1', req, res);

      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('não tenho um atendente'));
    });

    it('should handle unclear response', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue(mockCall);
      const req = { body: { SpeechResult: 'hmm talvez', Confidence: '0.5' } } as any;

      await controller.handleGather('call-1', req, res);

      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('não entendi bem'));
    });

    it('should store transcript entry', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue(mockCall);
      const req = { body: { SpeechResult: 'Sim', Confidence: '0.95' } } as any;

      await controller.handleGather('call-1', req, res);

      // First update is transcript, second is outcome
      expect(prisma.voiceCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transcript: expect.arrayContaining([
              expect.objectContaining({ role: 'customer', text: 'Sim' }),
            ]),
          }),
        }),
      );
    });
  });

  describe('handleStatus', () => {
    it('should update call status', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue({ id: 'call-1', outcome: null });
      const req = { body: { CallStatus: 'completed', CallDuration: '45' } } as any;

      await controller.handleStatus('call-1', req, res);

      expect(prisma.voiceCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED', duration: 45 }),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should map no-answer status and set outcome', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue({ id: 'call-1', outcome: null });
      const req = { body: { CallStatus: 'no-answer', CallDuration: '0' } } as any;

      await controller.handleStatus('call-1', req, res);

      expect(prisma.voiceCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'NO_ANSWER', outcome: 'NO_ANSWER' }),
        }),
      );
    });

    it('should not override existing outcome', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue({ id: 'call-1', outcome: 'NEGOTIATED' });
      const req = { body: { CallStatus: 'completed', CallDuration: '120' } } as any;

      await controller.handleStatus('call-1', req, res);

      const updateCall = prisma.voiceCall.update.mock.calls[0][0];
      expect(updateCall.data.outcome).toBeUndefined();
    });

    it('should include recording URL when provided', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue({ id: 'call-1', outcome: null });
      const req = {
        body: {
          CallStatus: 'completed',
          CallDuration: '60',
          RecordingUrl: 'https://api.twilio.com/recordings/RE123',
        },
      } as any;

      await controller.handleStatus('call-1', req, res);

      expect(prisma.voiceCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recordingUrl: 'https://api.twilio.com/recordings/RE123',
          }),
        }),
      );
    });
  });
});
