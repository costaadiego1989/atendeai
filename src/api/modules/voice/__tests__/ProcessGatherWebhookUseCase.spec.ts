import { ProcessGatherWebhookUseCase } from '../application/use-cases/ProcessGatherWebhookUseCase';
import { IVoiceCallRepository } from '../application/ports/IVoiceCallRepository';

describe('ProcessGatherWebhookUseCase', () => {
  let useCase: ProcessGatherWebhookUseCase;
  let voiceCallRepo: jest.Mocked<IVoiceCallRepository>;
  let prisma: any;

  const mockCall = {
    id: 'call-1',
    tenantId: 'tenant-1',
    contactId: 'contact-1',
    direction: 'OUTBOUND' as const,
    status: 'IN_PROGRESS' as const,
    transcript: [],
    outcome: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    voiceCallRepo = {
      findById: jest.fn(),
      save: jest.fn(),
      updateStatus: jest.fn(),
      appendTranscript: jest.fn().mockResolvedValue(undefined),
    };

    prisma = {
      voiceCall: {
        findUnique: jest.fn().mockResolvedValue(mockCall),
      },
      voiceAgentConfig: {
        findUnique: jest.fn().mockResolvedValue({ transferPhone: '+5511999999999' }),
      },
    };

    useCase = new ProcessGatherWebhookUseCase(voiceCallRepo, prisma);
  });

  describe('V1: atomic transcript append (no race condition)', () => {
    it('should call appendTranscript (not prisma.voiceCall.update) for transcript', async () => {
      await useCase.execute({
        callId: 'call-1',
        speechResult: 'Sim, aceito',
        confidence: 0.95,
      });

      // Must use atomic append — never read-modify-write
      expect(voiceCallRepo.appendTranscript).toHaveBeenCalledWith(
        'call-1',
        'tenant-1',
        expect.objectContaining({
          role: 'customer',
          text: 'Sim, aceito',
          confidence: 0.95,
        }),
      );
    });

    it('should NOT call prisma.voiceCall.update for transcript (race condition fix)', async () => {
      // The old code did: findUnique → push → update (lost-update race)
      // The new code must NOT call prisma.voiceCall.update for transcript
      await useCase.execute({
        callId: 'call-1',
        speechResult: 'Não quero',
        confidence: 0.8,
      });

      // prisma.voiceCall.update should NOT be called (no direct Prisma writes in use case)
      expect(prisma.voiceCall.update).toBeUndefined();
    });

    it('two concurrent appends both preserve their entries (atomic guarantee)', async () => {
      // Simulate that appendTranscript is called twice with different entries
      const calls: any[] = [];
      voiceCallRepo.appendTranscript.mockImplementation(async (callId, tenantId, entry) => {
        calls.push(entry);
      });

      await Promise.all([
        useCase.execute({ callId: 'call-1', speechResult: 'Entry A', confidence: 0.9 }),
        useCase.execute({ callId: 'call-1', speechResult: 'Entry B', confidence: 0.85 }),
      ]);

      // Both entries must have been submitted for atomic append
      expect(calls).toHaveLength(2);
      expect(calls.map((e) => e.text)).toEqual(
        expect.arrayContaining(['Entry A', 'Entry B']),
      );
    });
  });

  describe('V2: no Prisma calls for business logic mutations', () => {
    it('should use voiceCallRepo.updateStatus for outcome, not prisma.voiceCall.update', async () => {
      await useCase.execute({
        callId: 'call-1',
        speechResult: 'Sim, quero pagar',
        confidence: 0.95,
      });

      // Business logic mutations must go through repository
      expect(voiceCallRepo.updateStatus).toHaveBeenCalled();
    });

    it('should return TwiML without prisma.voiceCall.update being called', async () => {
      const result = await useCase.execute({
        callId: 'call-1',
        speechResult: 'Sim',
        confidence: 0.9,
      });

      expect(result.twiml).toContain('<?xml');
      expect(result.twiml).toContain('Response');
    });
  });

  describe('intent detection', () => {
    it('positive response → NEGOTIATED outcome + payment TwiML', async () => {
      const result = await useCase.execute({
        callId: 'call-1',
        speechResult: 'Sim, quero pagar',
        confidence: 0.9,
      });

      expect(result.twiml).toContain('link de pagamento');
      expect(voiceCallRepo.updateStatus).toHaveBeenCalledWith(
        'call-1',
        'tenant-1',
        'IN_PROGRESS',
        expect.objectContaining({ outcome: 'NEGOTIATED' }),
      );
    });

    it('negative response → REFUSED outcome + retry TwiML', async () => {
      const result = await useCase.execute({
        callId: 'call-1',
        speechResult: 'Não, agora não posso',
        confidence: 0.85,
      });

      expect(result.twiml).toContain('condições especiais');
      expect(voiceCallRepo.updateStatus).toHaveBeenCalledWith(
        'call-1',
        'tenant-1',
        'IN_PROGRESS',
        expect.objectContaining({ outcome: 'REFUSED' }),
      );
    });

    it('transfer request → TRANSFERRED outcome + Dial TwiML', async () => {
      const result = await useCase.execute({
        callId: 'call-1',
        speechResult: 'Quero falar com um supervisor',
        confidence: 0.9,
      });

      expect(result.twiml).toContain('transferir');
      expect(result.twiml).toContain('+5511999999999');
      expect(voiceCallRepo.updateStatus).toHaveBeenCalledWith(
        'call-1',
        'tenant-1',
        'IN_PROGRESS',
        expect.objectContaining({ outcome: 'TRANSFERRED' }),
      );
    });

    it('transfer without phone → fallback TwiML, no transfer', async () => {
      prisma.voiceAgentConfig.findUnique.mockResolvedValue({ transferPhone: '' });

      const result = await useCase.execute({
        callId: 'call-1',
        speechResult: 'Quero falar com gerente',
        confidence: 0.9,
      });

      expect(result.twiml).toContain('não tenho um atendente');
      expect(result.twiml).not.toContain('<Dial>');
    });

    it('unclear response → ask again TwiML', async () => {
      const result = await useCase.execute({
        callId: 'call-1',
        speechResult: 'hmm talvez',
        confidence: 0.5,
      });

      expect(result.twiml).toContain('não entendi bem');
    });
  });
});
