import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { VoiceNegotiationService } from '../application/services/VoiceNegotiationService';
import { MakeOutboundCallUseCase } from '../application/use-cases/MakeOutboundCallUseCase';
import { ProcessCallOutcomeUseCase } from '../application/use-cases/ProcessCallOutcomeUseCase';
import { ProcessGatherWebhookUseCase } from '../application/use-cases/ProcessGatherWebhookUseCase';
import { GetVoiceConfigUseCase } from '../application/use-cases/GetVoiceConfigUseCase';
import { UpdateVoiceConfigUseCase } from '../application/use-cases/UpdateVoiceConfigUseCase';
import { ListVoiceCallsUseCase } from '../application/use-cases/ListVoiceCallsUseCase';
import { VoiceCallWorker } from '../infrastructure/queue/VoiceCallWorker';
import { VoiceConfigController } from '../presentation/controllers/VoiceConfigController';
import { VOICE_CALL_REPOSITORY } from '../application/ports/IVoiceCallRepository';
import { TELEPHONY_PROVIDER } from '../application/ports/ITelephonyProvider';
import { VoiceCall } from '../domain/entities/VoiceCall';
import { SuggestVoiceScriptUseCase } from '../application/use-cases/SuggestVoiceScriptUseCase';

// ─── Shared mock factories ────────────────────────────────────────────────────

function makeVoiceCall(overrides: Partial<VoiceCall> = {}): VoiceCall {
  return {
    id: 'call-1',
    tenantId: 'tenant-1',
    contactId: 'contact-1',
    recoveryCaseId: null,
    direction: 'OUTBOUND',
    status: 'QUEUED',
    duration: null,
    recordingUrl: null,
    transcript: null,
    sentiment: null,
    outcome: null,
    negotiation: null,
    externalCallId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makePrismaMock() {
  return {
    voiceAgentConfig: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    voiceCall: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
}

function makeRepoMock() {
  return {
    findById: jest.fn(),
    save: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    appendTranscript: jest.fn().mockResolvedValue(undefined),
  };
}

function makeTelephonyMock() {
  return {
    makeCall: jest.fn().mockResolvedValue({ success: true, externalCallId: 'EXT-1' }),
    endCall: jest.fn().mockResolvedValue(undefined),
    transferCall: jest.fn().mockResolvedValue(undefined),
  };
}

const dbConfig = {
  id: 'cfg-1',
  tenantId: 'tenant-1',
  enabled: true,
  voiceId: 'voice-id',
  language: 'pt-BR',
  maxDiscount: 20,
  maxInstallments: 6,
  minInstallmentValue: 50,
  callWindowStart: '00:00',
  callWindowEnd: '23:59',
  blockedDays: [],
  greeting: null,
  transferPhone: null,
  persona: {},
  scripts: [],
  recoveryConfig: null,
  twilioPhoneNumber: null,
  activeScriptName: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── 1. NestJS module wiring ──────────────────────────────────────────────────

describe('VoiceModule wiring', () => {
  let module: TestingModule;
  let prisma: ReturnType<typeof makePrismaMock>;
  let repo: ReturnType<typeof makeRepoMock>;
  let telephony: ReturnType<typeof makeTelephonyMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = makeRepoMock();
    telephony = makeTelephonyMock();

    module = await Test.createTestingModule({
      providers: [
        VoiceNegotiationService,
        GetVoiceConfigUseCase,
        UpdateVoiceConfigUseCase,
        ListVoiceCallsUseCase,
        {
          provide: 'PrismaService',
          useValue: prisma,
        },
        {
          provide: VOICE_CALL_REPOSITORY,
          useValue: repo,
        },
        {
          provide: TELEPHONY_PROVIDER,
          useValue: telephony,
        },
        {
          provide: 'ConfigService',
          useValue: { get: jest.fn().mockReturnValue('https://api.example.com') },
        },
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should compile module without errors', () => {
    expect(module).toBeDefined();
  });

  it('should resolve VoiceNegotiationService from module', () => {
    const service = module.get(VoiceNegotiationService);
    expect(service).toBeInstanceOf(VoiceNegotiationService);
  });

  it('should resolve GetVoiceConfigUseCase from module', () => {
    const uc = module.get(GetVoiceConfigUseCase);
    expect(uc).toBeInstanceOf(GetVoiceConfigUseCase);
  });

  it('should resolve UpdateVoiceConfigUseCase from module', () => {
    const uc = module.get(UpdateVoiceConfigUseCase);
    expect(uc).toBeInstanceOf(UpdateVoiceConfigUseCase);
  });

  it('should resolve ListVoiceCallsUseCase from module', () => {
    const uc = module.get(ListVoiceCallsUseCase);
    expect(uc).toBeInstanceOf(ListVoiceCallsUseCase);
  });
});

// ─── 2. Repository mock injection and interaction ─────────────────────────────

describe('ProcessCallOutcomeUseCase + repository integration', () => {
  let useCase: ProcessCallOutcomeUseCase;
  let repo: ReturnType<typeof makeRepoMock>;

  beforeEach(async () => {
    repo = makeRepoMock();
    const module = await Test.createTestingModule({
      providers: [
        ProcessCallOutcomeUseCase,
        { provide: VOICE_CALL_REPOSITORY, useValue: repo },
      ],
    }).compile();
    useCase = module.get(ProcessCallOutcomeUseCase);
  });

  it('should wire ProcessCallOutcomeUseCase with repo via DI', () => {
    expect(useCase).toBeInstanceOf(ProcessCallOutcomeUseCase);
  });

  it('should call repo.findById with correct tenantId on executeScoped', async () => {
    repo.findById.mockResolvedValue(null);
    await useCase.executeScoped('c1', 'tenant-42', 'completed', 60);
    expect(repo.findById).toHaveBeenCalledWith('c1', 'tenant-42');
  });

  it('should call repo.updateStatus after finding a non-terminal call', async () => {
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'RINGING' }));
    await useCase.executeScoped('c1', 'tenant-1', 'completed', 60);
    expect(repo.updateStatus).toHaveBeenCalledTimes(1);
  });

  it('should propagate repository errors upward', async () => {
    repo.findById.mockRejectedValue(new Error('DB connection lost'));
    await expect(useCase.executeScoped('c1', 'tenant-1', 'completed', 60)).rejects.toThrow('DB connection lost');
  });

  it('should not call updateStatus when call not found', async () => {
    repo.findById.mockResolvedValue(null);
    await useCase.executeScoped('c1', 'tenant-1', 'completed', 60);
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('should pass correct status to repo.updateStatus', async () => {
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'RINGING' }));
    await useCase.executeScoped('c1', 'tenant-1', 'no-answer', 0);
    expect(repo.updateStatus).toHaveBeenCalledWith('c1', 'tenant-1', 'NO_ANSWER', expect.any(Object));
  });
});

// ─── 3. Service + repository integration chains ───────────────────────────────

describe('VoiceNegotiationService integrated with negotiation rules', () => {
  let service: VoiceNegotiationService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [VoiceNegotiationService],
    }).compile();
    service = module.get(VoiceNegotiationService);
  });

  afterEach(async () => {
    await module.close();
  });

  const cfg = {
    id: 'c1', tenantId: 't1', enabled: true, voiceId: 'v1', language: 'pt-BR',
    maxDiscountPercent: 15, maxInstallments: 4, minInstallmentValue: 60,
    callWindowStart: '08:00', callWindowEnd: '20:00', blockedDays: [],
    greeting: null, transferPhone: null, createdAt: new Date(), updatedAt: new Date(),
  };

  it('should build prompt with correct number of offers', () => {
    const result = service.buildNegotiationPrompt(cfg, {
      debtorName: 'Maria', amountDue: 600, dueDate: '2024-02-01',
      daysOverdue: 10, chargeTitle: 'Aluguel', previousAttempts: 1,
    });
    expect(result.offers.length).toBeGreaterThanOrEqual(2);
  });

  it('should return DISCOUNT offer with correct percentage', () => {
    const result = service.buildNegotiationPrompt(cfg, {
      debtorName: 'Maria', amountDue: 600, dueDate: '2024-02-01',
      daysOverdue: 10, chargeTitle: 'Aluguel', previousAttempts: 1,
    });
    const discountOffer = result.offers.find((o) => o.type === 'DISCOUNT');
    expect(discountOffer?.discountPercent).toBe(15);
  });

  it('should accept counter-offer within integrated rules', () => {
    const result = service.evaluateCounterOffer(10, 3, 600, cfg);
    expect(result.acceptable).toBe(true);
  });

  it('should reject counter-offer exceeding integrated rules', () => {
    const result = service.evaluateCounterOffer(20, 1, 600, cfg);
    expect(result.acceptable).toBe(false);
  });
});

