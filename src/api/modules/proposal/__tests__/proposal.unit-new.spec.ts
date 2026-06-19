// ============================================================
// proposal.unit-new.spec.ts
// NEW unit tests — gaps NOT covered by existing test files
// ============================================================
import { Proposal } from '../domain/entities/Proposal';
import { ProposalItem } from '../domain/value-objects/ProposalItem';
import { ProposalTitle } from '../domain/value-objects/ProposalTitle';
import { ProposalTitleTooShortError } from '../domain/errors/ProposalTitleTooShortError';
import { ProposalItemNameRequiredError } from '../domain/errors/ProposalItemNameRequiredError';
import { ProposalItemQuantityInvalidError } from '../domain/errors/ProposalItemQuantityInvalidError';
import { ProposalItemUnitPriceInvalidError } from '../domain/errors/ProposalItemUnitPriceInvalidError';
import { ProposalNotFoundError } from '../domain/errors/ProposalNotFoundError';
import { ProposalInvalidScheduleDateError } from '../domain/errors/ProposalInvalidScheduleDateError';
import { ProposalEmptyItemsError } from '../domain/errors/ProposalEmptyItemsError';
import { UpdateProposalUseCase } from '../application/use-cases/UpdateProposalUseCase';
import { UpdateProposalService } from '../application/services/implementations/UpdateProposalService';
import { DeleteProposalUseCase } from '../application/use-cases/DeleteProposalUseCase';
import { DeleteProposalService } from '../application/services/implementations/DeleteProposalService';
import { GetProposalUseCase } from '../application/use-cases/GetProposalUseCase';
import { GetProposalService } from '../application/services/implementations/GetProposalService';
import { GenerateProposalPdfUseCase } from '../application/use-cases/GenerateProposalPdfUseCase';
import { ScheduleProposalDeliveryUseCase } from '../application/use-cases/ScheduleProposalDeliveryUseCase';
import { ScheduleProposalDeliveryService } from '../application/services/implementations/ScheduleProposalDeliveryService';
import { SendProposalToConversationService } from '../application/services/implementations/SendProposalToConversationService';
import { SendProposalToConversationUseCase } from '../application/use-cases/SendProposalToConversationUseCase';
import { PublicProposalService } from '../application/services/implementations/PublicProposalService';
import { ProposalPublicLinkService } from '../application/services/implementations/ProposalPublicLinkService';
import { ProposalAsyncJobProcessor } from '../infrastructure/queue/ProposalAsyncJobProcessor';
import {
  normalizeProposalMetadata,
  resolveProposalFinalAmount,
  buildProposalPublicToken,
  verifyProposalPublicToken,
} from '../application/support/proposal-public-access';
import {
  buildProposal,
  buildProposalItem,
  createProposalRepositoryMock,
  createFileStorageMock,
  createMessagingFacadeMock,
  createQueueMock,
  InMemoryProposalRepository,
} from './proposal-test-utils';

