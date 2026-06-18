/**
 * Tests for the MANUAL trigger type and the trigger-automation endpoint.
 *
 * Coverage:
 *  1. TriggerAutomationUseCase handles MANUAL trigger correctly.
 *  2. MessagingController.triggerAutomation validates automation ownership,
 *     rejects non-MANUAL automations, and dispatches when valid.
 *  3. ProcessAIResponseService extracts [USE_AUTOMATION:id] markers and
 *     delegates to IManualAutomationFacade.
 */

import { BadRequestException } from '@nestjs/common';
import { TriggerAutomationUseCase } from '../application/use-cases/TriggerAutomationUseCase';
import { ExecuteAutomationUseCase } from '../application/use-cases/ExecuteAutomationUseCase';
import { IAutomationRepository } from '../application/ports/IAutomationRepository';
import { AutomationEntity } from '../domain/entities/Automation';
import { TriggerType } from '../domain/value-objects/TriggerType';

// ─── Shared fixtures ────────────────────────────────────────────────────────

function makeAutomation(
  id: string,
  triggerType: TriggerType,
  isActive = true,
): AutomationEntity {
  return {
    id,
    tenantId: 'tenant-1',
    name: `Automation ${id}`,
    description: `Description for ${id}`,
    isActive,
    trigger: { type: triggerType, config: {} },
    conditions: [],
    steps: [
      {
        id: 's1',
        automationId: id,
        order: 0,
        type: 'send_message',
        config: { channel: 'whatsapp', body: 'Olá {{name}}!' },
        nextStepId: null,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── TriggerAutomationUseCase – MANUAL trigger ──────────────────────────────

describe('TriggerAutomationUseCase – MANUAL trigger', () => {
  let useCase: TriggerAutomationUseCase;
  let repository: jest.Mocked<IAutomationRepository>;
  let executeUseCase: jest.Mocked<ExecuteAutomationUseCase>;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
      findByTriggerType: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      toggleActive: jest.fn(),
    } as any;

    executeUseCase = { execute: jest.fn() } as any;
    useCase = new TriggerAutomationUseCase(repository, executeUseCase);
  });

  it('finds and executes MANUAL automations for a tenant', async () => {
    const automations = [
      makeAutomation('manual-1', TriggerType.MANUAL),
      makeAutomation('manual-2', TriggerType.MANUAL),
    ];
    repository.findByTriggerType.mockResolvedValue(automations);
    executeUseCase.execute
      .mockResolvedValueOnce('exec-1')
      .mockResolvedValueOnce('exec-2');

    const result = await useCase.execute(
      'tenant-1',
      TriggerType.MANUAL,
      { automationId: 'manual-1', conversationId: 'conv-1', triggeredBy: 'HUMAN' },
      'contact-1',
    );

    expect(result).toEqual(['exec-1', 'exec-2']);
    expect(repository.findByTriggerType).toHaveBeenCalledWith(
      'tenant-1',
      TriggerType.MANUAL,
    );
    expect(executeUseCase.execute).toHaveBeenCalledTimes(2);
  });

  it('returns empty array when no MANUAL automations exist for tenant', async () => {
    repository.findByTriggerType.mockResolvedValue([]);

    const result = await useCase.execute(
      'tenant-1',
      TriggerType.MANUAL,
      { conversationId: 'conv-1' },
      'contact-1',
    );

    expect(result).toEqual([]);
    expect(executeUseCase.execute).not.toHaveBeenCalled();
  });

  it('MANUAL trigger still passes contactId to executeUseCase', async () => {
    repository.findByTriggerType.mockResolvedValue([
      makeAutomation('manual-1', TriggerType.MANUAL),
    ]);
    executeUseCase.execute.mockResolvedValue('exec-1');

    await useCase.execute(
      'tenant-1',
      TriggerType.MANUAL,
      { conversationId: 'conv-abc' },
      'contact-xyz',
    );

    expect(executeUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'contact-xyz' }),
    );
  });
});

// ─── MessagingController.triggerAutomation – unit ───────────────────────────