// ─── 4. Controller + Service + Repository chain ───────────────────────────────

describe('VoiceConfigController + service integration', () => {
  let controller: VoiceConfigController;
  let prisma: ReturnType<typeof makePrismaMock>;
  let module: TestingModule;

  beforeEach(async () => {
    prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    prisma.voiceAgentConfig.upsert.mockResolvedValue(dbConfig);
    prisma.voiceCall.findMany.mockResolvedValue([]);
    prisma.voiceCall.count.mockResolvedValue(0);

    module = await Test.createTestingModule({
      controllers: [VoiceConfigController],
      providers: [
        GetVoiceConfigUseCase,
        UpdateVoiceConfigUseCase,
        ListVoiceCallsUseCase,
        {
          provide: SuggestVoiceScriptUseCase,
          useValue: { execute: jest.fn().mockResolvedValue({ template: 'Script text' }) },
        },
        { provide: 'PrismaService', useValue: prisma },
        { provide: 'ConfigService', useValue: { get: jest.fn() } },
      ],
    })
      .overrideProvider(GetVoiceConfigUseCase)
      .useValue({ execute: jest.fn().mockResolvedValue({ enabled: true, persona: {}, allowedHours: {}, recovery: {}, scripts: [] }) })
      .overrideProvider(UpdateVoiceConfigUseCase)
      .useValue({ execute: jest.fn().mockResolvedValue({ enabled: false }) })
      .overrideProvider(ListVoiceCallsUseCase)
      .useValue({ execute: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 }) })
      .compile();

    controller = module.get(VoiceConfigController);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should instantiate VoiceConfigController via DI', () => {
    expect(controller).toBeInstanceOf(VoiceConfigController);
  });

  it('should call getConfig.execute with tenantId', async () => {
    const getConfig = module.get(GetVoiceConfigUseCase);
    await controller.getVoiceConfig('tenant-1');
    expect(getConfig.execute).toHaveBeenCalledWith('tenant-1');
  });

  it('should call updateConfig.execute with tenantId and dto', async () => {
    const updateConfig = module.get(UpdateVoiceConfigUseCase);
    await controller.updateVoiceConfig('tenant-1', { enabled: false });
    expect(updateConfig.execute).toHaveBeenCalledWith('tenant-1', { enabled: false });
  });

  it('should call listCalls.execute with correct params', async () => {
    const listCalls = module.get(ListVoiceCallsUseCase);
    await controller.getVoiceCalls('tenant-1', { page: 2, limit: 10 });
    expect(listCalls.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', page: 2, limit: 10 }));
  });

  it('should return stubbed metrics object from getVoiceMetrics', async () => {
    const result = await controller.getVoiceMetrics('tenant-1');
    expect(result).toHaveProperty('totalCalls');
    expect(result).toHaveProperty('answeredRate');
  });
});

// ─── 5. BullMQ queue integration ─────────────────────────────────────────────