// ─────────────────────────────────────────────────────────────
// 1. ProposalItem value-object — boundary & arithmetic (gaps #1, #7, #8)
// ─────────────────────────────────────────────────────────────
describe('ProposalItem — boundary conditions', () => {
  it('throws ProposalItemQuantityInvalidError when quantity is exactly 0', () => {
    expect(() =>
      ProposalItem.create({ name: 'Item', quantity: 0, unitPrice: 100 }),
    ).toThrow(ProposalItemQuantityInvalidError);
  });

  it('throws ProposalItemQuantityInvalidError when quantity is -1', () => {
    expect(() =>
      ProposalItem.create({ name: 'Item', quantity: -1, unitPrice: 100 }),
    ).toThrow(ProposalItemQuantityInvalidError);
  });

  it('throws ProposalItemQuantityInvalidError when quantity is a large negative number', () => {
    expect(() =>
      ProposalItem.create({ name: 'Item', quantity: -999, unitPrice: 100 }),
    ).toThrow(ProposalItemQuantityInvalidError);
  });

  it('accepts unitPrice = 0 and computes subtotal as 0 (zero-price is intentionally allowed)', () => {
    const item = ProposalItem.create({ name: 'Free Item', quantity: 2, unitPrice: 0 });
    expect(item.unitPrice).toBe(0);
    expect(item.subtotal).toBe(0);
  });

  it('totalAmount on a proposal with a zero-price item equals the sum of the other items', () => {
    const proposal = buildProposal({
      items: [
        buildProposalItem({ name: 'Paid', quantity: 1, unitPrice: 500 }),
        buildProposalItem({ name: 'Free', quantity: 1, unitPrice: 0 }),
      ],
    });
    expect(proposal.totalAmount).toBe(500);
  });

  it('throws ProposalItemUnitPriceInvalidError when unitPrice is -0.01', () => {
    expect(() =>
      ProposalItem.create({ name: 'Item', quantity: 1, unitPrice: -0.01 }),
    ).toThrow(ProposalItemUnitPriceInvalidError);
  });

  it('throws ProposalItemUnitPriceInvalidError when unitPrice is a large negative number', () => {
    expect(() =>
      ProposalItem.create({ name: 'Item', quantity: 1, unitPrice: -1000 }),
    ).toThrow(ProposalItemUnitPriceInvalidError);
  });

  it('computes subtotal with floating-point unitPrice without producing Infinity or NaN', () => {
    const item = ProposalItem.create({ name: 'Float item', quantity: 3, unitPrice: 1.999 });
    expect(Number.isFinite(item.subtotal)).toBe(true);
    expect(item.subtotal).toBeCloseTo(5.997, 5);
  });

  it('computes subtotal correctly with 0.1 * 3 floating-point arithmetic', () => {
    const item = ProposalItem.create({ name: 'Precision', quantity: 3, unitPrice: 0.1 });
    expect(Number.isFinite(item.subtotal)).toBe(true);
    expect(item.subtotal).toBeGreaterThan(0.29);
    expect(item.subtotal).toBeLessThan(0.31);
  });

  it('trims whitespace from item name on creation', () => {
    const item = ProposalItem.create({ name: '  Trimmed  ', quantity: 1, unitPrice: 10 });
    expect(item.name).toBe('Trimmed');
  });

  it('throws ProposalItemNameRequiredError for a name that is only whitespace', () => {
    expect(() =>
      ProposalItem.create({ name: '   ', quantity: 1, unitPrice: 10 }),
    ).toThrow(ProposalItemNameRequiredError);
  });

  it('accepts quantity = 1 as the minimum valid positive integer', () => {
    const item = ProposalItem.create({ name: 'Min', quantity: 1, unitPrice: 50 });
    expect(item.quantity).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. ProposalTitle value-object — trim boundary (gap #4)
// ─────────────────────────────────────────────────────────────
describe('ProposalTitle — trim and length boundary', () => {
  it('throws ProposalTitleTooShortError for a 2-char title with no spaces', () => {
    expect(() => ProposalTitle.create('Ab')).toThrow(ProposalTitleTooShortError);
  });

  it('throws ProposalTitleTooShortError for title that is 3 chars including surrounding spaces (only 1 real char)', () => {
    expect(() => ProposalTitle.create(' a ')).toThrow(ProposalTitleTooShortError);
  });

  it('throws ProposalTitleTooShortError for a title of exactly 3 spaces (trims to empty)', () => {
    expect(() => ProposalTitle.create('   ')).toThrow(ProposalTitleTooShortError);
  });

  it('throws ProposalTitleTooShortError for a title of 2 non-space chars surrounded by spaces', () => {
    expect(() => ProposalTitle.create('  ab  ')).toThrow(ProposalTitleTooShortError);
  });

  it('accepts a title of exactly 3 non-space chars after trimming', () => {
    const title = ProposalTitle.create('  abc  ');
    expect(title.value).toBe('abc');
  });

  it('stores the trimmed value in the value property', () => {
    const title = ProposalTitle.create('  Proposta Comercial  ');
    expect(title.value).toBe('Proposta Comercial');
  });

  it('accepts a single word of 3 chars exactly', () => {
    const title = ProposalTitle.create('abc');
    expect(title.value).toBe('abc');
  });

  it('throws for an empty string', () => {
    expect(() => ProposalTitle.create('')).toThrow(ProposalTitleTooShortError);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Proposal entity — status transitions and markAsScheduled (gaps #2, #3, #5)
// ─────────────────────────────────────────────────────────────
describe('Proposal entity — status transitions', () => {
  it('updateStatus accepts any ProposalStatus value without guard (documents current behaviour)', () => {
    const proposal = buildProposal({ status: 'ACCEPTED' });
    // No guard exists today — this call succeeds. If a guard is added, this test will catch it.
    proposal.updateStatus('DRAFT');
    expect(proposal.status).toBe('DRAFT');
  });

  it('updateStatus can move from REJECTED to SENT without throwing (no state-machine guard)', () => {
    const proposal = buildProposal({ status: 'REJECTED' });
    proposal.updateStatus('SENT');
    expect(proposal.status).toBe('SENT');
  });

  it('updateStatus can move from ACCEPTED to REJECTED without throwing (documents missing guard)', () => {
    const proposal = buildProposal({ status: 'ACCEPTED' });
    proposal.updateStatus('REJECTED');
    expect(proposal.status).toBe('REJECTED');
  });

  it('markAsScheduled with a past date silently sets status=SCHEDULED (no entity-level date guard)', () => {
    const proposal = buildProposal();
    const pastDate = new Date(Date.now() - 60_000);
    // Entity has no date guard — the service layer is responsible for validation.
    // This test documents that the entity accepts a past date.
    proposal.markAsScheduled(pastDate);
    expect(proposal.status).toBe('SCHEDULED');
    expect(proposal.scheduledAt).toBe(pastDate);
  });

  it('markAsScheduled with a future date sets status and scheduledAt correctly', () => {
    const proposal = buildProposal();
    const futureDate = new Date(Date.now() + 3_600_000);
    proposal.markAsScheduled(futureDate);
    expect(proposal.status).toBe('SCHEDULED');
    expect(proposal.scheduledAt).toEqual(futureDate);
  });

  it('markAsScheduled throws ProposalEmptyItemsError when items array is empty', () => {
    const proposal = buildProposal({ items: [] });
    expect(() => proposal.markAsScheduled(new Date(Date.now() + 60_000))).toThrow(
      ProposalEmptyItemsError,
    );
  });

  it('a proposal with validUntil in the past can still be scheduled at entity level (no expiry guard)', () => {
    const proposal = buildProposal({
      validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    // Documents that the entity does NOT check validUntil expiry.
    expect(() =>
      proposal.markAsScheduled(new Date(Date.now() + 60_000)),
    ).not.toThrow();
    expect(proposal.status).toBe('SCHEDULED');
  });

  it('a proposal with validUntil in the past can have its status changed to SENT at entity level', () => {
    const proposal = buildProposal({
      validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    proposal.updateStatus('SENT');
    expect(proposal.status).toBe('SENT');
  });

  it('a proposal with validUntil in the past can be updateStatus to ACCEPTED at entity level', () => {
    const proposal = buildProposal({
      validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    proposal.updateStatus('ACCEPTED');
    expect(proposal.status).toBe('ACCEPTED');
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Proposal.toJSON — serialisation (gap #6)
// ─────────────────────────────────────────────────────────────
describe('Proposal.toJSON — serialisation contract', () => {
  it('serialises items as plain objects when items are ProposalItem value-objects', () => {
    const proposal = buildProposal();
    const json = proposal.toJSON();
    expect(Array.isArray(json.items)).toBe(true);
    json.items.forEach((item: any) => {
      expect(typeof item).toBe('object');
      expect(item).not.toBeNull();
    });
  });

  it('serialises title as a string, not a ProposalTitle object', () => {
    const proposal = buildProposal();
    const json = proposal.toJSON();
    expect(typeof json.title).toBe('string');
  });

  it('falls back to the raw item object when item.props is undefined (plain object items)', () => {
    const proposal = buildProposal();
    // Simulate a plain-object item (after repository round-trip via mapper)
    const plainItem = { name: 'Plain', quantity: 1, unitPrice: 100, subtotal: 100 };
    (proposal as any)._props.items = [plainItem as any];
    const json = proposal.toJSON();
    expect(json.items[0]).toBe(plainItem);
  });

  it('includes totalAmount in the JSON output', () => {
    const proposal = buildProposal();
    const json = proposal.toJSON();
    expect(typeof json.totalAmount).toBe('number');
    expect(json.totalAmount).toBeGreaterThan(0);
  });

  it('includes all core props in the JSON output', () => {
    const proposal = buildProposal();
    const json = proposal.toJSON();
    expect(json).toHaveProperty('id');
    expect(json).toHaveProperty('tenantId');
    expect(json).toHaveProperty('contactId');
    expect(json).toHaveProperty('status');
  });
});

// ─────────────────────────────────────────────────────────────
// 5. UpdateProposalUseCase — cross-tenant and invalid items (gaps #9, #10)
// ─────────────────────────────────────────────────────────────
describe('UpdateProposalUseCase — cross-tenant and domain validation', () => {
  let useCase: UpdateProposalUseCase;
  let mockRepo: ReturnType<typeof createProposalRepositoryMock>;

  beforeEach(() => {
    mockRepo = createProposalRepositoryMock();
    const service = new UpdateProposalService(mockRepo as any);
    useCase = new UpdateProposalUseCase(service);
  });

  it('throws ProposalNotFoundError when proposal belongs to a different tenant', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute('proposal-123', { title: 'New Title' }, 'wrong-tenant'),
    ).rejects.toBeInstanceOf(ProposalNotFoundError);
  });

  it('does not call repository.update when proposal is not found for the given tenant', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await useCase.execute('proposal-123', {}, 'wrong-tenant').catch(() => {});
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('throws ProposalItemQuantityInvalidError when update items contain quantity = 0', async () => {
    const proposal = buildProposal();
    mockRepo.findById.mockResolvedValue(proposal);
    await expect(
      useCase.execute(proposal.id, { items: [{ name: 'Bad', quantity: 0, unitPrice: 10 }] }, 'tenant-123'),
    ).rejects.toThrow(ProposalItemQuantityInvalidError);
  });

  it('does not persist the proposal when domain validation fails mid-update for invalid items', async () => {
    const proposal = buildProposal();
    mockRepo.findById.mockResolvedValue(proposal);
    await useCase
      .execute(proposal.id, { items: [{ name: 'Bad', quantity: -1, unitPrice: 10 }] }, 'tenant-123')
      .catch(() => {});
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('throws ProposalItemNameRequiredError when update items contain empty name', async () => {
    const proposal = buildProposal();
    mockRepo.findById.mockResolvedValue(proposal);
    await expect(
      useCase.execute(proposal.id, { items: [{ name: '', quantity: 1, unitPrice: 10 }] }, 'tenant-123'),
    ).rejects.toThrow(ProposalItemNameRequiredError);
  });

  it('throws ProposalItemUnitPriceInvalidError when update items contain negative unitPrice', async () => {
    const proposal = buildProposal();
    mockRepo.findById.mockResolvedValue(proposal);
    await expect(
      useCase.execute(proposal.id, { items: [{ name: 'Item', quantity: 1, unitPrice: -5 }] }, 'tenant-123'),
    ).rejects.toThrow(ProposalItemUnitPriceInvalidError);
  });

  it('successfully updates a proposal belonging to the correct tenant', async () => {
    const proposal = buildProposal();
    mockRepo.findById.mockResolvedValue(proposal);
    mockRepo.update.mockResolvedValue(undefined);
    const result = await useCase.execute(proposal.id, { title: 'Updated Title' }, 'tenant-123');
    expect(result.id).toBe(proposal.id);
    expect(mockRepo.update).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────
// 6. DeleteProposalUseCase — cross-tenant (gap #11)
// ─────────────────────────────────────────────────────────────
describe('DeleteProposalUseCase — cross-tenant isolation', () => {
  let useCase: DeleteProposalUseCase;
  let mockRepo: ReturnType<typeof createProposalRepositoryMock>;

  beforeEach(() => {
    mockRepo = createProposalRepositoryMock();
    const service = new DeleteProposalService(mockRepo as any);
    useCase = new DeleteProposalUseCase(service);
  });

  it('throws ProposalNotFoundError when tenantId does not match (findById returns null)', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute('proposal-123', 'wrong-tenant'),
    ).rejects.toBeInstanceOf(ProposalNotFoundError);
  });

  it('does not call repository.delete when the proposal is not found for the tenant', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await useCase.execute('proposal-123', 'wrong-tenant').catch(() => {});
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('calls delete with the correct id when the tenant matches', async () => {
    const proposal = buildProposal({ id: 'prop-to-delete', tenantId: 'tenant-123' });
    mockRepo.findById.mockResolvedValue(proposal);
    mockRepo.delete.mockResolvedValue(undefined);
    await useCase.execute('prop-to-delete', 'tenant-123');
    expect(mockRepo.delete).toHaveBeenCalledWith('prop-to-delete');
  });
});

// ─────────────────────────────────────────────────────────────
// 7. GetProposalUseCase — cross-tenant (gap #12)
// ─────────────────────────────────────────────────────────────
describe('GetProposalUseCase — cross-tenant isolation', () => {
  let useCase: GetProposalUseCase;
  let mockRepo: ReturnType<typeof createProposalRepositoryMock>;

  beforeEach(() => {
    mockRepo = createProposalRepositoryMock();
    const service = new GetProposalService(mockRepo as any);
    useCase = new GetProposalUseCase(service);
  });

  it('throws ProposalNotFoundError when tenantId does not match', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute('proposal-123', 'wrong-tenant'),
    ).rejects.toBeInstanceOf(ProposalNotFoundError);
  });

  it('passes tenantId to repository.findById', async () => {
    const proposal = buildProposal({ tenantId: 'tenant-abc' });
    mockRepo.findById.mockResolvedValue(proposal);
    await useCase.execute(proposal.id, 'tenant-abc');
    expect(mockRepo.findById).toHaveBeenCalledWith(proposal.id, 'tenant-abc');
  });

  it('returns serialised proposal JSON when found with the correct tenant', async () => {
    const proposal = buildProposal({ tenantId: 'tenant-abc' });
    mockRepo.findById.mockResolvedValue(proposal);
    const result = await useCase.execute(proposal.id, 'tenant-abc');
    expect(result.id).toBe(proposal.id);
    expect(result.tenantId).toBe('tenant-abc');
  });
});

// ─────────────────────────────────────────────────────────────
// 8. GenerateProposalPdfUseCase — storage failure & cross-tenant (gaps #13, #14)
// ─────────────────────────────────────────────────────────────
describe('GenerateProposalPdfUseCase — error paths', () => {
  let mockRepo: ReturnType<typeof createProposalRepositoryMock>;
  let mockStorage: ReturnType<typeof createFileStorageMock>;
  let useCase: GenerateProposalPdfUseCase;

  beforeEach(() => {
    mockRepo = createProposalRepositoryMock();
    mockStorage = createFileStorageMock();
    useCase = new GenerateProposalPdfUseCase(mockRepo as any, mockStorage);
  });

  it('throws the storage error when storageService.upload rejects', async () => {
    const proposal = buildProposal();
    mockRepo.findById.mockResolvedValue(proposal);
    mockStorage.upload.mockRejectedValue(new Error('S3 connection refused'));
    await expect(useCase.execute(proposal.id, proposal.tenantId)).rejects.toThrow(
      'S3 connection refused',
    );
  });

  it('does NOT call repository.update when storage upload fails', async () => {
    const proposal = buildProposal();
    mockRepo.findById.mockResolvedValue(proposal);
    mockStorage.upload.mockRejectedValue(new Error('upload error'));
    await useCase.execute(proposal.id, proposal.tenantId).catch(() => {});
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('leaves proposal pdfUrl unchanged when storage upload fails', async () => {
    const proposal = buildProposal({ pdfUrl: null });
    mockRepo.findById.mockResolvedValue(proposal);
    mockStorage.upload.mockRejectedValue(new Error('upload error'));
    await useCase.execute(proposal.id, proposal.tenantId).catch(() => {});
    expect(proposal.pdfUrl).toBeNull();
  });

  it('throws ProposalNotFoundError for wrong tenantId (cross-tenant access)', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute('proposal-123', 'wrong-tenant'),
    ).rejects.toBeInstanceOf(ProposalNotFoundError);
  });

  it('passes both proposalId and tenantId to repository.findById', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await useCase.execute('p-id', 't-id').catch(() => {});
    expect(mockRepo.findById).toHaveBeenCalledWith('p-id', 't-id');
  });

  it('sets pdfUrl on the proposal and persists it on successful upload', async () => {
    const proposal = buildProposal({ pdfUrl: null });
    mockRepo.findById.mockResolvedValue(proposal);
    mockStorage.upload.mockResolvedValue('https://cdn.test/ok.pdf');
    mockRepo.update.mockResolvedValue(undefined);
    await useCase.execute(proposal.id, proposal.tenantId);
    expect(proposal.pdfUrl).toBe('https://cdn.test/ok.pdf');
    expect(mockRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ pdfUrl: 'https://cdn.test/ok.pdf' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// 9. ScheduleProposalDeliveryUseCase — double-schedule & queue failure (gaps #15, #16)
// ─────────────────────────────────────────────────────────────
describe('ScheduleProposalDeliveryUseCase — edge cases', () => {
  let mockRepo: ReturnType<typeof createProposalRepositoryMock>;
  let mockQueue: ReturnType<typeof createQueueMock>;
  let useCase: ScheduleProposalDeliveryUseCase;

  beforeEach(() => {
    mockRepo = createProposalRepositoryMock();
    mockQueue = createQueueMock();
    const service = new ScheduleProposalDeliveryService(mockRepo as any, mockQueue as any);
    useCase = new ScheduleProposalDeliveryUseCase(service);
  });

  it('throws ProposalInvalidScheduleDateError for a scheduledAt exactly equal to now (not strictly future)', async () => {
    const proposal = buildProposal();
    mockRepo.findById.mockResolvedValue(proposal);
    const now = new Date();
    // Align to a moment that is <= new Date() inside the service
    const almostNow = new Date(now.getTime() - 1);
    await expect(
      useCase.execute({ proposalId: proposal.id, scheduledAt: almostNow, tenantId: 'tenant-123' }),
    ).rejects.toBeInstanceOf(ProposalInvalidScheduleDateError);
  });

  it('throws ProposalNotFoundError when tenantId does not match (cross-tenant schedule)', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        proposalId: 'proposal-123',
        scheduledAt: new Date(Date.now() + 3_600_000),
        tenantId: 'wrong-tenant',
      }),
    ).rejects.toBeInstanceOf(ProposalNotFoundError);
  });

  it('passes tenantId to repository.findById on schedule', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await useCase
      .execute({ proposalId: 'p', scheduledAt: new Date(Date.now() + 3_600_000), tenantId: 't-id' })
      .catch(() => {});
    expect(mockRepo.findById).toHaveBeenCalledWith('p', 't-id');
  });

  it('propagates queue.add failure and leaves proposal as SCHEDULED in the repository', async () => {
    const proposal = buildProposal();
    mockRepo.findById.mockResolvedValue(proposal);
    mockRepo.update.mockResolvedValue(undefined);
    mockQueue.add.mockRejectedValue(new Error('BullMQ connection refused'));

    await expect(
      useCase.execute({
        proposalId: proposal.id,
        scheduledAt: new Date(Date.now() + 3_600_000),
        tenantId: 'tenant-123',
      }),
    ).rejects.toThrow('BullMQ connection refused');

    // proposal was already persisted as SCHEDULED before the queue threw
    expect(mockRepo.update).toHaveBeenCalled();
    expect(proposal.status).toBe('SCHEDULED');
  });

  it('allows scheduling an already-SCHEDULED proposal (no double-schedule guard at use-case level)', async () => {
    const proposal = buildProposal({ status: 'SCHEDULED' });
    mockRepo.findById.mockResolvedValue(proposal);
    mockRepo.update.mockResolvedValue(undefined);
    const futureDate = new Date(Date.now() + 3_600_000);
    await useCase.execute({ proposalId: proposal.id, scheduledAt: futureDate, tenantId: 'tenant-123' });
    expect(proposal.status).toBe('SCHEDULED');
    expect(mockRepo.update).toHaveBeenCalled();
  });

  it('enqueues job with both proposalId and tenantId in the payload', async () => {
    const proposal = buildProposal({ tenantId: 'tenant-q' });
    mockRepo.findById.mockResolvedValue(proposal);
    mockRepo.update.mockResolvedValue(undefined);
    await useCase.execute({
      proposalId: proposal.id,
      scheduledAt: new Date(Date.now() + 3_600_000),
      tenantId: 'tenant-q',
    });
    expect(mockQueue.add).toHaveBeenCalledWith(
      'send-proposal',
      { proposalId: proposal.id, tenantId: 'tenant-q' },
      expect.any(Object),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// 10. SendProposalToConversationService — cross-tenant & facade failure (gaps #17, #18)
// ─────────────────────────────────────────────────────────────
describe('SendProposalToConversationService — error paths', () => {
  const configService = {
    get: (key: string) => {
      if (key === 'APP_PUBLIC_BASE_URL') return 'https://app.test';
      if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
      return undefined;
    },
  };

  it('throws ProposalNotFoundError when tenantId does not match (cross-tenant)', async () => {
    const repository = new InMemoryProposalRepository();
    const publicLinks = new ProposalPublicLinkService(repository as any, configService as any);
    const messagingFacade = createMessagingFacadeMock();
    const service = new SendProposalToConversationService(
      repository as any,
      publicLinks,
      messagingFacade as any,
    );

    const proposal = buildProposal({ tenantId: 'tenant-A' });
    repository.seed(proposal);

    await expect(
      service.execute(proposal.id, 'tenant-B'),
    ).rejects.toBeInstanceOf(ProposalNotFoundError);
  });

  it('does not call messagingFacade when proposal is not found for the tenant', async () => {
    const repository = new InMemoryProposalRepository();
    const publicLinks = new ProposalPublicLinkService(repository as any, configService as any);
    const messagingFacade = createMessagingFacadeMock();
    const service = new SendProposalToConversationService(
      repository as any,
      publicLinks,
      messagingFacade as any,
    );

    await service.execute('nonexistent', 'tenant-X').catch(() => {});
    expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
  });

  it('propagates messagingFacade.queueSystemMessage failure without updating the proposal', async () => {
    const repository = new InMemoryProposalRepository();
    const publicLinks = new ProposalPublicLinkService(repository as any, configService as any);
    const messagingFacade = createMessagingFacadeMock();
    messagingFacade.queueSystemMessage.mockRejectedValue(new Error('WhatsApp API error'));

    const service = new SendProposalToConversationService(
      repository as any,
      publicLinks,
      messagingFacade as any,
    );

    const proposal = buildProposal({ tenantId: 'tenant-123' });
    repository.seed(proposal);
    await publicLinks.ensurePublicLink(proposal);

    await expect(service.execute(proposal.id, 'tenant-123')).rejects.toThrow('WhatsApp API error');

    // Status must NOT have been updated to SENT since the facade threw
    const stored = await repository.findById(proposal.id, 'tenant-123');
    expect(stored?.status).not.toBe('SENT');
  });

  it('updates status to SENT and sets metadata when messaging succeeds', async () => {
    const repository = new InMemoryProposalRepository();
    const publicLinks = new ProposalPublicLinkService(repository as any, configService as any);
    const messagingFacade = createMessagingFacadeMock();

    const service = new SendProposalToConversationService(
      repository as any,
      publicLinks,
      messagingFacade as any,
    );

    const proposal = buildProposal({ tenantId: 'tenant-123' });
    repository.seed(proposal);

    const result = await service.execute(proposal.id, 'tenant-123');

    expect(result).toHaveProperty('conversationId');
    expect(result).toHaveProperty('publicUrl');
    const stored = await repository.findById(proposal.id, 'tenant-123');
    expect(stored?.status).toBe('SENT');
  });
});

// ─────────────────────────────────────────────────────────────
// 11. PublicProposalService — acceptWithSignature error paths (gaps #19–#23)
// ─────────────────────────────────────────────────────────────
describe('PublicProposalService.acceptWithSignature — validation error paths', () => {
  const configService = {
    get: (key: string) => {
      if (key === 'APP_PUBLIC_BASE_URL') return 'https://app.test';
      if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
      return undefined;
    },
  };

  async function buildAcceptScenario(proposalOverrides = {}) {
    const repository = new InMemoryProposalRepository();
    const publicLinks = new ProposalPublicLinkService(repository as any, configService as any);
    const proposal = buildProposal({ id: `prop-accept-${Date.now()}`, ...proposalOverrides });
    repository.seed(proposal);
    const { token } = await publicLinks.ensurePublicLink(proposal);
    return { repository, publicLinks, proposal, token };
  }

  it('throws NotFoundException when contact is not found', async () => {
    const { repository, publicLinks, token } = await buildAcceptScenario();
    const contacts = { getContactById: jest.fn().mockResolvedValue(null) };
    const service = new PublicProposalService(
      repository as any,
      { findById: jest.fn(async () => ({ companyName: { value: 'X' } })) } as any,
      publicLinks,
      {} as any,
      contacts as any,
    );
    const { NotFoundException } = await import('@nestjs/common');
    await expect(
      service.acceptWithSignature(token, { signerName: 'Test', signatureDataUrl: 'data:image/png;base64,abc' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when contact has no document', async () => {
    const { repository, publicLinks, token } = await buildAcceptScenario();
    const contacts = {
      getContactById: jest.fn().mockResolvedValue({
        contactId: 'contact-456',
        name: 'No Doc',
        document: '',
        branchId: 'branch-1',
      }),
    };
    const service = new PublicProposalService(
      repository as any,
      { findById: jest.fn(async () => ({ companyName: { value: 'X' } })) } as any,
      publicLinks,
      {} as any,
      contacts as any,
    );
    const { BadRequestException } = await import('@nestjs/common');
    await expect(
      service.acceptWithSignature(token, { signerName: 'Test', signatureDataUrl: 'data:image/png;base64,abc' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when contact document contains only non-digit characters', async () => {
    const { repository, publicLinks, token } = await buildAcceptScenario();
    const contacts = {
      getContactById: jest.fn().mockResolvedValue({
        contactId: 'contact-456',
        name: 'No Doc',
        document: '---',
        branchId: 'branch-1',
      }),
    };
    const service = new PublicProposalService(
      repository as any,
      { findById: jest.fn(async () => ({ companyName: { value: 'X' } })) } as any,
      publicLinks,
      {} as any,
      contacts as any,
    );
    const { BadRequestException } = await import('@nestjs/common');
    await expect(
      service.acceptWithSignature(token, { signerName: 'Test', signatureDataUrl: 'data:image/png;base64,abc' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when signerName is blank', async () => {
    const { repository, publicLinks, token } = await buildAcceptScenario({
      metadata: { commercial: { publicAccess: { tokenId: 'x' }, approval: { status: 'PENDING' }, payment: { url: 'https://pay.test/existing' } } },
    });
    const service = new PublicProposalService(
      repository as any,
      { findById: jest.fn(async () => ({ companyName: { value: 'X' } })) } as any,
      publicLinks,
      {} as any,
      {} as any,
    );
    const { BadRequestException } = await import('@nestjs/common');
    await expect(
      service.acceptWithSignature(token, { signerName: '   ', signatureDataUrl: 'data:image/png;base64,abc' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when signerName is null', async () => {
    const { repository, publicLinks, token } = await buildAcceptScenario({
      metadata: { commercial: { publicAccess: { tokenId: 'x' }, approval: { status: 'PENDING' }, payment: { url: 'https://pay.test/existing' } } },
    });
    const service = new PublicProposalService(
      repository as any,
      { findById: jest.fn(async () => ({ companyName: { value: 'X' } })) } as any,
      publicLinks,
      {} as any,
      {} as any,
    );
    const { BadRequestException } = await import('@nestjs/common');
    await expect(
      service.acceptWithSignature(token, { signerName: null, signatureDataUrl: 'data:image/png;base64,abc' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when signatureDataUrl does not start with data:image/', async () => {
    const { repository, publicLinks, token } = await buildAcceptScenario({
      metadata: { commercial: { publicAccess: { tokenId: 'x' }, approval: { status: 'PENDING' }, payment: { url: 'https://pay.test/existing' } } },
    });
    const service = new PublicProposalService(
      repository as any,
      { findById: jest.fn(async () => ({ companyName: { value: 'X' } })) } as any,
      publicLinks,
      {} as any,
      {} as any,
    );
    const { BadRequestException } = await import('@nestjs/common');
    await expect(
      service.acceptWithSignature(token, { signerName: 'Valid Name', signatureDataUrl: 'notanimage' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when signatureDataUrl is a plain base64 without data:image/ prefix', async () => {
    const { repository, publicLinks, token } = await buildAcceptScenario({
      metadata: { commercial: { publicAccess: { tokenId: 'x' }, approval: { status: 'PENDING' }, payment: { url: 'https://pay.test/existing' } } },
    });
    const service = new PublicProposalService(
      repository as any,
      { findById: jest.fn(async () => ({ companyName: { value: 'X' } })) } as any,
      publicLinks,
      {} as any,
      {} as any,
    );
    const { BadRequestException } = await import('@nestjs/common');
    await expect(
      service.acceptWithSignature(token, { signerName: 'Valid Name', signatureDataUrl: 'iVBORw0KGgo=' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when proposal is already REJECTED', async () => {
    const { repository, publicLinks, token } = await buildAcceptScenario({
      metadata: {
        commercial: {
          publicAccess: { tokenId: 'x' },
          approval: { status: 'REJECTED' },
        },
      },
    });
    const service = new PublicProposalService(
      repository as any,
      { findById: jest.fn(async () => ({ companyName: { value: 'X' } })) } as any,
      publicLinks,
      {} as any,
      {} as any,
    );
    const { BadRequestException } = await import('@nestjs/common');
    await expect(
      service.acceptWithSignature(token, { signerName: 'Name', signatureDataUrl: 'data:image/png;base64,abc' }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─────────────────────────────────────────────────────────────
// 12. PublicProposalService.reject — already-ACCEPTED and double-reject (gaps #24, #25)
// ─────────────────────────────────────────────────────────────
describe('PublicProposalService.reject — edge cases', () => {
  const configService = {
    get: (key: string) => {
      if (key === 'APP_PUBLIC_BASE_URL') return 'https://app.test';
      if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
      return undefined;
    },
  };

  async function buildRejectScenario(approvalStatus: string) {
    const repository = new InMemoryProposalRepository();
    const publicLinks = new ProposalPublicLinkService(repository as any, configService as any);
    const tenantRepository = { findById: jest.fn(async () => ({ companyName: { value: 'Co' } })) };
    const proposal = buildProposal({
      id: `prop-reject-${Date.now()}`,
      metadata: {
        commercial: {
          publicAccess: { tokenId: 'token-id-1' },
          approval: { status: approvalStatus },
        },
      },
    });
    repository.seed(proposal);
    const { token } = await publicLinks.ensurePublicLink(proposal);
    const service = new PublicProposalService(
      repository as any,
      tenantRepository as any,
      publicLinks,
      {} as any,
      {} as any,
    );
    return { service, token, repository, proposal };
  }

  it('throws BadRequestException when rejecting an already-ACCEPTED proposal', async () => {
    const { service, token } = await buildRejectScenario('ACCEPTED');
    const { BadRequestException } = await import('@nestjs/common');
    await expect(service.reject(token)).rejects.toThrow(BadRequestException);
  });

  it('allows double-reject (second reject silently re-sets rejectedAt — documents current behaviour)', async () => {
    const { service, token, repository, proposal } = await buildRejectScenario('PENDING');
    await service.reject(token);
    // REJECTED approval, now re-reject the same token
    const { token: token2 } = await new ProposalPublicLinkService(
      repository as any, configService as any,
    ).ensurePublicLink(proposal);
    // Should NOT throw since the guard only checks ACCEPTED
    await expect(service.reject(token2)).resolves.not.toThrow();
  });

  it('sets status to REJECTED on a PENDING proposal', async () => {
    const { service, token, repository, proposal } = await buildRejectScenario('PENDING');
    await service.reject(token);
    const stored = await repository.findById(proposal.id, proposal.tenantId);
    expect(stored?.status).toBe('REJECTED');
  });
});

// ─────────────────────────────────────────────────────────────
// 13. ProposalPublicLinkService — token replay / rotation (gap #26, #27)
// ─────────────────────────────────────────────────────────────
describe('ProposalPublicLinkService — token security', () => {
  const makeConfigService = (secret: string | undefined = 'test-secret') => ({
    get: (key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return secret;
      if (key === 'APP_PUBLIC_BASE_URL') return 'https://app.test';
      return undefined;
    },
  });

  it('returns null when tokenId in the token does not match the tokenId in proposal metadata (token replay)', async () => {
    const repository = new InMemoryProposalRepository();
    const publicLinks = new ProposalPublicLinkService(
      repository as any,
      makeConfigService() as any,
    );

    const proposal = buildProposal({ id: 'prop-replay' });
    repository.seed(proposal);

    // Generate a valid token for this proposal
    const { token } = await publicLinks.ensurePublicLink(proposal);

    // Rotate the tokenId in the stored metadata so the token no longer matches
    const meta = (proposal as any)._props.metadata ?? {};
    meta.commercial = meta.commercial ?? {};
    meta.commercial.publicAccess = { ...meta.commercial.publicAccess, tokenId: 'new-token-id' };
    proposal.setMetadata(meta);
    repository.seed(proposal);

    const result = await publicLinks.resolveProposalByToken(token);
    expect(result).toBeNull();
  });

  it('returns null for a tampered token (signature mismatch)', async () => {
    const repository = new InMemoryProposalRepository();
    const publicLinks = new ProposalPublicLinkService(
      repository as any,
      makeConfigService() as any,
    );
    const proposal = buildProposal({ id: 'prop-tamper' });
    repository.seed(proposal);
    const { token } = await publicLinks.ensurePublicLink(proposal);

    const tampered = token.slice(0, -4) + 'xxxx';
    const result = await publicLinks.resolveProposalByToken(tampered);
    expect(result).toBeNull();
  });

  it('returns null for an entirely invalid (non-token) string', async () => {
    const repository = new InMemoryProposalRepository();
    const publicLinks = new ProposalPublicLinkService(
      repository as any,
      makeConfigService() as any,
    );
    const result = await publicLinks.resolveProposalByToken('not-a-token');
    expect(result).toBeNull();
  });

  it('falls back to hardcoded default secret when configService returns undefined for both secret keys', async () => {
    const repository = new InMemoryProposalRepository();
    const configNoSecret = { get: (_key: string) => undefined };
    const publicLinks = new ProposalPublicLinkService(
      repository as any,
      configNoSecret as any,
    );
    const proposal = buildProposal({ id: 'prop-fallback-secret' });
    repository.seed(proposal);
    // Should not throw — it uses the hardcoded fallback
    const { token } = await publicLinks.ensurePublicLink(proposal);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });
});

// ─────────────────────────────────────────────────────────────
// 14. ProposalAsyncJobProcessor — unknown job name, not-found, facade failure, missing tenantId (gaps #28–#31)
// ─────────────────────────────────────────────────────────────
describe('ProposalAsyncJobProcessor — edge cases', () => {
  const configService = {
    get: (key: string) => {
      if (key === 'APP_PUBLIC_BASE_URL') return 'https://app.test';
      if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
      return undefined;
    },
  };

  function buildProcessor(overrides: {
    repoOverride?: Partial<InMemoryProposalRepository>;
    messagingOverride?: Partial<ReturnType<typeof createMessagingFacadeMock>>;
  } = {}) {
    const repository = new InMemoryProposalRepository();
    const publicLinks = new ProposalPublicLinkService(repository as any, configService as any);
    const messaging = createMessagingFacadeMock();
    if (overrides.messagingOverride) {
      Object.assign(messaging, overrides.messagingOverride);
    }
    const processor = new ProposalAsyncJobProcessor(
      repository as any,
      messaging as any,
      publicLinks,
    );
    return { processor, repository, messaging, publicLinks };
  }

  it('returns early without error when job.name is not "send-proposal"', async () => {
    const { processor } = buildProcessor();
    await expect(
      processor.process({ name: 'unknown-job', data: { proposalId: 'p', tenantId: 't' } } as any),
    ).resolves.toBeUndefined();
  });

  it('returns early when proposal is not found (logs error, does not throw)', async () => {
    const { processor } = buildProcessor();
    await expect(
      processor.process({ name: 'send-proposal', data: { proposalId: 'missing', tenantId: 'tenant-x' } } as any),
    ).resolves.toBeUndefined();
  });

  it('does not call messagingFacade when proposal is not found', async () => {
    const { processor, messaging } = buildProcessor();
    await processor.process({
      name: 'send-proposal',
      data: { proposalId: 'missing', tenantId: 'tenant-x' },
    } as any);
    expect(messaging.queueSystemMessage).not.toHaveBeenCalled();
  });

  it('re-throws when messagingFacade.queueSystemMessage throws (allowing BullMQ retry)', async () => {
    const { processor, repository, publicLinks } = buildProcessor({
      messagingOverride: {
        queueSystemMessage: jest.fn().mockRejectedValue(new Error('WA down')),
      },
    });
    const proposal = buildProposal({ tenantId: 'tenant-123' });
    repository.seed(proposal);
    await publicLinks.ensurePublicLink(proposal);

    await expect(
      processor.process({ name: 'send-proposal', data: { proposalId: proposal.id, tenantId: 'tenant-123' } } as any),
    ).rejects.toThrow('WA down');
  });

  it('does not update proposal status when messaging facade throws', async () => {
    const { processor, repository, publicLinks } = buildProcessor({
      messagingOverride: {
        queueSystemMessage: jest.fn().mockRejectedValue(new Error('WA down')),
      },
    });
    const proposal = buildProposal({ tenantId: 'tenant-123' });
    repository.seed(proposal);
    await publicLinks.ensurePublicLink(proposal);

    await processor
      .process({ name: 'send-proposal', data: { proposalId: proposal.id, tenantId: 'tenant-123' } } as any)
      .catch(() => {});

    const stored = await repository.findById(proposal.id, 'tenant-123');
    expect(stored?.status).not.toBe('SENT');
  });

  it('handles a job with undefined tenantId gracefully (returns early — proposal not found)', async () => {
    const { processor, repository } = buildProcessor();
    const proposal = buildProposal({ tenantId: 'tenant-123' });
    repository.seed(proposal);

    // Job with no tenantId — findById(id, undefined) returns null (cross-tenant isolation)
    await expect(
      processor.process({
        name: 'send-proposal',
        data: { proposalId: proposal.id, tenantId: undefined as any },
      } as any),
    ).resolves.toBeUndefined();
  });

  it('updates proposal status to SENT when messaging succeeds', async () => {
    const { processor, repository, publicLinks } = buildProcessor();
    const proposal = buildProposal({ tenantId: 'tenant-123' });
    repository.seed(proposal);
    await publicLinks.ensurePublicLink(proposal);

    await processor.process({
      name: 'send-proposal',
      data: { proposalId: proposal.id, tenantId: 'tenant-123' },
    } as any);

    const stored = await repository.findById(proposal.id, 'tenant-123');
    expect(stored?.status).toBe('SENT');
  });
});

// ─────────────────────────────────────────────────────────────
// 15. normalizeProposalMetadata — defensive guards (gap #49)
// ─────────────────────────────────────────────────────────────
describe('normalizeProposalMetadata — malformed inputs', () => {
  it('returns a valid shape when metadata is null', () => {
    const result = normalizeProposalMetadata(null);
    expect(result.commercial.approval.status).toBe('PENDING');
    expect(result.commercial.publicAccess.tokenId).toBeDefined();
  });

  it('returns a valid shape when metadata is undefined', () => {
    const result = normalizeProposalMetadata(undefined);
    expect(result.commercial.publicAccess.tokenId).toBeDefined();
    expect(result.commercial.approval.status).toBe('PENDING');
  });

  it('returns a valid shape when metadata is an array (deeply malformed)', () => {
    const result = normalizeProposalMetadata([] as any);
    expect(result.commercial.publicAccess.tokenId).toBeDefined();
  });

  it('returns a valid shape when commercial is an array (malformed commercial field)', () => {
    const result = normalizeProposalMetadata({ commercial: [] as any });
    expect(result.commercial.publicAccess.tokenId).toBeDefined();
    expect(result.commercial.approval.status).toBe('PENDING');
  });

  it('returns a valid shape when commercial.publicAccess is null', () => {
    const result = normalizeProposalMetadata({ commercial: { publicAccess: null as any, approval: { status: 'PENDING' } } } as any);
    expect(result.commercial.publicAccess.tokenId).toBeDefined();
  });

  it('returns a valid shape when commercial.approval.status is a number (type corruption)', () => {
    const result = normalizeProposalMetadata({ commercial: { publicAccess: { tokenId: 'x' }, approval: { status: 42 as any } } } as any);
    // Invalid status number falls through — the field is set to whatever was provided
    // This documents the current behaviour: no strict validation
    expect(result.commercial.approval).toBeDefined();
  });

  it('preserves finalPrice when provided as a valid number', () => {
    const result = normalizeProposalMetadata({ finalPrice: 999 } as any);
    expect(result.finalPrice).toBe(999);
  });

  it('preserves existing tokenId from valid metadata', () => {
    const result = normalizeProposalMetadata({
      commercial: {
        publicAccess: { tokenId: 'stable-token-id' },
        approval: { status: 'PENDING' },
      },
    } as any);
    expect(result.commercial.publicAccess.tokenId).toBe('stable-token-id');
  });
});

// ─────────────────────────────────────────────────────────────
// 16. resolveProposalFinalAmount — boundary: finalPrice = 0 (gap #50)
// ─────────────────────────────────────────────────────────────
describe('resolveProposalFinalAmount — boundary conditions', () => {
  it('falls back to totalAmount when finalPrice is 0 (falsy boundary — 0 is treated as absent)', () => {
    const proposal = buildProposal({ metadata: { finalPrice: 0 } });
    const amount = resolveProposalFinalAmount(proposal);
    expect(amount).toBe(proposal.totalAmount);
  });

  it('uses finalPrice when it is 0.001 (positive but tiny — does not fall back)', () => {
    const proposal = buildProposal({ metadata: { finalPrice: 0.001 } });
    const amount = resolveProposalFinalAmount(proposal);
    expect(amount).toBeCloseTo(0, 1);
    expect(amount).toBeGreaterThan(0);
  });

  it('uses finalPrice when positive and returns it rounded to 2 decimal places', () => {
    const proposal = buildProposal({ metadata: { finalPrice: 420.999 } });
    const amount = resolveProposalFinalAmount(proposal);
    expect(amount).toBe(421);
  });

  it('falls back to totalAmount when finalPrice is negative', () => {
    const proposal = buildProposal({ metadata: { finalPrice: -100 } });
    const amount = resolveProposalFinalAmount(proposal);
    expect(amount).toBe(proposal.totalAmount);
  });

  it('falls back to totalAmount when finalPrice is Infinity', () => {
    const proposal = buildProposal({ metadata: { finalPrice: Infinity } });
    const amount = resolveProposalFinalAmount(proposal);
    expect(amount).toBe(proposal.totalAmount);
  });

  it('falls back to totalAmount when finalPrice is NaN', () => {
    const proposal = buildProposal({ metadata: { finalPrice: NaN } });
    const amount = resolveProposalFinalAmount(proposal);
    expect(amount).toBe(proposal.totalAmount);
  });

  it('falls back to totalAmount when metadata has no finalPrice property', () => {
    const proposal = buildProposal({ metadata: {} });
    const amount = resolveProposalFinalAmount(proposal);
    expect(amount).toBe(proposal.totalAmount);
  });
});

// ─────────────────────────────────────────────────────────────
// 17. buildProposalPublicToken / verifyProposalPublicToken (support functions)
// ─────────────────────────────────────────────────────────────
describe('buildProposalPublicToken and verifyProposalPublicToken', () => {
  const secret = 'unit-test-secret';

  it('produces a token that can be verified with the same secret', () => {
    const token = buildProposalPublicToken({ proposalId: 'p-1', tokenId: 't-1' }, secret);
    const payload = verifyProposalPublicToken(token, secret);
    expect(payload).toEqual({ proposalId: 'p-1', tokenId: 't-1' });
  });

  it('returns null when verified with a different secret', () => {
    const token = buildProposalPublicToken({ proposalId: 'p-1', tokenId: 't-1' }, secret);
    const payload = verifyProposalPublicToken(token, 'wrong-secret');
    expect(payload).toBeNull();
  });

  it('returns null for an empty string token', () => {
    expect(verifyProposalPublicToken('', secret)).toBeNull();
  });

  it('returns null for a token with no dot separator', () => {
    expect(verifyProposalPublicToken('nodottoken', secret)).toBeNull();
  });

  it('returns null for a token with a corrupted payload segment', () => {
    const token = buildProposalPublicToken({ proposalId: 'p', tokenId: 't' }, secret);
    const [, sig] = token.split('.');
    const corrupted = `!!!.${sig}`;
    expect(verifyProposalPublicToken(corrupted, secret)).toBeNull();
  });
});
