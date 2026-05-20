import { MakeOutboundCallUseCase } from '../application/use-cases/MakeOutboundCallUseCase';
import { ITelephonyProvider } from '../application/ports/ITelephonyProvider';
import { VoiceNegotiationService } from '../application/services/VoiceNegotiationService';
import { ConfigService } from '@nestjs/config';
import * as NegotiationRules from '../domain/value-objects/NegotiationRules';

describe('MakeOutboundCallUseCase', () => {
  let useCase: MakeOutboundCallUseCase;
  let telephony: jest.Mocked<ITelephonyProvider>;
  let prisma: any;
  let configService: jest.Mocked<ConfigService>;
  let negotiationService: jest.Mocked<VoiceNegotiationService>;

  const mockVoiceConfig = {
    id: 'vc-1',
    tenantId: 'tenant-1',
    enabled: true,
    voiceId: 'voice-1',
    language: 'pt-BR',
    maxDiscount: 15,
    maxInstallments: 6,
    minInstallmentValue: 50,
    callWindowStart: '09:00',
    callWindowEnd: '18:00',
    blockedDays: [],
    greeting: 'Olá!',
    transferPhone: '+5511999999999',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    telephony = {
      makeCall: jest.fn(),
      endCall: jest.fn(),
      transferCall: jest.fn(),
    } as any;

    prisma = {
      voiceAgentConfig: {
        findUnique: jest.fn(),
      },
      voiceCall: {
        create: jest.fn().mockResolvedValue({ id: 'call-1' }),
        update: jest.fn(),
      },
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'API_BASE_URL') return 'https://api.atendeai.com';
        if (key === 'TWILIO_PHONE_NUMBER') return '+5511888888888';
        return '';
      }),
    } as any;

    negotiationService = {} as any;

    useCase = new MakeOutboundCallUseCase(
      telephony,
      prisma,
      configService,
      negotiationService,
    );
  });

  it('should make a call successfully', async () => {
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(mockVoiceConfig);
    telephony.makeCall.mockResolvedValue({ success: true, externalCallId: 'twilio-123' });
    jest.spyOn(NegotiationRules, 'isWithinCallWindow').mockReturnValue(true);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      recoveryCaseId: 'case-1',
      phone: '+5511999999999',
    });

    expect(result.success).toBe(true);
    expect(result.callId).toBe('call-1');
    expect(result.externalCallId).toBe('twilio-123');
    expect(prisma.voiceCall.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          contactId: 'contact-1',
          direction: 'OUTBOUND',
          status: 'QUEUED',
        }),
      }),
    );
  });

  it('should fail when voice agent is not configured', async () => {
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(null);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      phone: '+5511999999999',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured or disabled');
    expect(telephony.makeCall).not.toHaveBeenCalled();
  });

  it('should fail when voice agent is disabled', async () => {
    prisma.voiceAgentConfig.findUnique.mockResolvedValue({ ...mockVoiceConfig, enabled: false });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      phone: '+5511999999999',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured or disabled');
  });

  it('should fail when outside call window', async () => {
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(mockVoiceConfig);
    jest.spyOn(NegotiationRules, 'isWithinCallWindow').mockReturnValue(false);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      phone: '+5511999999999',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Outside call window');
    expect(prisma.voiceCall.create).not.toHaveBeenCalled();
  });

  it('should mark call as FAILED when telephony fails', async () => {
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(mockVoiceConfig);
    jest.spyOn(NegotiationRules, 'isWithinCallWindow').mockReturnValue(true);
    telephony.makeCall.mockResolvedValue({ success: false, error: 'Invalid phone number' });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      phone: '+invalid',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid phone number');
    expect(prisma.voiceCall.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'call-1' },
        data: { status: 'FAILED' },
      }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