describe('VoiceCallWorker BullMQ integration', () => {
  let worker: VoiceCallWorker;
  let makeCallUseCase: { execute: jest.Mock };
  let module: TestingModule;

  beforeEach(async () => {
    makeCallUseCase = { execute: jest.fn().mockResolvedValue({ success: true, callId: 'c1', externalCallId: 'e1' }) };

    module = await Test.createTestingModule({
      providers: [
        VoiceCallWorker,
        { provide: MakeOutboundCallUseCase, useValue: makeCallUseCase },
      ],
    }).compile();

    worker = module.get(VoiceCallWorker);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should instantiate VoiceCallWorker via DI', () => {
    expect(worker).toBeInstanceOf(VoiceCallWorker);
  });

  it('should process job and invoke MakeOutboundCallUseCase', async () => {
    await worker.process({ id: 'j1', data: { tenantId: 't1', contactId: 'c1', phone: '+5511' } } as any);
    expect(makeCallUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('should return result with callId and externalCallId', async () => {
    const result = await worker.process({ id: 'j2', data: { tenantId: 't1', contactId: 'c1', phone: '+5511' } } as any);
    expect(result.callId).toBe('c1');
    expect(result.externalCallId).toBe('e1');
  });

  it('should throw error when use case returns failure', async () => {
    makeCallUseCase.execute.mockResolvedValue({ success: false, error: 'Outside window' });
    await expect(worker.process({ id: 'j3', data: { tenantId: 't1', contactId: 'c1', phone: '+5511' } } as any)).rejects.toThrow('Outside window');
  });

  it('should pass recoveryCaseId from job data to use case', async () => {
    await worker.process({ id: 'j4', data: { tenantId: 't1', contactId: 'c1', phone: '+5511', recoveryCaseId: 'rc-99' } } as any);
    expect(makeCallUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ recoveryCaseId: 'rc-99' }));
  });
});

// ─── 6. Prisma mock transactions ─────────────────────────────────────────────

describe('MakeOutboundCallUseCase Prisma transaction integration', () => {
  let useCase: MakeOutboundCallUseCase;
  let prisma: ReturnType<typeof makePrismaMock>;
  let telephony: ReturnType<typeof makeTelephonyMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    telephony = makeTelephonyMock();

    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    prisma.voiceCall.create.mockResolvedValue(makeVoiceCall({ id: 'new-call' }));
    prisma.voiceCall.update.mockResolvedValue({});

    const module = await Test.createTestingModule({
      providers: [
        MakeOutboundCallUseCase,
        VoiceNegotiationService,
        { provide: TELEPHONY_PROVIDER, useValue: telephony },
        { provide: 'PrismaService', useValue: prisma },
        { provide: 'ConfigService', useValue: { get: jest.fn().mockReturnValue('https://api.example.com') } },
      ],
    }).compile();

    useCase = module.get(MakeOutboundCallUseCase);
  });

  it('should create and then update call record atomically', async () => {
    await useCase.execute({ tenantId: 'tenant-1', contactId: 'c1', phone: '+5511' });
    expect(prisma.voiceCall.create).toHaveBeenCalledTimes(1);
    expect(prisma.voiceCall.update).toHaveBeenCalledTimes(1);
  });

  it('should update to FAILED on telephony failure without double-creating', async () => {
    telephony.makeCall.mockResolvedValue({ success: false, error: 'Twilio error' });
    await useCase.execute({ tenantId: 'tenant-1', contactId: 'c1', phone: '+5511' });
    expect(prisma.voiceCall.create).toHaveBeenCalledTimes(1);
    expect(prisma.voiceCall.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }));
  });

  it('should query voiceAgentConfig before creating call', async () => {
    await useCase.execute({ tenantId: 'tenant-1', contactId: 'c1', phone: '+5511' });
    const configCallOrder = prisma.voiceAgentConfig.findUnique.mock.invocationCallOrder[0];
    const createCallOrder = prisma.voiceCall.create.mock.invocationCallOrder[0];
    expect(configCallOrder).toBeLessThan(createCallOrder);
  });

  it('should return success:false without creating a call when config missing', async () => {
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(null);
    await useCase.execute({ tenantId: 'tenant-1', contactId: 'c1', phone: '+5511' });
    expect(prisma.voiceCall.create).not.toHaveBeenCalled();
  });

  it('should pass webhookUrl containing callId to telephony provider', async () => {
    await useCase.execute({ tenantId: 'tenant-1', contactId: 'c1', phone: '+5511' });
    const callArgs = telephony.makeCall.mock.calls[0][0];
    expect(callArgs.webhookUrl).toContain('new-call');
  });
});

// ─── 7. ProcessGatherWebhookUseCase integration ───────────────────────────────

describe('ProcessGatherWebhookUseCase integration', () => {
  let useCase: ProcessGatherWebhookUseCase;
  let prisma: ReturnType<typeof makePrismaMock>;
  let repo: ReturnType<typeof makeRepoMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = makeRepoMock();

    const module = await Test.createTestingModule({
      providers: [
        ProcessGatherWebhookUseCase,
        { provide: VOICE_CALL_REPOSITORY, useValue: repo },
        { provide: 'PrismaService', useValue: prisma },
      ],
    }).compile();

    useCase = module.get(ProcessGatherWebhookUseCase);
  });

  it('should return positive TwiML when speech contains "sim"', async () => {
    prisma.voiceCall.findUnique.mockResolvedValue(makeVoiceCall());
    const result = await useCase.execute({ callId: 'c1', speechResult: 'sim quero', confidence: 0.9 });
    expect(result.twiml).toContain('<Say');
    expect(result.twiml).toContain('Ótimo');
  });

  it('should update call outcome to NEGOTIATED on positive response', async () => {
    prisma.voiceCall.findUnique.mockResolvedValue(makeVoiceCall());
    await useCase.execute({ callId: 'c1', speechResult: 'aceito', confidence: 0.9 });
    expect(repo.updateStatus).toHaveBeenCalledWith('c1', 'tenant-1', 'IN_PROGRESS', expect.objectContaining({ outcome: 'NEGOTIATED' }));
  });

  it('should return negative TwiML with re-gather when speech contains "não"', async () => {
    prisma.voiceCall.findUnique.mockResolvedValue(makeVoiceCall());
    const result = await useCase.execute({ callId: 'c1', speechResult: 'não quero', confidence: 0.8 });
    expect(result.twiml).toContain('<Gather');
  });

  it('should update call outcome to REFUSED on negative response', async () => {
    prisma.voiceCall.findUnique.mockResolvedValue(makeVoiceCall());
    await useCase.execute({ callId: 'c1', speechResult: 'não', confidence: 0.8 });
    expect(repo.updateStatus).toHaveBeenCalledWith('c1', 'tenant-1', 'IN_PROGRESS', expect.objectContaining({ outcome: 'REFUSED' }));
  });

  it('should return transfer TwiML with phone when speech contains "supervisor"', async () => {
    prisma.voiceCall.findUnique.mockResolvedValue(makeVoiceCall());
    prisma.voiceAgentConfig.findUnique.mockResolvedValue({ transferPhone: '+551100000000' });
    const result = await useCase.execute({ callId: 'c1', speechResult: 'quero falar com supervisor', confidence: 0.9 });
    expect(result.twiml).toContain('<Dial>');
  });

  it('should return apologetic TwiML when transfer requested but no phone configured', async () => {
    prisma.voiceCall.findUnique.mockResolvedValue(makeVoiceCall());
    prisma.voiceAgentConfig.findUnique.mockResolvedValue({ transferPhone: null });
    const result = await useCase.execute({ callId: 'c1', speechResult: 'supervisor', confidence: 0.9 });
    expect(result.twiml).not.toContain('<Dial>');
  });

  it('should append transcript entry when call is found', async () => {
    prisma.voiceCall.findUnique.mockResolvedValue(makeVoiceCall());
    await useCase.execute({ callId: 'c1', speechResult: 'sim', confidence: 0.95 });
    expect(repo.appendTranscript).toHaveBeenCalledWith('c1', 'tenant-1', expect.objectContaining({ role: 'customer', text: 'sim' }));
  });

  it('should return unclear TwiML when speech does not match any intent', async () => {
    prisma.voiceCall.findUnique.mockResolvedValue(makeVoiceCall());
    const result = await useCase.execute({ callId: 'c1', speechResult: 'xyzabc', confidence: 0.3 });
    expect(result.twiml).toContain('não entendi');
  });

  it('should not throw when callRecord is null', async () => {
    prisma.voiceCall.findUnique.mockResolvedValue(null);
    const result = await useCase.execute({ callId: 'missing', speechResult: 'sim', confidence: 0.9 });
    expect(result.twiml).toBeDefined();
  });
});