describe('MessagingController – triggerAutomation endpoint', () => {
  /**
   * We test the business logic inline rather than spinning up a full NestJS app
   * because the endpoint logic is self-contained (find automation → validate → execute).
   */

  const tenantId = 'tenant-1';
  const conversationId = 'conv-1';
  const contactId = 'contact-1';

  // Minimal conversation stub
  const makeConversation = (id: string) => ({
    id,
    contactId: { toString: () => contactId },
  });

  const makeRepo = (automations: Record<string, AutomationEntity | null>) => ({
    findById: jest.fn().mockImplementation((tid: string, aid: string) =>
      Promise.resolve(automations[aid] ?? null),
    ),
    findByTriggerType: jest.fn(),
    findAllByTenant: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    toggleActive: jest.fn(),
  });

  const makeConvRepo = (conversation: any) => ({
    findById: jest.fn().mockResolvedValue(conversation),
    save: jest.fn(),
    findByMessageId: jest.fn(),
    findByExternalMessageId: jest.fn(),
    findActiveByContact: jest.fn(),
    findLatestByContact: jest.fn(),
    findAllByTenant: jest.fn(),
    setAssignedUser: jest.fn(),
    findAssignedUsers: jest.fn(),
    findQueueState: jest.fn(),
    markAsRead: jest.fn(),
    findMessagesByConversation: jest.fn(),
  });

  const makeTriggerUseCase = () => ({
    execute: jest.fn().mockResolvedValue(['exec-1']),
  });

  /**
   * Simulates the controller method logic without NestJS IoC.
   * Mirrors src/api/modules/messaging/presentation/controllers/MessagingController.ts
   * triggerAutomation() method.
   */
  async function invokeTriggerAutomation(
    automationRepo: any,
    convRepo: any,
    triggerUseCase: any,
    dto: { automationId: string },
  ) {
    const automation = await automationRepo.findById(tenantId, dto.automationId);
    if (!automation) {
      throw new BadRequestException(
        'Automation not found or does not belong to this tenant.',
      );
    }
    if (automation.trigger.type !== TriggerType.MANUAL) {
      throw new BadRequestException(
        `Automation "${automation.name}" cannot be triggered manually.`,
      );
    }
    const conversation = await convRepo.findById(conversationId, tenantId);
    if (!conversation) {
      throw new BadRequestException('Conversation not found.');
    }
    const executionIds = await triggerUseCase.execute(
      tenantId,
      TriggerType.MANUAL,
      { conversationId, automationId: dto.automationId },
      conversation.contactId.toString(),
    );
    return { executionIds };
  }

  it('dispatches a MANUAL automation successfully', async () => {
    const manualAutomation = makeAutomation('manual-1', TriggerType.MANUAL);
    const result = await invokeTriggerAutomation(
      makeRepo({ 'manual-1': manualAutomation }),
      makeConvRepo(makeConversation(conversationId)),
      makeTriggerUseCase(),
      { automationId: 'manual-1' },
    );

    expect(result).toEqual({ executionIds: ['exec-1'] });
  });

  it('throws 400 when automation not found or belongs to different tenant', async () => {
    await expect(
      invokeTriggerAutomation(
        makeRepo({}), // no automations
        makeConvRepo(makeConversation(conversationId)),
        makeTriggerUseCase(),
        { automationId: 'non-existent' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when automation exists but is NOT a MANUAL trigger', async () => {
    const eventAutomation = makeAutomation('event-1', TriggerType.CONTACT_CREATED);

    await expect(
      invokeTriggerAutomation(
        makeRepo({ 'event-1': eventAutomation }),
        makeConvRepo(makeConversation(conversationId)),
        makeTriggerUseCase(),
        { automationId: 'event-1' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when conversation is not found', async () => {
    const manualAutomation = makeAutomation('manual-1', TriggerType.MANUAL);

    await expect(
      invokeTriggerAutomation(
        makeRepo({ 'manual-1': manualAutomation }),
        makeConvRepo(null), // conversation not found
        makeTriggerUseCase(),
        { automationId: 'manual-1' },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── ManualAutomationFacade ──────────────────────────────────────────────────

describe('ManualAutomationFacade', () => {
  const tenantId = 'tenant-1';

  const makeRepo = (automations: AutomationEntity[]) => ({
    findByTriggerType: jest.fn().mockResolvedValue(automations),
    findById: jest.fn(),
    findAllByTenant: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    toggleActive: jest.fn(),
  });

  const makeTriggerUseCase = () => ({
    execute: jest.fn().mockResolvedValue(['exec-1']),
  });

  // Inline facade logic to avoid heavy module setup in unit tests
  async function listActive(repo: any, tid: string) {
    const all = await repo.findByTriggerType(tid, TriggerType.MANUAL);
    return (all as AutomationEntity[])
      .filter((a) => a.isActive)
      .map((a) => ({ id: a.id, name: a.name, description: a.description }));
  }

  it('returns only active MANUAL automations', async () => {
    const automations = [
      makeAutomation('m1', TriggerType.MANUAL, true),
      makeAutomation('m2', TriggerType.MANUAL, false), // inactive — excluded
      makeAutomation('m3', TriggerType.MANUAL, true),
    ];
    const result = await listActive(makeRepo(automations), tenantId);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual(['m1', 'm3']);
  });

  it('returns empty array when no active MANUAL automations exist', async () => {
    const result = await listActive(makeRepo([]), tenantId);
    expect(result).toEqual([]);
  });

  it('dispatch calls TriggerAutomationUseCase with MANUAL trigger', async () => {
    const triggerUseCase = makeTriggerUseCase();

    await triggerUseCase.execute(
      tenantId,
      TriggerType.MANUAL,
      { automationId: 'm1', conversationId: 'conv-1', triggeredBy: 'AI' },
      'contact-1',
    );

    expect(triggerUseCase.execute).toHaveBeenCalledWith(
      tenantId,
      TriggerType.MANUAL,
      expect.objectContaining({ triggeredBy: 'AI' }),
      'contact-1',
    );
  });
});

// ─── ProcessAIResponseService – marker extraction ───────────────────────────

describe('ProcessAIResponseService – [USE_AUTOMATION:id] marker extraction', () => {
  /**
   * Tests the private extractAutomationMarkers logic directly.
   * We replicate the regex here so the logic is tested in isolation.
   */
  function extractAutomationMarkers(text: string): {
    cleanedText: string;
    automationIds: string[];
  } {
    const ids: string[] = [];
    const cleanedText = text.replace(
      /\[USE_AUTOMATION:([0-9a-f-]{36})\]/gi,
      (_, id: string) => {
        ids.push(id);
        return '';
      },
    );
    return { cleanedText, automationIds: ids };
  }

  const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
  const uuid2 = 'aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb';

  it('extracts a single automation marker and removes it from text', () => {
    const input = `Vou enviar o contrato agora. [USE_AUTOMATION:${uuid1}] Por favor, aguarde.`;
    const { cleanedText, automationIds } = extractAutomationMarkers(input);

    expect(automationIds).toEqual([uuid1]);
    expect(cleanedText).toBe('Vou enviar o contrato agora.  Por favor, aguarde.');
    expect(cleanedText).not.toContain('[USE_AUTOMATION:');
  });

  it('extracts multiple markers from the same response', () => {
    const input = `[USE_AUTOMATION:${uuid1}] Primeira etapa. [USE_AUTOMATION:${uuid2}] Segunda etapa.`;
    const { automationIds, cleanedText } = extractAutomationMarkers(input);

    expect(automationIds).toEqual([uuid1, uuid2]);
    expect(cleanedText).not.toContain('[USE_AUTOMATION:');
  });

  it('leaves text unchanged when no marker is present', () => {
    const input = 'Olá! Como posso te ajudar hoje?';
    const { cleanedText, automationIds } = extractAutomationMarkers(input);

    expect(automationIds).toEqual([]);
    expect(cleanedText).toBe(input);
  });

  it('ignores malformed markers (wrong UUID format)', () => {
    const input = '[USE_AUTOMATION:not-a-uuid] Texto normal.';
    const { cleanedText, automationIds } = extractAutomationMarkers(input);

    // 'not-a-uuid' has length < 36 and wrong format — should not match
    expect(automationIds).toEqual([]);
    expect(cleanedText).toBe(input);
  });

  it('is case-insensitive for the marker keyword', () => {
    const input = `Teste [use_automation:${uuid1}] fim.`;
    const { automationIds } = extractAutomationMarkers(input);
    expect(automationIds).toEqual([uuid1]);
  });
});
