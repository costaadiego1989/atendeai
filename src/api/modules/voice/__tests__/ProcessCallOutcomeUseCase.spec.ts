import { ProcessCallOutcomeUseCase } from '../application/use-cases/ProcessCallOutcomeUseCase';
import { IVoiceCallRepository } from '../application/ports/IVoiceCallRepository';
import { VoiceCall } from '../domain/entities/VoiceCall';

describe('ProcessCallOutcomeUseCase', () => {
  let useCase: ProcessCallOutcomeUseCase;
  let voiceCallRepo: jest.Mocked<IVoiceCallRepository>;

  const makeCall = (overrides: Partial<VoiceCall> = {}): VoiceCall => ({
    id: 'call-1',
    tenantId: 'tenant-1',
    contactId: 'contact-1',
    direction: 'OUTBOUND',
    status: 'IN_PROGRESS',
    outcome: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    voiceCallRepo = {
      findById: jest.fn().mockResolvedValue(makeCall()),
      save: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      appendTranscript: jest.fn(),
    };
    useCase = new ProcessCallOutcomeUseCase(voiceCallRepo);
  });

  describe('V4: outcome mapping for all terminal statuses', () => {
    it('completed → COMPLETED status, no forced outcome (outcome comes from gather flow)', async () => {
      const result = await useCase.executeScoped(
        'call-1',
        'tenant-1',
        'completed',
        45,
        null,
      );

      expect(result.updated).toBe(true);
      expect(voiceCallRepo.updateStatus).toHaveBeenCalledWith(
        'call-1',
        'tenant-1',
        'COMPLETED',
        expect.not.objectContaining({ outcome: expect.anything() }),
      );
    });

    it('no-answer → NO_ANSWER status + NO_ANSWER outcome', async () => {
      const result = await useCase.executeScoped(
        'call-1',
        'tenant-1',
        'no-answer',
        0,
        null,
      );

      expect(result.updated).toBe(true);
      expect(voiceCallRepo.updateStatus).toHaveBeenCalledWith(
        'call-1',
        'tenant-1',
        'NO_ANSWER',
        expect.objectContaining({ outcome: 'NO_ANSWER' }),
      );
    });

    it('busy → BUSY status + NO_ANSWER outcome (V4: was previously unhandled)', async () => {
      const result = await useCase.executeScoped(
        'call-1',
        'tenant-1',
        'busy',
        0,
        null,
      );

      expect(result.updated).toBe(true);
      expect(voiceCallRepo.updateStatus).toHaveBeenCalledWith(
        'call-1',
        'tenant-1',
        'BUSY',
        expect.objectContaining({ outcome: 'NO_ANSWER' }),
      );
    });

    it('failed → FAILED status + ERROR outcome', async () => {
      const result = await useCase.executeScoped(
        'call-1',
        'tenant-1',
        'failed',
        0,
        null,
      );

      expect(result.updated).toBe(true);
      expect(voiceCallRepo.updateStatus).toHaveBeenCalledWith(
        'call-1',
        'tenant-1',
        'FAILED',
        expect.objectContaining({ outcome: 'ERROR' }),
      );
    });

    it('should NOT override existing outcome set by gather flow', async () => {
      voiceCallRepo.findById.mockResolvedValue(
        makeCall({ outcome: 'NEGOTIATED', status: 'IN_PROGRESS' }),
      );

      const result = await useCase.executeScoped(
        'call-1',
        'tenant-1',
        'completed',
        120,
        null,
      );

      expect(result.updated).toBe(true);
      const [, , , extra] = voiceCallRepo.updateStatus.mock.calls[0];
      expect((extra as any)?.outcome).toBeUndefined();
    });

    it('should include duration when non-zero', async () => {
      await useCase.executeScoped('call-1', 'tenant-1', 'completed', 90, null);

      expect(voiceCallRepo.updateStatus).toHaveBeenCalledWith(
        'call-1',
        'tenant-1',
        'COMPLETED',
        expect.objectContaining({ duration: 90 }),
      );
    });

    it('should include recordingUrl when provided', async () => {
      await useCase.executeScoped(
        'call-1',
        'tenant-1',
        'completed',
        60,
        'https://api.twilio.com/recordings/RE123',
      );

      expect(voiceCallRepo.updateStatus).toHaveBeenCalledWith(
        'call-1',
        'tenant-1',
        'COMPLETED',
        expect.objectContaining({ recordingUrl: 'https://api.twilio.com/recordings/RE123' }),
      );
    });
  });

  describe('V4: idempotency — duplicate COMPLETED webhook is a no-op', () => {
    it('second COMPLETED webhook on already-COMPLETED call → no update', async () => {
      voiceCallRepo.findById.mockResolvedValue(
        makeCall({ status: 'COMPLETED', outcome: 'NEGOTIATED' }),
      );

      const result = await useCase.executeScoped(
        'call-1',
        'tenant-1',
        'completed',
        120,
        null,
      );

      expect(result.updated).toBe(false);
      expect(voiceCallRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('COMPLETED webhook on FAILED call → no update (already terminal)', async () => {
      voiceCallRepo.findById.mockResolvedValue(
        makeCall({ status: 'FAILED', outcome: 'ERROR' }),
      );

      const result = await useCase.executeScoped(
        'call-1',
        'tenant-1',
        'completed',
        0,
        null,
      );

      expect(result.updated).toBe(false);
      expect(voiceCallRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('COMPLETED webhook on NO_ANSWER call → no update (already terminal)', async () => {
      voiceCallRepo.findById.mockResolvedValue(
        makeCall({ status: 'NO_ANSWER', outcome: 'NO_ANSWER' }),
      );

      const result = await useCase.executeScoped(
        'call-1',
        'tenant-1',
        'completed',
        0,
        null,
      );

      expect(result.updated).toBe(false);
    });
  });

  describe('V4: call not found', () => {
    it('returns updated=false when call does not exist', async () => {
      voiceCallRepo.findById.mockResolvedValue(null);

      const result = await useCase.executeScoped(
        'missing',
        'tenant-1',
        'completed',
        0,
        null,
      );

      expect(result.updated).toBe(false);
      expect(voiceCallRepo.updateStatus).not.toHaveBeenCalled();
    });
  });
});