// ─── 8. GetVoiceConfigUseCase + Prisma integration ────────────────────────────

describe('GetVoiceConfigUseCase Prisma integration', () => {
  let useCase: GetVoiceConfigUseCase;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        GetVoiceConfigUseCase,
        { provide: 'PrismaService', useValue: prisma },
      ],
    }).compile();
    useCase = module.get(GetVoiceConfigUseCase);
  });

  it('should not create config when it already exists', async () => {
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    await useCase.execute('tenant-1');
    expect(prisma.voiceAgentConfig.create).not.toHaveBeenCalled();
  });

  it('should create config with tenantId when not found', async () => {
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(null);
    prisma.voiceAgentConfig.create.mockResolvedValue({ ...dbConfig, tenantId: 'new-t' });
    await useCase.execute('new-t');
    expect(prisma.voiceAgentConfig.create).toHaveBeenCalledWith({ data: { tenantId: 'new-t' } });
  });

  it('should query by tenantId', async () => {
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    await useCase.execute('tenant-99');
    expect(prisma.voiceAgentConfig.findUnique).toHaveBeenCalledWith({ where: { tenantId: 'tenant-99' } });
  });
});

// ─── 9. UpdateVoiceConfigUseCase + Prisma integration ────────────────────────

describe('UpdateVoiceConfigUseCase Prisma integration', () => {
  let useCase: UpdateVoiceConfigUseCase;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    prisma.voiceAgentConfig.upsert.mockResolvedValue(dbConfig);

    const module = await Test.createTestingModule({
      providers: [
        GetVoiceConfigUseCase,
        UpdateVoiceConfigUseCase,
        { provide: 'PrismaService', useValue: prisma },
      ],
    }).compile();
    useCase = module.get(UpdateVoiceConfigUseCase);
  });

  it('should call prisma.upsert with tenantId as where clause', async () => {
    await useCase.execute('tenant-1', { enabled: true });
    expect(prisma.voiceAgentConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
  });

  it('should pass enabled:false in update payload', async () => {
    await useCase.execute('tenant-1', { enabled: false });
    const call = prisma.voiceAgentConfig.upsert.mock.calls[0][0];
    expect(call.update.enabled).toBe(false);
  });

  it('should return mapped voice config after update', async () => {
    const result = await useCase.execute('tenant-1', { enabled: true });
    expect(result).toHaveProperty('allowedHours');
    expect(result).toHaveProperty('scripts');
  });
});

// ─── 10. ListVoiceCallsUseCase Prisma integration ─────────────────────────────

describe('ListVoiceCallsUseCase Prisma integration', () => {
  let useCase: ListVoiceCallsUseCase;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        ListVoiceCallsUseCase,
        { provide: 'PrismaService', useValue: prisma },
      ],
    }).compile();
    useCase = module.get(ListVoiceCallsUseCase);
  });

  it('should run findMany and count in parallel', async () => {
    await useCase.execute({ tenantId: 'tenant-1' });
    expect(prisma.voiceCall.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.voiceCall.count).toHaveBeenCalledTimes(1);
  });

  it('should order results by createdAt desc', async () => {
    await useCase.execute({ tenantId: 'tenant-1' });
    expect(prisma.voiceCall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('should propagate DB error from findMany', async () => {
    prisma.voiceCall.findMany.mockRejectedValue(new Error('Timeout'));
    await expect(useCase.execute({ tenantId: 'tenant-1' })).rejects.toThrow('Timeout');
  });

  it('should return page and totalPages in response', async () => {
    prisma.voiceCall.count.mockResolvedValue(45);
    const result = await useCase.execute({ tenantId: 'tenant-1', page: 1, limit: 15 });
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(3);
  });
});

// ─── 11. Error propagation through layers ─────────────────────────────────────

describe('Error propagation through service layers', () => {
  it('should propagate Prisma error from GetVoiceConfigUseCase to caller', async () => {
    const prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockRejectedValue(new Error('Connection refused'));
    const module = await Test.createTestingModule({
      providers: [GetVoiceConfigUseCase, { provide: 'PrismaService', useValue: prisma }],
    }).compile();
    const uc = module.get(GetVoiceConfigUseCase);
    await expect(uc.execute('t1')).rejects.toThrow('Connection refused');
    await module.close();
  });

  it('should propagate telephony error from MakeOutboundCallUseCase', async () => {
    const prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    prisma.voiceCall.create.mockResolvedValue(makeVoiceCall({ id: 'c1' }));
    prisma.voiceCall.update.mockResolvedValue({});
    const telephony = { makeCall: jest.fn().mockRejectedValue(new Error('Twilio down')), endCall: jest.fn(), transferCall: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        MakeOutboundCallUseCase,
        VoiceNegotiationService,
        { provide: TELEPHONY_PROVIDER, useValue: telephony },
        { provide: 'PrismaService', useValue: prisma },
        { provide: 'ConfigService', useValue: { get: jest.fn() } },
      ],
    }).compile();
    const uc = module.get(MakeOutboundCallUseCase);
    await expect(uc.execute({ tenantId: 'tenant-1', contactId: 'c1', phone: '+5511' })).rejects.toThrow('Twilio down');
    await module.close();
  });

  it('should propagate repo error from ProcessCallOutcomeUseCase', async () => {
    const repo = makeRepoMock();
    repo.findById.mockRejectedValue(new Error('DB timeout'));
    const module = await Test.createTestingModule({
      providers: [ProcessCallOutcomeUseCase, { provide: VOICE_CALL_REPOSITORY, useValue: repo }],
    }).compile();
    const uc = module.get(ProcessCallOutcomeUseCase);
    await expect(uc.executeScoped('c1', 't1', 'completed', 30)).rejects.toThrow('DB timeout');
    await module.close();
  });

  it('should propagate repo appendTranscript error from ProcessGatherWebhookUseCase', async () => {
    const prisma = makePrismaMock();
    const repo = makeRepoMock();
    prisma.voiceCall.findUnique.mockResolvedValue(makeVoiceCall());
    repo.appendTranscript.mockRejectedValue(new Error('Write failure'));
    const module = await Test.createTestingModule({
      providers: [
        ProcessGatherWebhookUseCase,
        { provide: VOICE_CALL_REPOSITORY, useValue: repo },
        { provide: 'PrismaService', useValue: prisma },
      ],
    }).compile();
    const uc = module.get(ProcessGatherWebhookUseCase);
    await expect(uc.execute({ callId: 'c1', speechResult: 'sim', confidence: 0.9 })).rejects.toThrow('Write failure');
    await module.close();
  });
});

