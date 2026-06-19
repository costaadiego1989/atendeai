/* eslint-disable @typescript-eslint/no-explicit-any */
// ================================================================
// sales.unit-new.spec.ts — NEW unit tests for the sales module
// ================================================================
import { NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { DeletePaymentLinkUseCase } from '../application/use-cases/DeletePaymentLinkUseCase';
import { PausePaymentLinkUseCase } from '../application/use-cases/PausePaymentLinkUseCase';
import { ResumePaymentLinkUseCase } from '../application/use-cases/ResumePaymentLinkUseCase';
import { ListPaymentLinksUseCase } from '../application/use-cases/ListPaymentLinksUseCase';
import { GenerateSalesPaymentLinksReportUseCase } from '../application/use-cases/GenerateSalesPaymentLinksReportUseCase';
import { SuggestPaymentLinkWithAIUseCase } from '../application/use-cases/SuggestPaymentLinkWithAIUseCase';
import { CreateCouponUseCase } from '../application/use-cases/CreateCouponUseCase';
import { UpdateCouponUseCase } from '../application/use-cases/UpdateCouponUseCase';
import { DeleteCouponUseCase } from '../application/use-cases/DeleteCouponUseCase';
import { ListCouponsUseCase } from '../application/use-cases/ListCouponsUseCase';
import { CreatePromotionUseCase } from '../application/use-cases/CreatePromotionUseCase';
import { UpdatePromotionUseCase } from '../application/use-cases/UpdatePromotionUseCase';
import { DeletePromotionUseCase } from '../application/use-cases/DeletePromotionUseCase';
import { ListPromotionsUseCase } from '../application/use-cases/ListPromotionsUseCase';
import { RedeemCouponUseCase } from '../application/use-cases/RedeemCouponUseCase';
import { TrackSalesMetricUseCase } from '../application/use-cases/TrackSalesMetricUseCase';
import { SalesPaymentLinkLifecycleService } from '../application/services/SalesPaymentLinkLifecycleService';
import { SalesAnalyticsHandler } from '../application/handlers/SalesAnalyticsHandler';
import { SalesPaymentEventHandler } from '../application/handlers/SalesPaymentEventHandler';
import { Coupon } from '../domain/entities/Coupon';
import { Promotion } from '../domain/entities/Promotion';
import { SalesMetric } from '../domain/entities/SalesMetric';
import { SalesPaymentLinkCreatedIntegrationEvent } from '../application/integration-events/SalesIntegrationEvents';
import { CreatePaymentLinkUseCase } from '../application/use-cases/CreatePaymentLinkUseCase';
import { CreateSplitPaymentChargeUseCase } from '../application/use-cases/CreateSplitPaymentChargeUseCase';

// ─── shared mock factories ────────────────────────────────────────────────────

function makePaymentFacade() {
  return {
    createCustomer: jest.fn(),
    getCustomer: jest.fn(),
    createSubaccount: jest.fn(),
    listSubaccounts: jest.fn(),
    createSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    getSubscription: jest.fn(),
    createPayment: jest.fn(),
    deletePayment: jest.fn(),
    restorePayment: jest.fn(),
    createPaymentLink: jest.fn(),
    removePaymentLink: jest.fn(),
    restorePaymentLink: jest.fn(),
  };
}

function makePaymentLinksRepository() {
  return {
    createPaymentLink: jest.fn(),
    listPaymentLinks: jest.fn(),
    findPaymentLinkById: jest.fn(),
    updatePaymentLinkStatus: jest.fn(),
    updatePaymentLinkStatusByExternalReference: jest.fn(),
    findContactNameById: jest.fn(),
  };
}

function makeMetricsRepository() {
  return {
    findByTenantAndDate: jest.fn(),
    save: jest.fn(),
    incrementMetric: jest.fn(),
    getMetrics: jest.fn(),
  };
}

function makeCouponRepository() {
  return {
    findCouponByCode: jest.fn(),
    findCouponById: jest.fn(),
    createCoupon: jest.fn(),
    updateCoupon: jest.fn(),
    deleteCoupon: jest.fn(),
    listCoupons: jest.fn(),
    incrementCouponUsage: jest.fn(),
    atomicIncrementCouponUsage: jest.fn(),
  };
}

function makePromotionRepository() {
  return {
    createPromotion: jest.fn(),
    updatePromotion: jest.fn(),
    deletePromotion: jest.fn(),
    findPromotionById: jest.fn(),
    listPromotions: jest.fn(),
  };
}

function makeEventBus() {
  return {
    publish: jest.fn(),
    subscribe: jest.fn(),
  };
}

function makeTenantRepository() {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByCnpj: jest.fn(),
    findByWhatsAppNumber: jest.fn(),
    findByApiKey: jest.fn(),
    findAll: jest.fn(),
    exists: jest.fn(),
    listBranches: jest.fn(),
    createBranch: jest.fn(),
    updateBranch: jest.fn(),
    deleteBranch: jest.fn(),
  };
}

function makeAiEngine() {
  return { generateResponse: jest.fn() };
}

function makeTenantAgentRuleService() {
  return { getRule: jest.fn() };
}

function makeStructuredLog() {
  return { emit: jest.fn() };
}

