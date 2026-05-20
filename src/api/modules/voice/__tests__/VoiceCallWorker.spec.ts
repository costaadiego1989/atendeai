import { VoiceCallWorker } from '../infrastructure/queue/VoiceCallWorker';
import { MakeOutboundCallUseCase } from '../application/use-cases/MakeOutboundCallUseCase';
import { Job } from 'bullmq';

describe('VoiceCallWorker', () => {
  let worker: VoiceCallWorker;
  let makeOutboundCallUseCase: jest.Mocked<MakeOutboundCallUseCase>;

  beforeEach(() => {
    makeOutboundCallUseCase = {
      execute: jest.fn(),
    } as any;

    worker = new VoiceCallWorker(makeOutboundCallUseCase);
  });

  it('should process job successfully', async () => {
    makeOutboundCallUseCase.execute.mockResolvedValue({
      success: true,
      callId: 'call-1',
      externalCallId: 'twilio-123',
    });

    const job = {
      id: 'job-1',
      data: {
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        recoveryCaseId: 'case-1',
        phone: '+5511999999999',
      },
    } as Job;

    const result = await worker.process(job);

    expect(result).toEqual({ callId: 'call-1', externalCallId: 'twilio-123' });
    expect(makeOutboundCallUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      recoveryCaseId: 'case-1',
      phone: '+5511999999999',
    });
  });

  it('should throw when call fails', async () => {
    makeOutboundCallUseCase.execute.mockResolvedValue({
      success: false,
      callId: 'call-1',
      error: 'Outside call window',
    });

    const job = {
      id: 'job-2',
      data: {
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        phone: '+5511999999999',
      },
    } as Job;

    await expect(worker.process(job)).rejects.toThrow('Outside call window');
  });

  it('should throw with generic message when no error provided', async () => {
    makeOutboundCallUseCase.execute.mockResolvedValue({
      success: false,
    });

    const job = {
      id: 'job-3',
      data: {
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        phone: '+5511999999999',
      },
    } as Job;

    await expect(worker.process(job)).rejects.toThrow('Call failed');
  });
});