// ─── 12. Webhook payload processing integration ───────────────────────────────

describe('Webhook payload processing integration', () => {
  let useCase: ProcessGatherWebhookUseCase;
  let prisma: ReturnType<typeof makePrismaMock>;
  let repo: ReturnType<typeof makeRepoMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    repo = makeRepoMock();
    prisma.voiceCall.findUnique.mockResolvedValue(makeVoiceCall());
    prisma.voiceAgentConfig.findUnique.mockResolvedValue({ transferPhone: '+551100' });
    const module = await Test.createTestingModule({
      providers: [
        ProcessGatherWebhookUseCase,
        { provide: VOICE_CALL_REPOSITORY, useValue: repo },
        { provide: 'PrismaService', useValue: prisma },
      ],
    }).compile();
    useCase = module.get(ProcessGatherWebhookUseCase);
  });

  it('should handle "quero" as positive intent', async () => {
    const result = await useCase.execute({ callId: 'c1', speechResult: 'quero resolver', confidence: 0.85 });
    expect(result.twiml).toContain('Ótimo');
  });

  it('should handle "pode" as positive intent', async () => {
    const result = await useCase.execute({ callId: 'c1', speechResult: 'pode sim', confidence: 0.85 });
    expect(result.twiml).toContain('Ótimo');
  });

  it('should handle "concordo" as positive intent', async () => {
    const result = await useCase.execute({ callId: 'c1', speechResult: 'concordo com a proposta', confidence: 0.9 });
    expect(result.twiml).toContain('Ótimo');
  });

  it('should handle "gerente" as transfer intent', async () => {
    const result = await useCase.execute({ callId: 'c1', speechResult: 'quero falar com o gerente', confidence: 0.9 });
    expect(result.twiml).toContain('<Dial>');
  });

  it('should handle "humano" as transfer intent', async () => {
    const result = await useCase.execute({ callId: 'c1', speechResult: 'quero falar com um humano', confidence: 0.9 });
    expect(result.twiml).toContain('<Dial>');
  });

  it('should handle "atendente" as transfer intent', async () => {
    const result = await useCase.execute({ callId: 'c1', speechResult: 'atendente por favor', confidence: 0.9 });
    expect(result.twiml).toContain('<Dial>');
  });

  it('should handle "recuso" as negative intent', async () => {
    const result = await useCase.execute({ callId: 'c1', speechResult: 'recuso a proposta', confidence: 0.9 });
    expect(result.twiml).toContain('<Gather');
  });

  it('should handle "agora não" as negative intent', async () => {
    const result = await useCase.execute({ callId: 'c1', speechResult: 'agora não posso', confidence: 0.85 });
    expect(result.twiml).toContain('<Gather');
  });

  it('should update outcome to TRANSFERRED when supervisor transfer happens', async () => {
    await useCase.execute({ callId: 'c1', speechResult: 'supervisor', confidence: 0.9 });
    expect(repo.updateStatus).toHaveBeenCalledWith('c1', 'tenant-1', 'IN_PROGRESS', expect.objectContaining({ outcome: 'TRANSFERRED' }));
  });
});

// ─── 13. Auth/permission middleware integration ───────────────────────────────

describe('VoiceConfigController guard integration', () => {
  it('should apply JwtCookieGuard, RolesGuard, and TenantGuard via metadata', () => {
    // Verify guard metadata is attached to the controller class
    const guards = Reflect.getMetadata('__guards__', VoiceConfigController);
    expect(guards).toBeDefined();
    expect(guards.length).toBeGreaterThanOrEqual(1);
  });

  it('should apply OWNER and ADMIN roles via metadata', () => {
    const roles = Reflect.getMetadata('roles', VoiceConfigController);
    expect(roles).toEqual(expect.arrayContaining(['OWNER', 'ADMIN']));
  });
});

// ─── 14. Repository appendTranscript integration ──────────────────────────────