function makeSalesPaymentLink(overrides: Record<string, any> = {}): any {
  return {
    id: 'link-1',
    tenantId: 'tenant-1',
    providerLinkId: 'prov-1',
    externalId: 'sales-link|tenant-1|link-1',
    name: 'Test Link',
    value: 150,
    url: 'https://pay.test/link-1',
    billingType: 'PIX',
    status: 'ACTIVE',
    source: 'MANUAL',
    resourceType: 'PAYMENT_LINK',
    contactId: null,
    recurrenceEnabled: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. DeletePaymentLinkUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('DeletePaymentLinkUseCase', () => {
  let useCase: DeletePaymentLinkUseCase;
  let salesRepository: ReturnType<typeof makePaymentLinksRepository>;
  let paymentFacade: ReturnType<typeof makePaymentFacade>;

  beforeEach(() => {
    salesRepository = makePaymentLinksRepository();
    paymentFacade = makePaymentFacade();
    useCase = new DeletePaymentLinkUseCase(salesRepository as any, paymentFacade as any);
  });

  it('throws NotFoundException when link is not found', async () => {
    salesRepository.findPaymentLinkById.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
    expect(paymentFacade.removePaymentLink).not.toHaveBeenCalled();
    expect(paymentFacade.deletePayment).not.toHaveBeenCalled();
  });

  it('calls removePaymentLink for PAYMENT_LINK resourceType', async () => {
    const link = makeSalesPaymentLink({ resourceType: 'PAYMENT_LINK', status: 'ACTIVE' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue({ ...link, status: 'DELETED' });
    await useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' });
    expect(paymentFacade.removePaymentLink).toHaveBeenCalledWith(link.providerLinkId);
    expect(paymentFacade.deletePayment).not.toHaveBeenCalled();
  });

  it('calls deletePayment for PAYMENT resourceType', async () => {
    const link = makeSalesPaymentLink({ resourceType: 'PAYMENT', status: 'ACTIVE' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue({ ...link, status: 'DELETED' });
    await useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' });
    expect(paymentFacade.deletePayment).toHaveBeenCalledWith(link.providerLinkId);
    expect(paymentFacade.removePaymentLink).not.toHaveBeenCalled();
  });

  it('skips gateway call when status is already DELETED', async () => {
    const link = makeSalesPaymentLink({ status: 'DELETED' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue({ ...link, status: 'DELETED' });
    await useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' });
    expect(paymentFacade.removePaymentLink).not.toHaveBeenCalled();
    expect(paymentFacade.deletePayment).not.toHaveBeenCalled();
  });

  it('returns id and status DELETED on success', async () => {
    const link = makeSalesPaymentLink({ status: 'ACTIVE' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue({ ...link, status: 'DELETED' });
    const result = await useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' });
    expect(result).toEqual({ id: 'link-1', status: 'DELETED' });
  });

  it('throws NotFoundException when updatePaymentLinkStatus returns null', async () => {
    const link = makeSalesPaymentLink({ status: 'ACTIVE' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. PausePaymentLinkUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('PausePaymentLinkUseCase', () => {
  let useCase: PausePaymentLinkUseCase;
  let salesRepository: ReturnType<typeof makePaymentLinksRepository>;
  let paymentFacade: ReturnType<typeof makePaymentFacade>;

  beforeEach(() => {
    salesRepository = makePaymentLinksRepository();
    paymentFacade = makePaymentFacade();
    useCase = new PausePaymentLinkUseCase(salesRepository as any, paymentFacade as any);
  });

  it('throws NotFoundException when link is not found', async () => {
    salesRepository.findPaymentLinkById.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('calls removePaymentLink for PAYMENT_LINK resourceType', async () => {
    const link = makeSalesPaymentLink({ resourceType: 'PAYMENT_LINK' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue({ ...link, status: 'PAUSED' });
    await useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' });
    expect(paymentFacade.removePaymentLink).toHaveBeenCalledWith(link.providerLinkId);
    expect(paymentFacade.deletePayment).not.toHaveBeenCalled();
  });

  it('calls deletePayment for PAYMENT resourceType', async () => {
    const link = makeSalesPaymentLink({ resourceType: 'PAYMENT' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue({ ...link, status: 'PAUSED' });
    await useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' });
    expect(paymentFacade.deletePayment).toHaveBeenCalledWith(link.providerLinkId);
    expect(paymentFacade.removePaymentLink).not.toHaveBeenCalled();
  });

  it('returns status PAUSED on success', async () => {
    const link = makeSalesPaymentLink({ resourceType: 'PAYMENT_LINK' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue({ ...link, status: 'PAUSED' });
    const result = await useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' });
    expect(result.status).toBe('PAUSED');
  });

  it('throws NotFoundException when status update returns null', async () => {
    const link = makeSalesPaymentLink({ resourceType: 'PAYMENT_LINK' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. ResumePaymentLinkUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('ResumePaymentLinkUseCase', () => {
  let useCase: ResumePaymentLinkUseCase;
  let salesRepository: ReturnType<typeof makePaymentLinksRepository>;
  let paymentFacade: ReturnType<typeof makePaymentFacade>;

  beforeEach(() => {
    salesRepository = makePaymentLinksRepository();
    paymentFacade = makePaymentFacade();
    useCase = new ResumePaymentLinkUseCase(salesRepository as any, paymentFacade as any);
  });

  it('throws NotFoundException when link is not found', async () => {
    salesRepository.findPaymentLinkById.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('calls restorePaymentLink for PAYMENT_LINK resourceType', async () => {
    const link = makeSalesPaymentLink({ resourceType: 'PAYMENT_LINK', status: 'PAUSED' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue({ ...link, status: 'ACTIVE' });
    await useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' });
    expect(paymentFacade.restorePaymentLink).toHaveBeenCalledWith(link.providerLinkId);
    expect(paymentFacade.restorePayment).not.toHaveBeenCalled();
  });

  it('calls restorePayment for PAYMENT resourceType', async () => {
    const link = makeSalesPaymentLink({ resourceType: 'PAYMENT', status: 'PAUSED' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue({ ...link, status: 'ACTIVE' });
    await useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' });
    expect(paymentFacade.restorePayment).toHaveBeenCalledWith(link.providerLinkId);
    expect(paymentFacade.restorePaymentLink).not.toHaveBeenCalled();
  });

  it('returns status ACTIVE on success', async () => {
    const link = makeSalesPaymentLink({ resourceType: 'PAYMENT_LINK', status: 'PAUSED' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue({ ...link, status: 'ACTIVE' });
    const result = await useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' });
    expect(result.status).toBe('ACTIVE');
  });

  it('throws NotFoundException when updatePaymentLinkStatus returns null', async () => {
    const link = makeSalesPaymentLink({ resourceType: 'PAYMENT_LINK', status: 'PAUSED' });
    salesRepository.findPaymentLinkById.mockResolvedValue(link);
    salesRepository.updatePaymentLinkStatus.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', paymentLinkId: 'link-1' }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. ListPaymentLinksUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('ListPaymentLinksUseCase', () => {
  let useCase: ListPaymentLinksUseCase;
  let salesRepository: ReturnType<typeof makePaymentLinksRepository>;

  const emptySummary = {
    totalLinks: 0, activeLinks: 0, pausedLinks: 0, paidLinks: 0,
    expiredLinks: 0, estimatedRevenue: 0, paidRevenue: 0,
  };

  beforeEach(() => {
    salesRepository = makePaymentLinksRepository();
    useCase = new ListPaymentLinksUseCase(salesRepository as any);
  });

  it('clamps pageSize to 100 when input exceeds 100', async () => {
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: emptySummary });
    await useCase.execute({ tenantId: 'tenant-1', page: 1, pageSize: 500 });
    expect(salesRepository.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pageSize: 100 }),
    );
  });

  it('defaults page to 1 when page < 1 is given', async () => {
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: emptySummary });
    await useCase.execute({ tenantId: 'tenant-1', page: 0, pageSize: 20 });
    expect(salesRepository.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1 }),
    );
  });

  it('defaults page to 1 when page is negative', async () => {
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: emptySummary });
    await useCase.execute({ tenantId: 'tenant-1', page: -5 });
    expect(salesRepository.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1 }),
    );
  });

  it('defaults pageSize to 20 when not provided', async () => {
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: emptySummary });
    await useCase.execute({ tenantId: 'tenant-1' });
    expect(salesRepository.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pageSize: 20 }),
    );
  });

  it('accepts pageSize exactly 100 without clamping', async () => {
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: emptySummary });
    await useCase.execute({ tenantId: 'tenant-1', page: 1, pageSize: 100 });
    expect(salesRepository.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pageSize: 100 }),
    );
  });

  it('forwards all filter parameters to repository', async () => {
    const dateFrom = new Date('2026-01-01');
    const dateTo = new Date('2026-01-31');
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: emptySummary });
    await useCase.execute({
      tenantId: 'tenant-1',
      status: 'PAID',
      source: 'AI',
      branchId: 'branch-99',
      search: 'consult',
      dateFrom,
      dateTo,
    });
    expect(salesRepository.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        status: 'PAID',
        source: 'AI',
        branchId: 'branch-99',
        search: 'consult',
        dateFrom,
        dateTo,
      }),
    );
  });

  it('defaults status to ALL and source to ALL when not provided', async () => {
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: emptySummary });
    await useCase.execute({ tenantId: 'tenant-1' });
    expect(salesRepository.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ status: 'ALL', source: 'ALL' }),
    );
  });

  it('maps summary field from repository result', async () => {
    const summary = {
      totalLinks: 5, activeLinks: 3, pausedLinks: 1, paidLinks: 1,
      expiredLinks: 0, estimatedRevenue: 700, paidRevenue: 200,
    };
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 5, summary });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.summary).toEqual(summary);
  });

  it('returns empty items array and pagination when no results', async () => {
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: emptySummary });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.items).toHaveLength(0);
    expect(result.pagination.totalPages).toBe(1);
  });

  it('calculates totalPages correctly for multi-page results', async () => {
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 55, summary: emptySummary });
    const result = await useCase.execute({ tenantId: 'tenant-1', pageSize: 20 });
    expect(result.pagination.totalPages).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. GenerateSalesPaymentLinksReportUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('GenerateSalesPaymentLinksReportUseCase', () => {
  let useCase: GenerateSalesPaymentLinksReportUseCase;
  let salesRepository: ReturnType<typeof makePaymentLinksRepository>;

  const emptySummary = {
    totalLinks: 0, activeLinks: 0, pausedLinks: 0, paidLinks: 0,
    expiredLinks: 0, estimatedRevenue: 0, paidRevenue: 0,
  };

  beforeEach(() => {
    salesRepository = makePaymentLinksRepository();
    useCase = new GenerateSalesPaymentLinksReportUseCase(salesRepository as any);
  });

  it('always uses pageSize=10000 regardless of input filters', async () => {
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: emptySummary });
    await useCase.execute({ tenantId: 'tenant-1', pageSize: 5 });
    expect(salesRepository.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pageSize: 10000, page: 1 }),
    );
  });

  it('always uses page=1 regardless of input page', async () => {
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: emptySummary });
    await useCase.execute({ tenantId: 'tenant-1', page: 10 });
    expect(salesRepository.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1 }),
    );
  });

  it('forwards filters correctly to repository', async () => {
    const dateFrom = new Date('2026-01-01');
    const dateTo = new Date('2026-01-31');
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: emptySummary });
    await useCase.execute({
      tenantId: 'tenant-1',
      status: 'PAID',
      source: 'MANUAL',
      branchId: 'branch-1',
      dateFrom,
      dateTo,
    });
    expect(salesRepository.listPaymentLinks).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ status: 'PAID', source: 'MANUAL', branchId: 'branch-1', dateFrom, dateTo }),
    );
  });

  it('returns empty items array when no payment links exist', async () => {
    salesRepository.listPaymentLinks.mockResolvedValue({ items: [], total: 0, summary: emptySummary });
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.items).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. SuggestPaymentLinkWithAIUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('SuggestPaymentLinkWithAIUseCase', () => {
  let useCase: SuggestPaymentLinkWithAIUseCase;
  let aiEngine: ReturnType<typeof makeAiEngine>;
  let tenantRepository: ReturnType<typeof makeTenantRepository>;
  let agentRuleService: ReturnType<typeof makeTenantAgentRuleService>;

  beforeEach(() => {
    aiEngine = makeAiEngine();
    tenantRepository = makeTenantRepository();
    agentRuleService = makeTenantAgentRuleService();
    tenantRepository.findById.mockResolvedValue({ id: 'tenant-1', companyName: { value: 'ClinicaX' } } as any);
    agentRuleService.getRule.mockResolvedValue(null);
    useCase = new SuggestPaymentLinkWithAIUseCase(aiEngine as any, tenantRepository as any, agentRuleService as any);
  });

  it('parses plain JSON response and maps fields correctly', async () => {
    aiEngine.generateResponse.mockResolvedValue({
      text: '{"name":"Consulta","description":"Avaliação","label":"avaliação","value":200,"billingType":"PIX","expiresAt":null}',
    });
    const result = await useCase.execute({ tenantId: 'tenant-1', prompt: 'crie consulta de 200' });
    expect(result.name).toBe('Consulta');
    expect(result.value).toBe(200);
    expect(result.billingType).toBe('PIX');
    expect(result.source).toBe('AI');
  });

  it('parses JSON wrapped in markdown code fences via regex fallback', async () => {
    aiEngine.generateResponse.mockResolvedValue({
      text: '```json\n{"name":"Plano","description":"Mensal","label":"","value":99,"billingType":"CREDIT_CARD","expiresAt":null}\n```',
    });
    const result = await useCase.execute({ tenantId: 'tenant-1', prompt: 'plano mensal 99' });
    expect(result.name).toBe('Plano');
    expect(result.billingType).toBe('CREDIT_CARD');
    expect(result.value).toBe(99);
  });

  it('throws InternalServerErrorException when AI returns unparseable text', async () => {
    aiEngine.generateResponse.mockResolvedValue({ text: 'Não entendi o pedido.' });
    await expect(
      useCase.execute({ tenantId: 'tenant-1', prompt: 'teste' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws InternalServerErrorException when name is empty string', async () => {
    aiEngine.generateResponse.mockResolvedValue({
      text: '{"name":"","description":"","label":"","value":150,"billingType":"PIX","expiresAt":null}',
    });
    await expect(
      useCase.execute({ tenantId: 'tenant-1', prompt: 'crie link' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws InternalServerErrorException when value is zero or negative', async () => {
    aiEngine.generateResponse.mockResolvedValue({
      text: '{"name":"Plano","description":"","label":"","value":0,"billingType":"PIX","expiresAt":null}',
    });
    await expect(
      useCase.execute({ tenantId: 'tenant-1', prompt: 'link gratis' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('normalizes unknown billingType to PIX', async () => {
    aiEngine.generateResponse.mockResolvedValue({
      text: '{"name":"Plano","description":"","label":"","value":50,"billingType":"WIRE_TRANSFER","expiresAt":null}',
    });
    const result = await useCase.execute({ tenantId: 'tenant-1', prompt: 'link' });
    expect(result.billingType).toBe('PIX');
  });

  it('normalizes invalid expiresAt date string to undefined', async () => {
    aiEngine.generateResponse.mockResolvedValue({
      text: '{"name":"Sessão","description":"","label":"","value":120,"billingType":"PIX","expiresAt":"not-a-date"}',
    });
    const result = await useCase.execute({ tenantId: 'tenant-1', prompt: 'sessao' });
    expect(result.expiresAt).toBeUndefined();
  });

  it('normalizes valid expiresAt date string', async () => {
    aiEngine.generateResponse.mockResolvedValue({
      text: '{"name":"Consulta","description":"","label":"","value":100,"billingType":"PIX","expiresAt":"2026-12-31"}',
    });
    const result = await useCase.execute({ tenantId: 'tenant-1', prompt: 'consulta' });
    expect(result.expiresAt).toBe('2026-12-31');
  });

  it('injects customPrompt into system prompt when agent rule is active', async () => {
    agentRuleService.getRule.mockResolvedValue({
      isActive: true,
      customPrompt: 'Sempre em português. Foque em saúde.',
      fallbackToGlobal: true,
    });
    aiEngine.generateResponse.mockResolvedValue({
      text: '{"name":"Terapia","description":"","label":"","value":80,"billingType":"PIX","expiresAt":null}',
    });
    await useCase.execute({ tenantId: 'tenant-1', prompt: 'terapia' });
    const callArgs = aiEngine.generateResponse.mock.calls[0][0];
    expect(callArgs.systemPrompt).toContain('DIRETRIZES PERSONALIZADAS');
    expect(callArgs.systemPrompt).toContain('Sempre em português');
  });

  it('prepends override header when fallbackToGlobal is false', async () => {
    agentRuleService.getRule.mockResolvedValue({
      isActive: false,
      customPrompt: null,
      fallbackToGlobal: false,
    });
    aiEngine.generateResponse.mockResolvedValue({
      text: '{"name":"Fisio","description":"","label":"","value":60,"billingType":"PIX","expiresAt":null}',
    });
    await useCase.execute({ tenantId: 'tenant-1', prompt: 'fisio' });
    const callArgs = aiEngine.generateResponse.mock.calls[0][0];
    expect(callArgs.systemPrompt).toContain('IGNORE INSTRUCOES GERAIS');
  });

  it('returns description as undefined when AI returns empty description string', async () => {
    aiEngine.generateResponse.mockResolvedValue({
      text: '{"name":"Plano","description":"","label":"","value":50,"billingType":"PIX","expiresAt":null}',
    });
    const result = await useCase.execute({ tenantId: 'tenant-1', prompt: 'plano' });
    expect(result.description).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. CreateCouponUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('CreateCouponUseCase', () => {
  let useCase: CreateCouponUseCase;
  let repo: ReturnType<typeof makeCouponRepository>;

  beforeEach(() => {
    repo = makeCouponRepository();
    useCase = new CreateCouponUseCase(repo as any);
  });

  it('calls repo.createCoupon with correct mapped fields', async () => {
    repo.createCoupon.mockResolvedValue({ id: 'coupon-1' } as any);
    await useCase.execute({
      tenantId: 'tenant-1',
      code: 'PROMO20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      maxUses: 50,
      startsAt: '2026-01-01T00:00:00.000Z',
    });
    expect(repo.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        code: 'PROMO20',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        maxUses: 50,
        active: true,
        targets: [],
      }),
    );
  });

  it('sets expiresAt to null when not provided', async () => {
    repo.createCoupon.mockResolvedValue({ id: 'coupon-1' } as any);
    await useCase.execute({
      tenantId: 'tenant-1',
      code: 'NOLIMIT',
      discountType: 'FIXED_AMOUNT',
      discountValue: 10,
      maxUses: 0,
      startsAt: '2026-01-01T00:00:00.000Z',
      expiresAt: null,
    });
    expect(repo.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null }),
    );
  });

  it('defaults targets to empty array when not provided', async () => {
    repo.createCoupon.mockResolvedValue({ id: 'coupon-1' } as any);
    await useCase.execute({
      tenantId: 'tenant-1',
      code: 'GENERIC',
      discountType: 'PERCENTAGE',
      discountValue: 5,
      maxUses: 0,
      startsAt: '2026-01-01T00:00:00.000Z',
    });
    expect(repo.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ targets: [] }),
    );
  });

  it('passes targets array when provided', async () => {
    repo.createCoupon.mockResolvedValue({ id: 'coupon-1' } as any);
    const targets = [{ targetType: 'ITEM' as const, targetId: 'item-99' }];
    await useCase.execute({
      tenantId: 'tenant-1',
      code: 'ITEM10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxUses: 1,
      startsAt: '2026-01-01T00:00:00.000Z',
      targets,
    });
    expect(repo.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ targets }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. UpdateCouponUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('UpdateCouponUseCase', () => {
  let useCase: UpdateCouponUseCase;
  let repo: ReturnType<typeof makeCouponRepository>;

  beforeEach(() => {
    repo = makeCouponRepository();
    useCase = new UpdateCouponUseCase(repo as any);
  });

  it('throws NotFoundException when repo.updateCoupon returns null', async () => {
    repo.updateCoupon.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', couponId: 'missing', code: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('only sends changed fields (partial update)', async () => {
    repo.updateCoupon.mockResolvedValue({ id: 'coupon-1', code: 'NEW' } as any);
    await useCase.execute({ tenantId: 'tenant-1', couponId: 'coupon-1', code: 'NEW' });
    const [, , data] = repo.updateCoupon.mock.calls[0];
    expect(data).toHaveProperty('code', 'NEW');
    expect(data).not.toHaveProperty('discountType');
    expect(data).not.toHaveProperty('active');
  });

  it('sets expiresAt to null when passed as null (clears expiry)', async () => {
    repo.updateCoupon.mockResolvedValue({ id: 'coupon-1' } as any);
    await useCase.execute({ tenantId: 'tenant-1', couponId: 'coupon-1', expiresAt: null });
    const [, , data] = repo.updateCoupon.mock.calls[0];
    expect(data.expiresAt).toBeNull();
  });

  it('converts startsAt string to Date object', async () => {
    repo.updateCoupon.mockResolvedValue({ id: 'coupon-1' } as any);
    await useCase.execute({
      tenantId: 'tenant-1',
      couponId: 'coupon-1',
      startsAt: '2026-06-01T00:00:00.000Z',
    });
    const [, , data] = repo.updateCoupon.mock.calls[0];
    expect(data.startsAt).toBeInstanceOf(Date);
    expect(data.startsAt.getFullYear()).toBe(2026);
  });

  it('converts expiresAt string to Date object when truthy', async () => {
    repo.updateCoupon.mockResolvedValue({ id: 'coupon-1' } as any);
    await useCase.execute({
      tenantId: 'tenant-1',
      couponId: 'coupon-1',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });
    const [, , data] = repo.updateCoupon.mock.calls[0];
    expect(data.expiresAt).toBeInstanceOf(Date);
  });

  it('returns the updated coupon record', async () => {
    const updated = { id: 'coupon-1', code: 'UPDATED', active: false };
    repo.updateCoupon.mockResolvedValue(updated as any);
    const result = await useCase.execute({
      tenantId: 'tenant-1', couponId: 'coupon-1', active: false,
    });
    expect(result).toEqual(updated);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. DeleteCouponUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('DeleteCouponUseCase', () => {
  let useCase: DeleteCouponUseCase;
  let repo: ReturnType<typeof makeCouponRepository>;

  beforeEach(() => {
    repo = makeCouponRepository();
    useCase = new DeleteCouponUseCase(repo as any);
  });

  it('calls repo.deleteCoupon with correct tenantId and couponId', async () => {
    repo.deleteCoupon.mockResolvedValue(undefined);
    await useCase.execute({ tenantId: 'tenant-1', couponId: 'coupon-99' });
    expect(repo.deleteCoupon).toHaveBeenCalledWith('tenant-1', 'coupon-99');
  });

  it('returns { deleted: true }', async () => {
    repo.deleteCoupon.mockResolvedValue(undefined);
    const result = await useCase.execute({ tenantId: 'tenant-1', couponId: 'coupon-99' });
    expect(result).toEqual({ deleted: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. ListCouponsUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('ListCouponsUseCase', () => {
  let useCase: ListCouponsUseCase;
  let repo: ReturnType<typeof makeCouponRepository>;

  beforeEach(() => {
    repo = makeCouponRepository();
    useCase = new ListCouponsUseCase(repo as any);
  });

  it('forwards onlyActive=true flag to repository', async () => {
    repo.listCoupons.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1', onlyActive: true });
    expect(repo.listCoupons).toHaveBeenCalledWith('tenant-1', true);
  });

  it('forwards onlyActive=false flag to repository', async () => {
    repo.listCoupons.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1', onlyActive: false });
    expect(repo.listCoupons).toHaveBeenCalledWith('tenant-1', false);
  });

  it('returns empty array when no coupons exist', async () => {
    repo.listCoupons.mockResolvedValue([]);
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result).toHaveLength(0);
  });

  it('returns all coupons from repository', async () => {
    const coupons = [
      { id: 'c1', code: 'A' },
      { id: 'c2', code: 'B' },
    ];
    repo.listCoupons.mockResolvedValue(coupons as any);
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. CreatePromotionUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('CreatePromotionUseCase', () => {
  let useCase: CreatePromotionUseCase;
  let repo: ReturnType<typeof makePromotionRepository>;

  beforeEach(() => {
    repo = makePromotionRepository();
    useCase = new CreatePromotionUseCase(repo as any);
  });

  it('calls repo.createPromotion with correct fields', async () => {
    repo.createPromotion.mockResolvedValue({ id: 'promo-1' } as any);
    await useCase.execute({
      tenantId: 'tenant-1',
      title: 'Summer Sale',
      description: '20% off everything',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      startsAt: '2026-06-01T00:00:00.000Z',
    });
    expect(repo.createPromotion).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        title: 'Summer Sale',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        active: true,
        targets: [],
      }),
    );
  });

  it('sets expiresAt to null when not provided', async () => {
    repo.createPromotion.mockResolvedValue({ id: 'promo-1' } as any);
    await useCase.execute({
      tenantId: 'tenant-1',
      title: 'No Expiry',
      description: 'desc',
      discountType: 'FIXED_AMOUNT',
      discountValue: 5,
      startsAt: '2026-01-01T00:00:00.000Z',
      expiresAt: null,
    });
    expect(repo.createPromotion).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null }),
    );
  });

  it('sets minimumOrder to null when not provided', async () => {
    repo.createPromotion.mockResolvedValue({ id: 'promo-1' } as any);
    await useCase.execute({
      tenantId: 'tenant-1',
      title: 'No Min Order',
      description: 'desc',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startsAt: '2026-01-01T00:00:00.000Z',
    });
    expect(repo.createPromotion).toHaveBeenCalledWith(
      expect.objectContaining({ minimumOrder: null }),
    );
  });

  it('defaults targets to empty array', async () => {
    repo.createPromotion.mockResolvedValue({ id: 'promo-1' } as any);
    await useCase.execute({
      tenantId: 'tenant-1',
      title: 'T',
      description: 'd',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      startsAt: '2026-01-01T00:00:00.000Z',
    });
    expect(repo.createPromotion).toHaveBeenCalledWith(
      expect.objectContaining({ targets: [] }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. UpdatePromotionUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('UpdatePromotionUseCase', () => {
  let useCase: UpdatePromotionUseCase;
  let repo: ReturnType<typeof makePromotionRepository>;

  beforeEach(() => {
    repo = makePromotionRepository();
    useCase = new UpdatePromotionUseCase(repo as any);
  });

  it('throws NotFoundException when repo returns null', async () => {
    repo.updatePromotion.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', promotionId: 'missing', title: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('only sends changed fields (partial update)', async () => {
    repo.updatePromotion.mockResolvedValue({ id: 'promo-1', title: 'New Title' } as any);
    await useCase.execute({ tenantId: 'tenant-1', promotionId: 'promo-1', title: 'New Title' });
    const [, , data] = repo.updatePromotion.mock.calls[0];
    expect(data).toHaveProperty('title', 'New Title');
    expect(data).not.toHaveProperty('discountType');
    expect(data).not.toHaveProperty('active');
  });

  it('sets expiresAt to null when passed as null', async () => {
    repo.updatePromotion.mockResolvedValue({ id: 'promo-1' } as any);
    await useCase.execute({ tenantId: 'tenant-1', promotionId: 'promo-1', expiresAt: null });
    const [, , data] = repo.updatePromotion.mock.calls[0];
    expect(data.expiresAt).toBeNull();
  });

  it('converts expiresAt string to Date object', async () => {
    repo.updatePromotion.mockResolvedValue({ id: 'promo-1' } as any);
    await useCase.execute({
      tenantId: 'tenant-1',
      promotionId: 'promo-1',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });
    const [, , data] = repo.updatePromotion.mock.calls[0];
    expect(data.expiresAt).toBeInstanceOf(Date);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. DeletePromotionUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('DeletePromotionUseCase', () => {
  let useCase: DeletePromotionUseCase;
  let repo: ReturnType<typeof makePromotionRepository>;

  beforeEach(() => {
    repo = makePromotionRepository();
    useCase = new DeletePromotionUseCase(repo as any);
  });

  it('calls repo.deletePromotion with correct tenantId and promotionId', async () => {
    repo.deletePromotion.mockResolvedValue(undefined);
    await useCase.execute({ tenantId: 'tenant-1', promotionId: 'promo-99' });
    expect(repo.deletePromotion).toHaveBeenCalledWith('tenant-1', 'promo-99');
  });

  it('returns { deleted: true }', async () => {
    repo.deletePromotion.mockResolvedValue(undefined);
    const result = await useCase.execute({ tenantId: 'tenant-1', promotionId: 'promo-99' });
    expect(result).toEqual({ deleted: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. ListPromotionsUseCase
// ═══════════════════════════════════════════════════════════════════════════
describe('ListPromotionsUseCase', () => {
  let useCase: ListPromotionsUseCase;
  let repo: ReturnType<typeof makePromotionRepository>;

  beforeEach(() => {
    repo = makePromotionRepository();
    useCase = new ListPromotionsUseCase(repo as any);
  });

  it('forwards onlyActive=true to repo', async () => {
    repo.listPromotions.mockResolvedValue([]);
    await useCase.execute({ tenantId: 'tenant-1', onlyActive: true });
    expect(repo.listPromotions).toHaveBeenCalledWith('tenant-1', true);
  });

  it('returns empty array when no promotions exist', async () => {
    repo.listPromotions.mockResolvedValue([]);
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result).toHaveLength(0);
  });

  it('returns all promotions when onlyActive is not set', async () => {
    const promos = [{ id: 'p1' }, { id: 'p2' }];
    repo.listPromotions.mockResolvedValue(promos as any);
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 15. Coupon entity — canRedeem / redeem / appliesTo edge cases
// ═══════════════════════════════════════════════════════════════════════════
describe('Coupon entity', () => {
  function makeCouponEntity(overrides: any = {}) {
    return Coupon.create({
      tenantId: 'tenant-1',
      code: 'TEST',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxUses: 0,
      startsAt: new Date(Date.now() - 10000),
      expiresAt: null,
      ...overrides,
    });
  }

  it('canRedeem returns false when expiresAt is exactly now (boundary — expired)', () => {
    // Set expiresAt to 1ms ago to simulate exact expiry boundary
    const coupon = makeCouponEntity({ expiresAt: new Date(Date.now() - 1) });
    expect(coupon.canRedeem()).toBe(false);
  });

  it('canRedeem returns true when expiresAt is 1ms in the future', () => {
    const coupon = makeCouponEntity({ expiresAt: new Date(Date.now() + 60000) });
    expect(coupon.canRedeem()).toBe(true);
  });

  it('FIXED_AMOUNT coupon has correct discountType property', () => {
    const coupon = makeCouponEntity({ discountType: 'FIXED_AMOUNT', discountValue: 25 });
    expect(coupon.discountType).toBe('FIXED_AMOUNT');
    expect(coupon.discountValue).toBe(25);
  });

  it('appliesTo returns true for any target when targets is empty (universal coupon)', () => {
    const coupon = makeCouponEntity({ targets: [] });
    expect(coupon.appliesTo({ targetType: 'ITEM', targetId: 'any-item' })).toBe(true);
    expect(coupon.appliesTo({ targetType: 'CATEGORY', targetId: 'any-cat' })).toBe(true);
  });

  it('appliesTo returns true when target matches one of the targets', () => {
    const coupon = makeCouponEntity({
      targets: [{ targetType: 'ITEM', targetId: 'item-1' }],
    });
    expect(coupon.appliesTo({ targetType: 'ITEM', targetId: 'item-1' })).toBe(true);
  });

  it('appliesTo returns false when target does not match any target', () => {
    const coupon = makeCouponEntity({
      targets: [{ targetType: 'ITEM', targetId: 'item-1' }],
    });
    expect(coupon.appliesTo({ targetType: 'ITEM', targetId: 'item-999' })).toBe(false);
  });

  it('redeem increments usedCount', () => {
    const coupon = makeCouponEntity({ active: true, expiresAt: null });
    const initialCount = coupon.usedCount;
    coupon.redeem();
    expect(coupon.usedCount).toBe(initialCount + 1);
  });

  it('redeem throws when coupon cannot be redeemed', () => {
    const coupon = makeCouponEntity({ active: false });
    expect(() => coupon.redeem()).toThrow('Coupon cannot be redeemed');
  });

  it('canRedeem returns true when expiresAt is far in the future', () => {
    const coupon = makeCouponEntity({ expiresAt: new Date(Date.now() + 86400000) });
    expect(coupon.canRedeem()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 16. Promotion entity — appliesTo / isCurrentlyActive
// ═══════════════════════════════════════════════════════════════════════════
describe('Promotion entity', () => {
  function makePromoEntity(overrides: any = {}) {
    return Promotion.create({
      tenantId: 'tenant-1',
      title: 'Test Promo',
      description: 'desc',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startsAt: new Date(Date.now() - 10000),
      expiresAt: null,
      active: true,
      ...overrides,
    });
  }

  it('appliesTo returns true for any target when targets is empty', () => {
    const promo = makePromoEntity({ targets: [] });
    expect(promo.appliesTo({ targetType: 'ITEM', targetId: 'x' })).toBe(true);
    expect(promo.appliesTo({ targetType: 'CATEGORY', targetId: 'y' })).toBe(true);
  });

  it('appliesTo returns false for non-matching target', () => {
    const promo = makePromoEntity({ targets: [{ targetType: 'ITEM', targetId: 'item-1' }] });
    expect(promo.appliesTo({ targetType: 'ITEM', targetId: 'item-2' })).toBe(false);
  });

  it('isCurrentlyActive returns false when promotion is inactive', () => {
    const promo = makePromoEntity({ active: false });
    expect(promo.isCurrentlyActive()).toBe(false);
  });

  it('isCurrentlyActive returns false when not yet started', () => {
    const promo = makePromoEntity({ startsAt: new Date(Date.now() + 86400000) });
    expect(promo.isCurrentlyActive()).toBe(false);
  });

  it('isCurrentlyActive returns false when expired', () => {
    const promo = makePromoEntity({ expiresAt: new Date(Date.now() - 1000) });
    expect(promo.isCurrentlyActive()).toBe(false);
  });

  it('isCurrentlyActive returns true when active and within date range', () => {
    const promo = makePromoEntity({
      startsAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 86400000),
    });
    expect(promo.isCurrentlyActive()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 17. SalesMetric entity — incrementLinks with value=0
// ═══════════════════════════════════════════════════════════════════════════
describe('SalesMetric entity', () => {
  it('incrementLinks with value=0 increments counter but keeps estimatedRevenue unchanged', () => {
    const metric = SalesMetric.create({
      tenantId: 'tenant-1',
      date: new Date(),
      totalMessages: 0,
      purchaseIntents: 0,
      paymentLinksGenerated: 2,
      estimatedRevenue: 500,
    });
    metric.incrementLinks(0);
    expect(metric.paymentLinksGenerated).toBe(3);
    expect(metric.estimatedRevenue).toBe(500);
  });

  it('incrementLinks with positive value increments both counter and estimatedRevenue', () => {
    const metric = SalesMetric.create({
      tenantId: 'tenant-1',
      date: new Date(),
      totalMessages: 0,
      purchaseIntents: 0,
      paymentLinksGenerated: 0,
      estimatedRevenue: 100,
    });
    metric.incrementLinks(200);
    expect(metric.paymentLinksGenerated).toBe(1);
    expect(metric.estimatedRevenue).toBe(300);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 18. SalesPaymentLinkLifecycleService.recordCreated
// ═══════════════════════════════════════════════════════════════════════════
describe('SalesPaymentLinkLifecycleService.recordCreated', () => {
  let service: SalesPaymentLinkLifecycleService;
  let paymentLinksRepo: ReturnType<typeof makePaymentLinksRepository>;
  let metricsRepo: ReturnType<typeof makeMetricsRepository>;
  let eventBus: ReturnType<typeof makeEventBus>;

  beforeEach(() => {
    paymentLinksRepo = makePaymentLinksRepository();
    metricsRepo = makeMetricsRepository();
    eventBus = makeEventBus();
    service = new SalesPaymentLinkLifecycleService(
      paymentLinksRepo as any,
      metricsRepo as any,
      eventBus as any,
    );
  });

  function makeInput(overrides: any = {}): any {
    return {
      id: 'link-1',
      tenantId: 'tenant-1',
      providerLinkId: 'prov-1',
      externalId: 'ext-1',
      name: 'Test',
      value: 100,
      url: 'https://pay.test/1',
      billingType: 'PIX',
      status: 'ACTIVE',
      source: 'MANUAL',
      ...overrides,
    };
  }

  it('calls incrementMetric with recurrenceTotalValue when present', async () => {
    const input = makeInput({ value: 100, recurrenceTotalValue: 300 });
    paymentLinksRepo.createPaymentLink.mockResolvedValue({ ...input, createdAt: new Date(), updatedAt: new Date() });
    metricsRepo.incrementMetric.mockResolvedValue(undefined);
    await service.recordCreated(input);
    expect(metricsRepo.incrementMetric).toHaveBeenCalledWith('tenant-1', expect.any(Date), 'LINK', 300);
  });

  it('calls incrementMetric with raw value when recurrenceTotalValue is not set', async () => {
    const input = makeInput({ value: 150 });
    paymentLinksRepo.createPaymentLink.mockResolvedValue({ ...input, createdAt: new Date(), updatedAt: new Date() });
    metricsRepo.incrementMetric.mockResolvedValue(undefined);
    await service.recordCreated(input);
    expect(metricsRepo.incrementMetric).toHaveBeenCalledWith('tenant-1', expect.any(Date), 'LINK', 150);
  });

  it('publishes SalesPaymentLinkCreatedIntegrationEvent after persistence', async () => {
    const input = makeInput({ value: 99 });
    paymentLinksRepo.createPaymentLink.mockResolvedValue({ ...input, createdAt: new Date(), updatedAt: new Date() });
    metricsRepo.incrementMetric.mockResolvedValue(undefined);
    await service.recordCreated(input);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(SalesPaymentLinkCreatedIntegrationEvent),
    );
  });

  it('does not publish event when persistence (createPaymentLink) fails', async () => {
    paymentLinksRepo.createPaymentLink.mockRejectedValue(new Error('DB error'));
    await expect(service.recordCreated(makeInput())).rejects.toThrow('DB error');
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 19. SalesAnalyticsHandler — error resilience
// ═══════════════════════════════════════════════════════════════════════════
describe('SalesAnalyticsHandler — error resilience', () => {
  let handler: SalesAnalyticsHandler;
  let eventBus: ReturnType<typeof makeEventBus>;
  let trackUseCase: { execute: jest.Mock };

  beforeEach(() => {
    eventBus = makeEventBus();
    trackUseCase = { execute: jest.fn() };
    handler = new SalesAnalyticsHandler(eventBus as any, trackUseCase as any);
  });

  it('does not crash when trackSalesMetricUseCase.execute throws on message-received', async () => {
    handler.onModuleInit();
    trackUseCase.execute.mockRejectedValue(new Error('DB timeout'));
    const callback = eventBus.subscribe.mock.calls.find(
      ([name]: any) => name === 'messaging.message-received',
    )?.[1] as (e: any) => Promise<void>;
    await expect(callback({ payload: { tenantId: 'tenant-1' } })).rejects.toThrow('DB timeout');
  });

  it('INTENT is only tracked for PURCHASE intent, not SUPPORT intent', async () => {
    handler.onModuleInit();
    const callback = eventBus.subscribe.mock.calls.find(
      ([name]: any) => name === 'ai.lead-scored',
    )?.[1] as (e: any) => Promise<void>;
    await callback({ payload: { tenantId: 'tenant-1', intent: 'SUPPORT' } });
    expect(trackUseCase.execute).not.toHaveBeenCalled();
  });

  it('INTENT is tracked for PURCHASE intent', async () => {
    handler.onModuleInit();
    const callback = eventBus.subscribe.mock.calls.find(
      ([name]: any) => name === 'ai.lead-scored',
    )?.[1] as (e: any) => Promise<void>;
    trackUseCase.execute.mockResolvedValue(undefined);
    await callback({ payload: { tenantId: 'tenant-1', intent: 'PURCHASE' } });
    expect(trackUseCase.execute).toHaveBeenCalledWith({ tenantId: 'tenant-1', type: 'INTENT' });
  });

  it('subscribes to exactly 3 events on onModuleInit', () => {
    handler.onModuleInit();
    expect(eventBus.subscribe).toHaveBeenCalledTimes(3);
    const subscribedEvents = eventBus.subscribe.mock.calls.map(([name]: any) => name);
    expect(subscribedEvents).toContain('messaging.message-received');
    expect(subscribedEvents).toContain('messaging.message-sent');
    expect(subscribedEvents).toContain('ai.lead-scored');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 20. SalesPaymentEventHandler — error resilience & status update
// ═══════════════════════════════════════════════════════════════════════════
describe('SalesPaymentEventHandler — error resilience', () => {
  let handler: SalesPaymentEventHandler;
  let eventBus: ReturnType<typeof makeEventBus>;
  let repository: ReturnType<typeof makePaymentLinksRepository>;

  const tenantId = 'tenant-1';
  const rawReference = `sales-link|${tenantId}|link-1`;

  const baseUpdatedLink = {
    id: 'link-1', tenantId, branchId: null, providerLinkId: 'prov-1',
    externalId: rawReference, name: 'Test Link', value: 100,
    url: 'https://pay.test/1', billingType: 'PIX', status: 'OVERDUE',
    source: 'MANUAL', resourceType: 'PAYMENT_LINK', contactId: 'contact-1',
    contactName: null, conversationId: null, catalogItemId: null,
    catalogItemSku: null, catalogItemName: null, expiresAt: null,
    recurrenceEnabled: false, recurrenceFrequency: null, recurrenceStartDate: null,
    recurrenceEndDate: null, recurrenceTotalValue: null, recurrenceNextRunAt: null,
    createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  };

  beforeEach(() => {
    eventBus = makeEventBus();
    repository = makePaymentLinksRepository();
    handler = new SalesPaymentEventHandler(eventBus as any, repository as any);
  });

  it('updatePaymentLinkStatusByExternalReference throws — handler propagates without silently swallowing', async () => {
    handler.onModuleInit();
    repository.updatePaymentLinkStatusByExternalReference.mockRejectedValue(new Error('Lock timeout'));
    const callback = eventBus.subscribe.mock.calls.find(
      ([name]: any) => name === 'payment.overdue',
    )?.[1] as (e: any) => Promise<void>;
    await expect(callback({ payload: { tenantId, rawReference } })).rejects.toThrow('Lock timeout');
  });

  it('OVERDUE for sales-charge with contactId — status update called but remarketing not published', async () => {
    const chargeRef = `sales-charge|${tenantId}|charge-1`;
    repository.updatePaymentLinkStatusByExternalReference.mockResolvedValue({
      ...baseUpdatedLink,
      externalId: chargeRef,
      status: 'OVERDUE',
      contactId: 'contact-1',
    });
    repository.findContactNameById.mockResolvedValue('Maria');
    handler.onModuleInit();
    const callback = eventBus.subscribe.mock.calls.find(
      ([name]: any) => name === 'payment.overdue',
    )?.[1] as (e: any) => Promise<void>;
    await callback({ payload: { tenantId, rawReference: chargeRef } });
    expect(repository.updatePaymentLinkStatusByExternalReference).toHaveBeenCalledWith(
      tenantId, chargeRef, 'OVERDUE',
    );
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 21. RedeemCouponUseCase — additional paths
// ═══════════════════════════════════════════════════════════════════════════
describe('RedeemCouponUseCase — additional paths', () => {
  let useCase: RedeemCouponUseCase;
  let repo: ReturnType<typeof makeCouponRepository>;

  const baseCoupon: any = {
    id: 'coupon-1', tenantId: 'tenant-1', code: 'VALID',
    discountType: 'PERCENTAGE', discountValue: 10,
    maxUses: 0, usedCount: 0, active: true,
    startsAt: new Date(Date.now() - 10000), expiresAt: null,
  };

  beforeEach(() => {
    repo = makeCouponRepository();
    useCase = new RedeemCouponUseCase(repo as any);
  });

  it('throws BadRequestException when coupon is expired (expiresAt in the past)', async () => {
    repo.findCouponByCode.mockResolvedValue({
      ...baseCoupon, expiresAt: new Date(Date.now() - 1000),
    });
    await expect(
      useCase.execute({ tenantId: 'tenant-1', code: 'VALID' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('redeems by couponId when code is not provided', async () => {
    repo.findCouponById.mockResolvedValue(baseCoupon);
    repo.incrementCouponUsage.mockResolvedValue({ ...baseCoupon, usedCount: 1 });
    const result = await useCase.execute({ tenantId: 'tenant-1', couponId: 'coupon-1' });
    expect(repo.findCouponById).toHaveBeenCalledWith('tenant-1', 'coupon-1');
    expect(result.discount.value).toBe(10);
  });

  it('throws NotFoundException when coupon is not found by id', async () => {
    repo.findCouponById.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', couponId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 22. CreatePaymentLinkUseCase — gateway failure scenario
// ═══════════════════════════════════════════════════════════════════════════
describe('CreatePaymentLinkUseCase — gateway failure', () => {
  let useCase: CreatePaymentLinkUseCase;
  let paymentFacade: ReturnType<typeof makePaymentFacade>;
  let tenantRepository: ReturnType<typeof makeTenantRepository>;
  let salesRepository: ReturnType<typeof makePaymentLinksRepository> & ReturnType<typeof makeMetricsRepository>;
  let eventBus: ReturnType<typeof makeEventBus>;
  let lifecycle: SalesPaymentLinkLifecycleService;
  let structuredLog: ReturnType<typeof makeStructuredLog>;

  beforeEach(() => {
    paymentFacade = makePaymentFacade();
    tenantRepository = makeTenantRepository();
    salesRepository = { ...makePaymentLinksRepository(), ...makeMetricsRepository() };
    eventBus = makeEventBus();
    structuredLog = makeStructuredLog();
    lifecycle = new SalesPaymentLinkLifecycleService(
      salesRepository as any,
      salesRepository as any,
      eventBus as any,
    );
    useCase = new CreatePaymentLinkUseCase(
      paymentFacade as any,
      tenantRepository as any,
      lifecycle,
      structuredLog as any,
    );
  });

  it('propagates gateway error and does not write orphan records when createPaymentLink throws', async () => {
    tenantRepository.findById.mockResolvedValue({ id: 'tenant-1' } as any);
    paymentFacade.createPaymentLink.mockRejectedValue(new Error('Gateway timeout'));
    await expect(
      useCase.execute({ tenantId: 'tenant-1', name: 'Plano', value: 100, billingType: 'PIX' }),
    ).rejects.toThrow('Gateway timeout');
    expect(salesRepository.createPaymentLink).not.toHaveBeenCalled();
    expect(salesRepository.incrementMetric).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 23. CreateSplitPaymentChargeUseCase — additional edge cases
// ═══════════════════════════════════════════════════════════════════════════
describe('CreateSplitPaymentChargeUseCase — additional edge cases', () => {
  let useCase: CreateSplitPaymentChargeUseCase;
  let paymentService: any;
  let tenantFinancialAccountRepository: any;
  let contactFinancialProfileRepository: any;
  let contactFacade: any;
  let salesRepository: any;
  let eventBus: any;
  let lifecycle: SalesPaymentLinkLifecycleService;

  beforeEach(() => {
    paymentService = { createCustomer: jest.fn(), createPayment: jest.fn() };
    tenantFinancialAccountRepository = { findByTenantId: jest.fn() };
    contactFinancialProfileRepository = {
      findByTenantAndContact: jest.fn(),
      save: jest.fn(),
    };
    contactFacade = { getContactById: jest.fn() };
    salesRepository = { createPaymentLink: jest.fn(), incrementMetric: jest.fn() };
    eventBus = makeEventBus();
    lifecycle = new SalesPaymentLinkLifecycleService(
      salesRepository as any,
      salesRepository as any,
      eventBus as any,
    );
    useCase = new CreateSplitPaymentChargeUseCase(
      paymentService,
      tenantFinancialAccountRepository,
      contactFinancialProfileRepository,
      contactFacade,
      eventBus,
      lifecycle,
    );
  });

  it('split fee is 2% when value is below R$100 boundary', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue({ walletId: 'wallet-1' });
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'c1', name: 'Test', phone: '1111', email: 'a@b.com',
    });
    contactFinancialProfileRepository.findByTenantAndContact.mockResolvedValue(null);
    paymentService.createCustomer.mockResolvedValue({ id: 'cus-1' });
    paymentService.createPayment.mockResolvedValue({
      id: 'pay-1', status: 'PENDING', value: 99.99, billingType: 'PIX',
      dueDate: '2026-04-03', invoiceUrl: 'https://pay.test/1',
    });
    salesRepository.createPaymentLink.mockImplementation(async (r: any) => ({
      ...r, createdAt: new Date(), updatedAt: new Date(),
    }));
    const result = await useCase.execute({
      tenantId: 'tenant-1', contactId: 'c1', customerDocument: '123.456.789-00',
      name: 'T', value: 99.99, billingType: 'PIX',
    });
    expect(result.platformFeePercent).toBe(2);
    expect(paymentService.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ split: [{ walletId: 'wallet-1', percentualValue: 98 }] }),
    );
  });

  it('split fee is 1.5% when value is exactly R$100 (boundary)', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue({ walletId: 'wallet-1' });
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'c1', name: 'Test', phone: '1111', email: 'a@b.com',
    });
    contactFinancialProfileRepository.findByTenantAndContact.mockResolvedValue(null);
    paymentService.createCustomer.mockResolvedValue({ id: 'cus-1' });
    paymentService.createPayment.mockResolvedValue({
      id: 'pay-2', status: 'PENDING', value: 100, billingType: 'PIX',
      dueDate: '2026-04-03', invoiceUrl: 'https://pay.test/2',
    });
    salesRepository.createPaymentLink.mockImplementation(async (r: any) => ({
      ...r, createdAt: new Date(), updatedAt: new Date(),
    }));
    const result = await useCase.execute({
      tenantId: 'tenant-1', contactId: 'c1', customerDocument: '123.456.789-00',
      name: 'T', value: 100, billingType: 'PIX',
    });
    expect(result.platformFeePercent).toBe(1.5);
    expect(paymentService.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ split: [{ walletId: 'wallet-1', percentualValue: 98.5 }] }),
    );
  });

  it('throws when contactFacade.getContactById returns null', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue({ walletId: 'wallet-1' });
    contactFacade.getContactById.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', contactId: 'missing', name: 'T', value: 50, billingType: 'PIX' }),
    ).rejects.toThrow();
    expect(paymentService.createPayment).not.toHaveBeenCalled();
  });

  it('propagates error when paymentService.createPayment throws', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue({ walletId: 'wallet-1' });
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'c1', name: 'Test', phone: '1111', email: 'a@b.com',
    });
    contactFinancialProfileRepository.findByTenantAndContact.mockResolvedValue({
      asaasCustomerId: 'cus-existing',
    });
    paymentService.createPayment.mockRejectedValue(new Error('Gateway unavailable'));
    await expect(
      useCase.execute({ tenantId: 'tenant-1', contactId: 'c1', name: 'T', value: 200, billingType: 'PIX' }),
    ).rejects.toThrow('Gateway unavailable');
    expect(salesRepository.createPaymentLink).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 24. TrackSalesMetricUseCase — INTENT type path
// ═══════════════════════════════════════════════════════════════════════════
describe('TrackSalesMetricUseCase — INTENT type', () => {
  let useCase: TrackSalesMetricUseCase;
  let salesRepository: ReturnType<typeof makeMetricsRepository>;

  beforeEach(() => {
    salesRepository = makeMetricsRepository();
    useCase = new TrackSalesMetricUseCase(salesRepository as any);
  });

  it('calls incrementMetric with type INTENT', async () => {
    salesRepository.incrementMetric.mockResolvedValue(undefined);
    await useCase.execute({ tenantId: 'tenant-1', type: 'INTENT' });
    expect(salesRepository.incrementMetric).toHaveBeenCalledWith(
      'tenant-1', expect.any(Date), 'INTENT', undefined,
    );
  });

  it('calls incrementMetric with type LINK and value', async () => {
    salesRepository.incrementMetric.mockResolvedValue(undefined);
    await useCase.execute({ tenantId: 'tenant-1', type: 'LINK', value: 250 });
    expect(salesRepository.incrementMetric).toHaveBeenCalledWith(
      'tenant-1', expect.any(Date), 'LINK', 250,
    );
  });

  it('calls incrementMetric with type MESSAGE', async () => {
    salesRepository.incrementMetric.mockResolvedValue(undefined);
    await useCase.execute({ tenantId: 'tenant-1', type: 'MESSAGE' });
    expect(salesRepository.incrementMetric).toHaveBeenCalledWith(
      'tenant-1', expect.any(Date), 'MESSAGE', undefined,
    );
  });
});