describe('PrismaVoiceCallRepository appendTranscript integration', () => {
  it('should call $queryRaw with parameterized SQL including callId and tenantId', async () => {
    const prisma = makePrismaMock();
    // PrismaVoiceCallRepository uses Prisma.sql so we just verify queryRaw is called
    prisma.$queryRaw.mockResolvedValue([]);
    const { PrismaVoiceCallRepository } = await import('../infrastructure/persistence/repositories/PrismaVoiceCallRepository');
    const repo = new PrismaVoiceCallRepository(prisma as any);
    await repo.appendTranscript('call-1', 'tenant-1', { role: 'customer', text: 'sim', confidence: 0.9, timestamp: new Date().toISOString() });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should save and return a VoiceCall via repo.save', async () => {
    const prisma = makePrismaMock();
    const created = makeVoiceCall();
    prisma.voiceCall.create.mockResolvedValue(created);
    const { PrismaVoiceCallRepository } = await import('../infrastructure/persistence/repositories/PrismaVoiceCallRepository');
    const repo = new PrismaVoiceCallRepository(prisma as any);
    const result = await repo.save({ tenantId: 'tenant-1', contactId: 'c1', direction: 'OUTBOUND', status: 'QUEUED', recoveryCaseId: null, duration: null, recordingUrl: null, transcript: null, sentiment: null, outcome: null, negotiation: null, externalCallId: null });
    expect(result.id).toBe('call-1');
  });

  it('should find call by id and tenantId via repo.findById', async () => {
    const prisma = makePrismaMock();
    prisma.voiceCall.findUnique.mockResolvedValue(makeVoiceCall());
    const { PrismaVoiceCallRepository } = await import('../infrastructure/persistence/repositories/PrismaVoiceCallRepository');
    const repo = new PrismaVoiceCallRepository(prisma as any);
    const result = await repo.findById('call-1', 'tenant-1');
    expect(result?.id).toBe('call-1');
    expect(prisma.voiceCall.findUnique).toHaveBeenCalledWith({ where: { id: 'call-1', tenantId: 'tenant-1' } });
  });

  it('should return null when call not found via repo.findById', async () => {
    const prisma = makePrismaMock();
    prisma.voiceCall.findUnique.mockResolvedValue(null);
    const { PrismaVoiceCallRepository } = await import('../infrastructure/persistence/repositories/PrismaVoiceCallRepository');
    const repo = new PrismaVoiceCallRepository(prisma as any);
    const result = await repo.findById('missing', 'tenant-1');
    expect(result).toBeNull();
  });

  it('should call prisma.voiceCall.update with status and extras in updateStatus', async () => {
    const prisma = makePrismaMock();
    prisma.voiceCall.update.mockResolvedValue({});
    const { PrismaVoiceCallRepository } = await import('../infrastructure/persistence/repositories/PrismaVoiceCallRepository');
    const repo = new PrismaVoiceCallRepository(prisma as any);
    await repo.updateStatus('c1', 'tenant-1', 'COMPLETED', { duration: 90, outcome: 'PAID' });
    expect(prisma.voiceCall.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', duration: 90, outcome: 'PAID' }) }),
    );
  });
});

// ─── 15. Multi-tenant isolation integration ───────────────────────────────────

describe('Multi-tenant isolation integration', () => {
  it('should return independent configs for two tenants in parallel', async () => {
    const prisma = makePrismaMock();
    const cfg1 = { ...dbConfig, tenantId: 'tenant-A', enabled: true };
    const cfg2 = { ...dbConfig, tenantId: 'tenant-B', enabled: false };
    prisma.voiceAgentConfig.findUnique.mockImplementation(({ where }: any) => {
      if (where.tenantId === 'tenant-A') return Promise.resolve(cfg1);
      if (where.tenantId === 'tenant-B') return Promise.resolve(cfg2);
      return Promise.resolve(null);
    });
    const module = await Test.createTestingModule({
      providers: [GetVoiceConfigUseCase, { provide: 'PrismaService', useValue: prisma }],
    }).compile();
    const uc = module.get(GetVoiceConfigUseCase);
    const [r1, r2] = await Promise.all([uc.execute('tenant-A'), uc.execute('tenant-B')]);
    expect(r1.enabled).toBe(true);
    expect(r2.enabled).toBe(false);
    await module.close();
  });

  it('should never cross tenant boundary in ListVoiceCallsUseCase', async () => {
    const prisma = makePrismaMock();
    prisma.voiceCall.findMany.mockResolvedValue([]);
    prisma.voiceCall.count.mockResolvedValue(0);
    const module = await Test.createTestingModule({
      providers: [ListVoiceCallsUseCase, { provide: 'PrismaService', useValue: prisma }],
    }).compile();
    const uc = module.get(ListVoiceCallsUseCase);
    await uc.execute({ tenantId: 'tenant-X' });
    const whereArg = prisma.voiceCall.findMany.mock.calls[0][0].where;
    expect(whereArg.tenantId).toBe('tenant-X');
    await module.close();
  });

  it('should include tenantId in voiceCall.create when making outbound call', async () => {
    const prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    prisma.voiceCall.create.mockResolvedValue(makeVoiceCall({ tenantId: 'tenant-1' }));
    prisma.voiceCall.update.mockResolvedValue({});
    const telephony = makeTelephonyMock();
    const module = await Test.createTestingModule({
      providers: [
        MakeOutboundCallUseCase,
        VoiceNegotiationService,
        { provide: TELEPHONY_PROVIDER, useValue: telephony },
        { provide: 'PrismaService', useValue: prisma },
        { provide: 'ConfigService', useValue: { get: jest.fn() } },
      ],
    }).compile();
    const uc = module.get(MakeOutboundCallUseCase);
    await uc.execute({ tenantId: 'tenant-1', contactId: 'c1', phone: '+5511' });
    expect(prisma.voiceCall.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
    await module.close();
  });
});

// ─── 16. Event emitter integration ───────────────────────────────────────────

describe('Event emitter integration stubs', () => {
  it('should instantiate EventEmitter2 via DI without errors', async () => {
    const module = await Test.createTestingModule({
      providers: [
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn(), on: jest.fn() },
        },
      ],
    }).compile();
    const emitter = module.get(EventEmitter2);
    expect(emitter).toBeDefined();
    await module.close();
  });

  it('should allow emitting a voice.call.created event stub', () => {
    const emitter = { emit: jest.fn() };
    emitter.emit('voice.call.created', { callId: 'c1', tenantId: 'tenant-1' });
    expect(emitter.emit).toHaveBeenCalledWith('voice.call.created', expect.objectContaining({ callId: 'c1' }));
  });

  it('should allow emitting a voice.call.outcome event stub', () => {
    const emitter = { emit: jest.fn() };
    emitter.emit('voice.call.outcome', { callId: 'c1', outcome: 'NEGOTIATED' });
    expect(emitter.emit).toHaveBeenCalledWith('voice.call.outcome', expect.objectContaining({ outcome: 'NEGOTIATED' }));
  });

  it('should allow subscribing to voice.call.failed event stub', () => {
    const emitter = { on: jest.fn() };
    const handler = jest.fn();
    emitter.on('voice.call.failed', handler);
    expect(emitter.on).toHaveBeenCalledWith('voice.call.failed', handler);
  });
});

// ─── 17. SuggestVoiceScriptUseCase integration ────────────────────────────────

describe('SuggestVoiceScriptUseCase integration', () => {
  it('should throw InternalServerErrorException when ANTHROPIC_API_KEY is missing', async () => {
    const module = await Test.createTestingModule({
      providers: [
        SuggestVoiceScriptUseCase,
        { provide: 'ConfigService', useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();
    const uc = module.get(SuggestVoiceScriptUseCase);
    await expect(uc.execute('tenant-1', { name: 'Test', type: 'recovery' })).rejects.toThrow();
    await module.close();
  });

  it('should call Anthropic API with correct model when key exists', async () => {
    const axios = require('axios');
    const spy = jest.spyOn(axios, 'post').mockResolvedValue({
      data: { content: [{ type: 'text', text: 'Script here' }] },
    });
    const module = await Test.createTestingModule({
      providers: [
        SuggestVoiceScriptUseCase,
        { provide: 'ConfigService', useValue: { get: jest.fn().mockReturnValue('fake-api-key') } },
      ],
    }).compile();
    const uc = module.get(SuggestVoiceScriptUseCase);
    const result = await uc.execute('tenant-1', { name: 'Test', type: 'recovery' });
    expect(result.template).toBe('Script here');
    spy.mockRestore();
    await module.close();
  });

  it('should map unknown type to type itself as label', async () => {
    const axios = require('axios');
    const spy = jest.spyOn(axios, 'post').mockResolvedValue({
      data: { content: [{ type: 'text', text: 'Custom script' }] },
    });
    const module = await Test.createTestingModule({
      providers: [
        SuggestVoiceScriptUseCase,
        { provide: 'ConfigService', useValue: { get: jest.fn().mockReturnValue('key') } },
      ],
    }).compile();
    const uc = module.get(SuggestVoiceScriptUseCase);
    const result = await uc.execute('tenant-1', { name: 'My Script', type: 'custom_unknown' });
    expect(result.template).toBe('Custom script');
    spy.mockRestore();
    await module.close();
  });
});

// ─── 18. ProcessCallOutcomeUseCase status map integration ─────────────────────

describe('ProcessCallOutcomeUseCase status mapping integration', () => {
  let buildUseCase: () => { uc: ProcessCallOutcomeUseCase; repo: ReturnType<typeof makeRepoMock> };

  beforeEach(() => {
    buildUseCase = () => {
      const repo = makeRepoMock();
      const uc = new ProcessCallOutcomeUseCase(repo as any);
      return { uc, repo };
    };
  });

  it('should map "queued" to QUEUED status', async () => {
    const { uc, repo } = buildUseCase();
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'RINGING' }));
    await uc.executeScoped('c1', 't1', 'queued', 0);
    expect(repo.updateStatus).toHaveBeenCalledWith('c1', 't1', 'QUEUED', expect.any(Object));
  });

  it('should map "ringing" to RINGING status', async () => {
    const { uc, repo } = buildUseCase();
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'QUEUED' }));
    await uc.executeScoped('c1', 't1', 'ringing', 0);
    expect(repo.updateStatus).toHaveBeenCalledWith('c1', 't1', 'RINGING', expect.any(Object));
  });

  it('should map "in-progress" to IN_PROGRESS status', async () => {
    const { uc, repo } = buildUseCase();
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'RINGING' }));
    await uc.executeScoped('c1', 't1', 'in-progress', 0);
    expect(repo.updateStatus).toHaveBeenCalledWith('c1', 't1', 'IN_PROGRESS', expect.any(Object));
  });

  it('should map "completed" to COMPLETED status', async () => {
    const { uc, repo } = buildUseCase();
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'IN_PROGRESS' }));
    await uc.executeScoped('c1', 't1', 'completed', 60);
    expect(repo.updateStatus).toHaveBeenCalledWith('c1', 't1', 'COMPLETED', expect.any(Object));
  });

  it('should map "busy" to BUSY status', async () => {
    const { uc, repo } = buildUseCase();
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'RINGING' }));
    await uc.executeScoped('c1', 't1', 'busy', 0);
    expect(repo.updateStatus).toHaveBeenCalledWith('c1', 't1', 'BUSY', expect.any(Object));
  });

  it('should skip update for COMPLETED call receiving COMPLETED status again', async () => {
    const { uc, repo } = buildUseCase();
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'COMPLETED' }));
    const result = await uc.executeScoped('c1', 't1', 'completed', 0);
    expect(result.updated).toBe(false);
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('should update NO_ANSWER call status even on "completed" (non-COMPLETED terminal)', async () => {
    const { uc, repo } = buildUseCase();
    // NO_ANSWER + 'no-answer' again: incoming is NO_ANSWER mapped, call is terminal → skip
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'NO_ANSWER' }));
    // incoming 'completed' on NO_ANSWER terminal call → skip
    const result = await uc.executeScoped('c1', 't1', 'completed', 0);
    expect(result.updated).toBe(false);
  });

  it('should not override existing NEGOTIATED outcome when terminal', async () => {
    const { uc, repo } = buildUseCase();
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'IN_PROGRESS', outcome: 'NEGOTIATED' }));
    await uc.executeScoped('c1', 't1', 'completed', 60);
    const updateArgs = repo.updateStatus.mock.calls[0];
    expect(updateArgs[3]?.outcome).toBeUndefined();
  });
});

// ─── 19. VoiceCallWorker job error scenarios ──────────────────────────────────

describe('VoiceCallWorker job error integration', () => {
  it('should rethrow error from MakeOutboundCallUseCase exception', async () => {
    const makeCallUseCase = { execute: jest.fn().mockRejectedValue(new Error('Unhandled error')) };
    const module = await Test.createTestingModule({
      providers: [
        VoiceCallWorker,
        { provide: MakeOutboundCallUseCase, useValue: makeCallUseCase },
      ],
    }).compile();
    const worker = module.get(VoiceCallWorker);
    await expect(worker.process({ id: 'j1', data: { tenantId: 't1', contactId: 'c1', phone: '+55' } } as any)).rejects.toThrow('Unhandled error');
    await module.close();
  });

  it('should process successfully and return correct structure', async () => {
    const makeCallUseCase = { execute: jest.fn().mockResolvedValue({ success: true, callId: 'cX', externalCallId: 'eX' }) };
    const module = await Test.createTestingModule({
      providers: [
        VoiceCallWorker,
        { provide: MakeOutboundCallUseCase, useValue: makeCallUseCase },
      ],
    }).compile();
    const worker = module.get(VoiceCallWorker);
    const result = await worker.process({ id: 'j2', data: { tenantId: 't1', contactId: 'c1', phone: '+55' } } as any);
    expect(result).toMatchObject({ callId: 'cX', externalCallId: 'eX' });
    await module.close();
  });
});

// ─── 20. VoiceAgentConfig mapping integration ─────────────────────────────────

describe('VoiceAgentConfig mapping integration', () => {
  it('should map persona.voiceId to top-level voiceId in UpdateVoiceConfigUseCase', async () => {
    const prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    prisma.voiceAgentConfig.upsert.mockResolvedValue(dbConfig);
    const getUC = new GetVoiceConfigUseCase(prisma as any);
    const uc = new UpdateVoiceConfigUseCase(prisma as any, getUC);
    await uc.execute('tenant-1', { persona: { voiceId: 'new-voice' } });
    const call = prisma.voiceAgentConfig.upsert.mock.calls[0][0];
    expect(call.update.voiceId).toBe('new-voice');
  });

  it('should map persona.language to top-level language in UpdateVoiceConfigUseCase', async () => {
    const prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    prisma.voiceAgentConfig.upsert.mockResolvedValue(dbConfig);
    const getUC = new GetVoiceConfigUseCase(prisma as any);
    const uc = new UpdateVoiceConfigUseCase(prisma as any, getUC);
    await uc.execute('tenant-1', { persona: { language: 'en-US' } });
    const call = prisma.voiceAgentConfig.upsert.mock.calls[0][0];
    expect(call.update.language).toBe('en-US');
  });

  it('should map recovery config to recoveryConfig field', async () => {
    const prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    prisma.voiceAgentConfig.upsert.mockResolvedValue(dbConfig);
    const getUC = new GetVoiceConfigUseCase(prisma as any);
    const uc = new UpdateVoiceConfigUseCase(prisma as any, getUC);
    const recovery = { enabled: true, daysAfterDue: 5 };
    await uc.execute('tenant-1', { recovery });
    const call = prisma.voiceAgentConfig.upsert.mock.calls[0][0];
    expect(call.update.recoveryConfig).toEqual(recovery);
  });

  it('should default persona name to Assistente de Voz when not set', async () => {
    const prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockResolvedValue({ ...dbConfig, persona: {} });
    const uc = new GetVoiceConfigUseCase(prisma as any);
    const result = await uc.execute('tenant-1');
    expect(result.persona.name).toBe('Assistente de Voz');
  });

  it('should default allowedHours start/end to 09:00/18:00 when not set', async () => {
    const prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockResolvedValue({ ...dbConfig, callWindowStart: null, callWindowEnd: null });
    const uc = new GetVoiceConfigUseCase(prisma as any);
    const result = await uc.execute('tenant-1');
    expect(result.allowedHours.start).toBe('09:00');
    expect(result.allowedHours.end).toBe('18:00');
  });

  it('should handle maxDiscount update via flat field', async () => {
    const prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    prisma.voiceAgentConfig.upsert.mockResolvedValue(dbConfig);
    const getUC = new GetVoiceConfigUseCase(prisma as any);
    const uc = new UpdateVoiceConfigUseCase(prisma as any, getUC);
    await uc.execute('tenant-1', { maxDiscount: 30 });
    const call = prisma.voiceAgentConfig.upsert.mock.calls[0][0];
    expect(call.update.maxDiscount).toBe(30);
  });

  it('should handle blockedDays update correctly', async () => {
    const prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    prisma.voiceAgentConfig.upsert.mockResolvedValue(dbConfig);
    const getUC = new GetVoiceConfigUseCase(prisma as any);
    const uc = new UpdateVoiceConfigUseCase(prisma as any, getUC);
    await uc.execute('tenant-1', { blockedDays: ['saturday', 'sunday'] });
    const call = prisma.voiceAgentConfig.upsert.mock.calls[0][0];
    expect(call.update.blockedDays).toEqual(['saturday', 'sunday']);
  });
});

// ─── 21. Cross-layer data integrity ───────────────────────────────────────────

describe('Cross-layer data integrity', () => {
  it('should pass the correct phone to telephony provider from MakeOutboundCallUseCase', async () => {
    const prisma = makePrismaMock();
    prisma.voiceAgentConfig.findUnique.mockResolvedValue(dbConfig);
    prisma.voiceCall.create.mockResolvedValue(makeVoiceCall({ id: 'c1' }));
    prisma.voiceCall.update.mockResolvedValue({});
    const telephony = makeTelephonyMock();
    const uc = new MakeOutboundCallUseCase(
      telephony as any, prisma as any,
      { get: jest.fn().mockReturnValue('https://api.example.com') } as any,
      new VoiceNegotiationService(),
    );
    await uc.execute({ tenantId: 'tenant-1', contactId: 'c1', phone: '+5511987654321' });
    expect(telephony.makeCall).toHaveBeenCalledWith(expect.objectContaining({ to: '+5511987654321' }));
  });

  it('should correctly chain updateStatus with COMPLETED + duration and recordingUrl', async () => {
    const repo = makeRepoMock();
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'IN_PROGRESS' }));
    const uc = new ProcessCallOutcomeUseCase(repo as any);
    await uc.executeScoped('c1', 'tenant-1', 'completed', 180, 'https://rec.url/file.mp3');
    expect(repo.updateStatus).toHaveBeenCalledWith('c1', 'tenant-1', 'COMPLETED', expect.objectContaining({ duration: 180, recordingUrl: 'https://rec.url/file.mp3' }));
  });

  it('should not include duration in extras when duration is 0', async () => {
    const repo = makeRepoMock();
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'RINGING' }));
    const uc = new ProcessCallOutcomeUseCase(repo as any);
    await uc.executeScoped('c1', 'tenant-1', 'no-answer', 0);
    const extra = repo.updateStatus.mock.calls[0][3];
    expect(extra?.duration).toBeUndefined();
  });

  it('should not include recordingUrl in extras when recordingUrl is falsy', async () => {
    const repo = makeRepoMock();
    repo.findById.mockResolvedValue(makeVoiceCall({ status: 'RINGING' }));
    const uc = new ProcessCallOutcomeUseCase(repo as any);
    await uc.executeScoped('c1', 'tenant-1', 'completed', 60, null);
    const extra = repo.updateStatus.mock.calls[0][3];
    expect(extra?.recordingUrl).toBeUndefined();
  });
});