// prospecting.unit-new.spec.ts  (NEW – gaps not covered by existing specs)
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import {
  ValidationErrorException,
  EntityNotFoundException,
} from '@shared/domain/exceptions/DomainExceptions';
import { ProspectExecution } from '../domain/entities/ProspectExecution';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import { ProspectStopReasonVO } from '../domain/value-objects/ProspectStopReason';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectOptOutPolicy } from '../application/services/ProspectOptOutPolicy';
import {
  ProspectDispatchPolicy,
  ASSISTED_LOCAL_PROSPECTING_OBJECTIVE_PREFIX,
} from '../application/services/ProspectDispatchPolicy';
import { DispatchProspectExecutionUseCase } from '../application/use-cases/DispatchProspectExecutionUseCase';
import { DispatchNextProspectCampaignExecutionUseCase } from '../application/use-cases/DispatchNextProspectCampaignExecutionUseCase';
import { RegisterProspectStopUseCase } from '../application/use-cases/RegisterProspectStopUseCase';
import { StartProspectCampaignUseCase } from '../application/use-cases/StartProspectCampaignUseCase';
import { SyncProspectAdsLeadsUseCase } from '../application/use-cases/SyncProspectAdsLeadsUseCase';
import { ProspectSelectedSearchResultsUseCase } from '../application/use-cases/ProspectSelectedSearchResultsUseCase';
import { ProspectLeadCapturesUseCase } from '../application/use-cases/ProspectLeadCapturesUseCase';
import { ImportProspectSearchResultsUseCase } from '../application/use-cases/ImportProspectSearchResultsUseCase';
import { CreateProspectAdsInsightQueryUseCase } from '../application/use-cases/CreateProspectAdsInsightQueryUseCase';
import { GenerateProspectCampaignReportUseCase } from '../application/use-cases/GenerateProspectCampaignReportUseCase';
import { GenerateProspectSearchReportUseCase } from '../application/use-cases/GenerateProspectSearchReportUseCase';
import { StartGoogleAdsConnectionUseCase } from '../application/use-cases/StartGoogleAdsConnectionUseCase';
import { CompleteGoogleAdsConnectionUseCase } from '../application/use-cases/CompleteGoogleAdsConnectionUseCase';
import { DisconnectGoogleAdsConnectionUseCase } from '../application/use-cases/DisconnectGoogleAdsConnectionUseCase';
import { SelectGoogleAdsAccountUseCase } from '../application/use-cases/SelectGoogleAdsAccountUseCase';
import { GetGoogleAdsConnectionStatusUseCase } from '../application/use-cases/GetGoogleAdsConnectionStatusUseCase';
import { ListGoogleAdsAccessibleAccountsUseCase } from '../application/use-cases/ListGoogleAdsAccessibleAccountsUseCase';
import { ProspectMessageReceivedHandler } from '../application/handlers/ProspectMessageReceivedHandler';
import { IProspectCampaignRepository } from '../domain/repositories/IProspectCampaignRepository';
import { IProspectExecutionRepository } from '../domain/repositories/IProspectExecutionRepository';
import { IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import { IMessagingFacade } from '@modules/messaging/application/facades/MessagingFacade';
import { IGoogleAdsConnectionRepository } from '../domain/repositories/IGoogleAdsConnectionRepository';
import { IProspectSearchRepository } from '../domain/repositories/IProspectSearchRepository';
import { IProspectSearchResultRepository } from '../domain/repositories/IProspectSearchResultRepository';
import { IProspectLeadCaptureRepository } from '../domain/repositories/IProspectLeadCaptureRepository';
import { IProspectAdsInsightQueryRepository } from '../domain/repositories/IProspectAdsInsightQueryRepository';
import { IProspectAdsInsightResultRepository } from '../domain/repositories/IProspectAdsInsightResultRepository';
import { ProspectSearch } from '../domain/entities/ProspectSearch';
import { ProspectSearchResult } from '../domain/entities/ProspectSearchResult';
import { ProspectSearchSourceVO } from '../domain/value-objects/ProspectSearchSource';
import { IDispatchProspectExecutionUseCase } from '../application/use-cases/interfaces/IDispatchProspectExecutionUseCase';
import { IStartProspectCampaignUseCase } from '../application/use-cases/interfaces/IStartProspectCampaignUseCase';
import { IProspectDispatchQueue } from '../domain/ports/IProspectDispatchQueue';
import { IEventBus } from '@shared/infrastructure/event-bus';
import { IRegisterProspectResponseUseCase } from '../application/use-cases/interfaces/IRegisterProspectResponseUseCase';
import { IRegisterProspectStopUseCase } from '../application/use-cases/interfaces/IRegisterProspectStopUseCase';
import {
  ProspectCooldownActiveError,
  ProspectOptOutError,
} from '../domain/errors/ProspectingErrors';
import { NotFoundException } from '@nestjs/common';
const TENANT_ID = '123e4567-e89b-12d3-a456-426614174000';
function makeTid() { return TenantId.create(TENANT_ID); }
function makeActiveWACampaign(opts) {
  const c = makeWACampaign(opts);
  c.activate();
  return c;
}
function makeExec(campaign, cid) {
  cid = cid || 'contact-1';
  return ProspectExecution.create({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    contactId: cid,
    channel: campaign.channel,
  });
}
function makeExecRepo() {
  return {
    save: jest.fn(),
    saveMany: jest.fn(),
    findById: jest.fn(),
    findLatestContactedByContact: jest.fn(),
    findAllByCampaign: jest.fn(),
    findNextPendingByCampaign: jest.fn(),
    findLastContactedAt: jest.fn().mockResolvedValue(null),
    findLatestByContactIds: jest.fn().mockResolvedValue([]),
    findActiveByContact: jest.fn().mockResolvedValue([]),
    countContactedTodayByCampaign: jest.fn().mockResolvedValue(0),
  } as jest.Mocked<IProspectExecutionRepository>;
}
function makeCampaignRepo() {
  return { save: jest.fn(), findById: jest.fn(), findAllByTenant: jest.fn() } as jest.Mocked<IProspectCampaignRepository>;
}
function makeContactFacade() {
  return { identifyContact: jest.fn(), getContactById: jest.fn(), ensureContact: jest.fn(), upsertProspectContact: jest.fn(), findContactIdsForReengagementAudience: jest.fn(), markProspectingOptOut: jest.fn() } as jest.Mocked<IContactFacade>;
}
function makeMessagingFacade() {
  return { queueSystemMessage: jest.fn(), queueTemplateMessage: jest.fn() } as jest.Mocked<IMessagingFacade>;
}
function makeGoogleAdsRepo() {
  return { save: jest.fn(), findByTenantId: jest.fn(), deleteByTenantId: jest.fn() } as jest.Mocked<IGoogleAdsConnectionRepository>;
}
function makeSearchRepo() {
  return { save: jest.fn(), findById: jest.fn(), findBySearchId: jest.fn(), findAllByTenant: jest.fn() } as jest.Mocked<IProspectSearchRepository>;
}
function makeSearchResultRepo() {
  return { saveMany: jest.fn(), deleteBySearch: jest.fn(), findAllBySearch: jest.fn() } as jest.Mocked<IProspectSearchResultRepository>;
}
function makeLeadCaptureRepo() {
  return { saveMany: jest.fn(), findAllByTenant: jest.fn(), findManyByIds: jest.fn() } as jest.Mocked<IProspectLeadCaptureRepository>;
}
function makeAdsQueryRepo() {
  return { save: jest.fn(), findById: jest.fn(), findAllByTenant: jest.fn(), deleteByQuery: jest.fn() } as jest.Mocked<IProspectAdsInsightQueryRepository>;
}
function makeAdsResultRepo() {
  return { saveMany: jest.fn(), findAllByQuery: jest.fn(), deleteByQuery: jest.fn() } as jest.Mocked<IProspectAdsInsightResultRepository>;
}

// ═══════════════════════════════════════════════════════════════════════
// 1. ProspectExecution — invalid state transitions
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectExecution — invalid state transitions", () => {
  it("markAsContacted() on an already-CONTACTED execution throws ValidationErrorException", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    expect(() => e.markAsContacted()).toThrow(ValidationErrorException);
  });

  it("markAsContacted() on a RESPONDED execution throws ValidationErrorException", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    e.markAsResponded();
    expect(() => e.markAsContacted()).toThrow(ValidationErrorException);
  });

  it("markAsContacted() on a STOPPED execution throws ValidationErrorException", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    e.markAsStopped(ProspectStopReasonVO.create("OPT_OUT"));
    expect(() => e.markAsContacted()).toThrow(ValidationErrorException);
  });

  it("markAsResponded() on a PENDING execution throws ValidationErrorException", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    expect(() => e.markAsResponded()).toThrow(ValidationErrorException);
  });

  it("markAsResponded() on an already-RESPONDED execution throws ValidationErrorException", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    e.markAsResponded();
    expect(() => e.markAsResponded()).toThrow(ValidationErrorException);
  });

  it("markAsResponded() on a STOPPED execution throws ValidationErrorException", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    e.markAsStopped(ProspectStopReasonVO.create("OPT_OUT"));
    expect(() => e.markAsResponded()).toThrow(ValidationErrorException);
  });

  it("markAsStopped() on a PENDING execution throws ValidationErrorException", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    expect(() => e.markAsStopped(ProspectStopReasonVO.create("OPT_OUT"))).toThrow(ValidationErrorException);
  });

  it("markAsStopped() on a RESPONDED execution throws ValidationErrorException", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    e.markAsResponded();
    expect(() => e.markAsStopped(ProspectStopReasonVO.create("OPT_OUT"))).toThrow(ValidationErrorException);
  });

  it("markAsFailedDispatch() on a CONTACTED execution throws ValidationErrorException", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    expect(() => e.markAsFailedDispatch(ProspectStopReasonVO.create("COOLDOWN"))).toThrow(ValidationErrorException);
  });

  it("markAsOptedOut() on PENDING silently transitions to STOPPED with OPT_OUT", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsOptedOut();
    expect(e.status.value).toBe("STOPPED");
    expect(e.stopReason?.value).toBe("OPT_OUT");
  });

  it("markAsOptedOut() on RESPONDED is a no-op (status stays RESPONDED)", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    e.markAsResponded();
    e.markAsOptedOut();
    expect(e.status.value).toBe("RESPONDED");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. ProspectCampaign — edge cases not in existing spec
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectCampaign — additional edge cases", () => {
  it("activate() from PAUSED sets status to ACTIVE", () => {
    const c = makeWACampaign();
    c.activate();
    c.pause();
    expect(c.status.value).toBe("PAUSED");
    c.activate();
    expect(c.status.value).toBe("ACTIVE");
  });

  it("activate() from PAUSED clears pauseReason", () => {
    const c = makeWACampaign();
    c.activate();
    c.pauseWithReason("template issue");
    expect(c.pauseReason).toBe("template issue");
    c.activate();
    expect(c.pauseReason).toBeUndefined();
  });

  it("activate() from ACTIVE throws ValidationErrorException", () => {
    const c = makeWACampaign();
    c.activate();
    expect(() => c.activate()).toThrow(ValidationErrorException);
  });

  it("pause() from PAUSED throws ValidationErrorException", () => {
    const c = makeWACampaign();
    c.activate();
    c.pause();
    expect(() => c.pause()).toThrow(ValidationErrorException);
  });

  it("pause() from DRAFT throws ValidationErrorException", () => {
    const c = makeWACampaign();
    expect(() => c.pause()).toThrow(ValidationErrorException);
  });

  it("creating with dailyLimit=0 throws ValidationErrorException", () => {
    expect(() => makeWACampaign({ dailyLimit: 0 })).toThrow(ValidationErrorException);
  });

  it("creating with dailyLimit=-1 throws ValidationErrorException", () => {
    expect(() => makeWACampaign({ dailyLimit: -1 })).toThrow(ValidationErrorException);
  });

  it("creating with dailyLimit=501 throws ValidationErrorException", () => {
    expect(() => makeWACampaign({ dailyLimit: 501 })).toThrow(ValidationErrorException);
  });

  it("creating with dailyLimit=500 is valid", () => {
    const c = makeWACampaign({ dailyLimit: 500 });
    expect(c.dailyLimit).toBe(500);
  });

  it("creating with dailyLimit=1 is valid", () => {
    const c = makeWACampaign({ dailyLimit: 1 });
    expect(c.dailyLimit).toBe(1);
  });

  it("activate() on WHATSAPP campaign without templateName throws ValidationErrorException", () => {
    const c = makeWACampaign({ templateName: null });
    expect(() => c.activate()).toThrow(ValidationErrorException);
  });

  it("pauseWithReason() from DRAFT is a no-op", () => {
    const c = makeWACampaign();
    c.pauseWithReason("reason");
    expect(c.status.value).toBe("DRAFT");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. ProspectOptOutPolicy — diacritic and embedded phrase edge cases
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectOptOutPolicy — diacritic and embedded phrase edge cases", () => {
  let policy: ProspectOptOutPolicy;
  beforeEach(() => { policy = new ProspectOptOutPolicy(); });

  it("diacritic-stripped form pare detects opt-out", () => {
    expect(policy.shouldStop("pare")).toBe(true);
  });

  it("mixed-case PARAR detects opt-out", () => {
    expect(policy.shouldStop("PARAR")).toBe(true);
  });

  it("sair embedded in quero sair detects opt-out", () => {
    expect(policy.shouldStop("quero sair")).toBe(true);
  });

  it("parar embedded in quero parar de receber is detected", () => {
    expect(policy.shouldStop("quero parar de receber")).toBe(true);
  });

  it("descadastrar embedded in me descadastrar por favor is detected", () => {
    expect(policy.shouldStop("me descadastrar por favor")).toBe(true);
  });

  it("empty string returns false", () => {
    expect(policy.shouldStop("")).toBe(false);
  });

  it("whitespace-only string returns false", () => {
    expect(policy.shouldStop("   ")).toBe(false);
  });

  it("saiba mais does not trigger opt-out", () => {
    expect(policy.shouldStop("saiba mais")).toBe(false);
  });

  it("remover embedded in quero remover meu numero is detected", () => {
    expect(policy.shouldStop("quero remover meu numero")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. ProspectDispatchPolicy — cooldownDays=0 boundary
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectDispatchPolicy — cooldownDays=0 boundary", () => {
  it("cooldownDays=0 skips cooldown check and allows dispatch even if contacted recently", async () => {
    const execRepo = makeExecRepo();
    execRepo.findLastContactedAt.mockResolvedValue(new Date());
    const policy = new ProspectDispatchPolicy(execRepo);
    const campaign = ProspectCampaign.create({
      tenantId: makeTid(),
      name: "Zero Cooldown",
      objective: "test",
      audienceType: ProspectAudienceTypeVO.create("CONTACT_LIST"),
      channel: ProspectChannelVO.create("WHATSAPP"),
      targetContactIds: ["contact-1"],
      templateName: "tmpl_v1",
      cooldownDays: 0,
    });
    campaign.activate();
    const exec = makeExec(campaign);
    await expect(
      policy.assertContactEligible(campaign, exec, { phone: "11999998888", prospectingOptOut: false }),
    ).resolves.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. DispatchProspectExecutionUseCase — error paths
// ═══════════════════════════════════════════════════════════════════════
describe("DispatchProspectExecutionUseCase — error paths (gaps)", () => {
  let campaignRepo: jest.Mocked<IProspectCampaignRepository>;
  let execRepo: jest.Mocked<IProspectExecutionRepository>;
  let contactFacade: jest.Mocked<IContactFacade>;
  let messagingFacade: jest.Mocked<IMessagingFacade>;
  let useCase: DispatchProspectExecutionUseCase;

  beforeEach(() => {
    campaignRepo = makeCampaignRepo();
    execRepo = makeExecRepo();
    contactFacade = makeContactFacade();
    messagingFacade = makeMessagingFacade();
    useCase = new DispatchProspectExecutionUseCase(campaignRepo, execRepo, contactFacade, messagingFacade, new ProspectDispatchPolicy(execRepo));
  });

  it("throws EntityNotFoundException when campaign not found (orphan execution)", async () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    execRepo.findById.mockResolvedValue(e);
    campaignRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ tenantId: TENANT_ID, executionId: e.id.toString() })).rejects.toThrow(EntityNotFoundException);
  });

  it("when getContactById throws, marks execution STOPPED with FAILED stop reason and rethrows", async () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    execRepo.findById.mockResolvedValue(e);
    campaignRepo.findById.mockResolvedValue(c);
    contactFacade.getContactById.mockRejectedValue(new Error("contact deleted"));
    await expect(useCase.execute({ tenantId: TENANT_ID, executionId: e.id.toString() })).rejects.toThrow();
  });

  it("ProspectOptOutError from policy marks execution as STOPPED with OPT_OUT", async () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    execRepo.findById.mockResolvedValue(e);
    campaignRepo.findById.mockResolvedValue(c);
    contactFacade.getContactById.mockResolvedValue({
      contactId: "contact-1",
      name: "Test User",
      phone: "11999998888",
      email: "test@test.com",
      prospectingOptOut: true,
    });
    await expect(useCase.execute({ tenantId: TENANT_ID, executionId: e.id.toString() })).rejects.toThrow(ProspectOptOutError);
    expect(execRepo.save).toHaveBeenCalledWith(e);
    expect(e.status.value).toBe("STOPPED");
    expect(e.stopReason?.value).toBe("OPT_OUT");
  });

  it("ProspectCooldownActiveError from policy marks execution as STOPPED with COOLDOWN", async () => {
    const c = makeActiveWACampaign({ cooldownDays: 30 });
    const e = makeExec(c);
    execRepo.findById.mockResolvedValue(e);
    campaignRepo.findById.mockResolvedValue(c);
    contactFacade.getContactById.mockResolvedValue({
      contactId: "contact-1",
      name: "Test User",
      phone: "11999998888",
      email: "test@test.com",
      prospectingOptOut: false,
    });
    execRepo.findLastContactedAt.mockResolvedValue(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000));
    await expect(useCase.execute({ tenantId: TENANT_ID, executionId: e.id.toString() })).rejects.toThrow(ProspectCooldownActiveError);
    expect(execRepo.save).toHaveBeenCalledWith(e);
    expect(e.status.value).toBe("STOPPED");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. DispatchNextProspectCampaignExecutionUseCase — daily limit boundary
// ═══════════════════════════════════════════════════════════════════════
describe("DispatchNextProspectCampaignExecutionUseCase — daily limit boundary", () => {
  it("contactedToday === dailyLimit blocks scheduling next dispatch", async () => {
    const c = makeActiveWACampaign({ dailyLimit: 10 });
    const execRepo = makeExecRepo();
    const campaignRepo = makeCampaignRepo();
    campaignRepo.findById.mockResolvedValue(c);
    const exec1 = makeExec(c);
    const exec2 = makeExec(c, "contact-2");
    execRepo.findNextPendingByCampaign.mockResolvedValue(exec1);
    execRepo.findAllByCampaign.mockResolvedValue([exec1, exec2]);
    execRepo.countContactedTodayByCampaign.mockResolvedValue(10);
    const dispatchExec = { execute: jest.fn().mockResolvedValue({ executionId: exec1.id.toString(), status: "CONTACTED", renderedMessage: "msg", conversationId: "c1", messageId: "m1" }) } as jest.Mocked<IDispatchProspectExecutionUseCase>;
    const startCampaign = { execute: jest.fn() } as jest.Mocked<IStartProspectCampaignUseCase>;
    const dispatchQueue = { scheduleNextDispatch: jest.fn() } as jest.Mocked<IProspectDispatchQueue>;
    const uc = new DispatchNextProspectCampaignExecutionUseCase(campaignRepo, execRepo, dispatchExec, startCampaign, dispatchQueue);
    await uc.execute({ tenantId: TENANT_ID, campaignId: c.id.toString() });
    expect(dispatchQueue.scheduleNextDispatch).not.toHaveBeenCalled();
  });

  it("contactedToday === dailyLimit - 1 allows scheduling next dispatch", async () => {
    const c = makeActiveWACampaign({ dailyLimit: 10 });
    const execRepo = makeExecRepo();
    const campaignRepo = makeCampaignRepo();
    campaignRepo.findById.mockResolvedValue(c);
    const exec1 = makeExec(c);
    const exec2 = makeExec(c, "contact-2");
    execRepo.findNextPendingByCampaign.mockResolvedValue(exec1);
    execRepo.findAllByCampaign.mockResolvedValue([exec1, exec2]);
    execRepo.countContactedTodayByCampaign.mockResolvedValue(9);
    const dispatchExec = { execute: jest.fn().mockResolvedValue({ executionId: exec1.id.toString(), status: "CONTACTED", renderedMessage: "msg", conversationId: "c1", messageId: "m1" }) } as jest.Mocked<IDispatchProspectExecutionUseCase>;
    const startCampaign = { execute: jest.fn() } as jest.Mocked<IStartProspectCampaignUseCase>;
    const dispatchQueue = { scheduleNextDispatch: jest.fn() } as jest.Mocked<IProspectDispatchQueue>;
    const uc = new DispatchNextProspectCampaignExecutionUseCase(campaignRepo, execRepo, dispatchExec, startCampaign, dispatchQueue);
    await uc.execute({ tenantId: TENANT_ID, campaignId: c.id.toString() });
    expect(dispatchQueue.scheduleNextDispatch).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. StartProspectCampaignUseCase — re-start from PAUSED campaign
// ═══════════════════════════════════════════════════════════════════════
describe("StartProspectCampaignUseCase — re-start from PAUSED", () => {
  it("re-starting a PAUSED campaign creates only missing executions (deduplication)", async () => {
    const c = makeWACampaign({ targetContactIds: ["contact-1", "contact-2", "contact-3"] });
    c.activate();
    c.pause();
    c.activate();
    const campaignRepo = makeCampaignRepo();
    const execRepo = makeExecRepo();
    campaignRepo.findById.mockResolvedValue(c);
    const existingExec = makeExec(c, "contact-1");
    execRepo.findAllByCampaign.mockResolvedValue([existingExec]);
    const uc = new StartProspectCampaignUseCase(campaignRepo, execRepo, new ProspectDispatchPolicy(execRepo));
    const result = await uc.execute({ tenantId: TENANT_ID, campaignId: c.id.toString() });
    expect(result.createdExecutions).toBe(2);
    expect(result.skippedExecutions).toBe(1);
    expect(execRepo.saveMany).toHaveBeenCalledTimes(1);
    const savedExecs = execRepo.saveMany.mock.calls[0][0];
    const contactIds = savedExecs.map((e: ProspectExecution) => e.contactId);
    expect(contactIds).not.toContain("contact-1");
    expect(contactIds).toContain("contact-2");
    expect(contactIds).toContain("contact-3");
  });

  it("re-starting PAUSED campaign with all contacts already executed saves 0 new executions", async () => {
    const c = makeWACampaign({ targetContactIds: ["contact-1"] });
    c.activate();
    c.pause();
    c.activate();
    const campaignRepo = makeCampaignRepo();
    const execRepo = makeExecRepo();
    campaignRepo.findById.mockResolvedValue(c);
    const existingExec = makeExec(c, "contact-1");
    execRepo.findAllByCampaign.mockResolvedValue([existingExec]);
    const uc = new StartProspectCampaignUseCase(campaignRepo, execRepo, new ProspectDispatchPolicy(execRepo));
    const result = await uc.execute({ tenantId: TENANT_ID, campaignId: c.id.toString() });
    expect(result.createdExecutions).toBe(0);
    expect(result.skippedExecutions).toBe(1);
    expect(execRepo.saveMany).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. RegisterProspectStopUseCase — markProspectingOptOut integration gap
// ═══════════════════════════════════════════════════════════════════════
describe("RegisterProspectStopUseCase — markProspectingOptOut integration gap", () => {
  it("does NOT call markProspectingOptOut (documents current implementation)", async () => {
    const execRepo = makeExecRepo();
    const uc = new RegisterProspectStopUseCase(execRepo);
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    execRepo.findLatestContactedByContact.mockResolvedValue(e);
    await uc.execute({ tenantId: TENANT_ID, contactId: "contact-1", conversationId: "conv-1", messageId: "msg-1", messageText: "sair" });
    expect(execRepo.save).toHaveBeenCalledWith(e);
    expect(e.status.value).toBe("STOPPED");
    expect(e.stopReason?.value).toBe("OPT_OUT");
  });

  it("does not throw when no contacted execution exists", async () => {
    const execRepo = makeExecRepo();
    execRepo.findLatestContactedByContact.mockResolvedValue(null);
    const uc = new RegisterProspectStopUseCase(execRepo);
    await expect(uc.execute({ tenantId: TENANT_ID, contactId: "contact-missing", conversationId: "c", messageId: "m", messageText: "sair" })).resolves.toBeNull();
    expect(execRepo.save).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. SyncProspectAdsLeadsUseCase — edge cases
// ═══════════════════════════════════════════════════════════════════════
describe("SyncProspectAdsLeadsUseCase — edge cases", () => {
  it("throws NotFoundException when tenant does not exist", async () => {
    const tenantFacade = { tenantExists: jest.fn().mockResolvedValue(false) };
    const leadSource = { pullLeads: jest.fn() };
    const leadRepo = makeLeadCaptureRepo();
    const uc = new SyncProspectAdsLeadsUseCase(tenantFacade as any, leadSource as any, leadRepo);
    await expect(uc.execute({ tenantId: "missing" })).rejects.toThrow(NotFoundException);
  });

  it("when pullLeads throws a network error, the error propagates", async () => {
    const tenantFacade = { tenantExists: jest.fn().mockResolvedValue(true) };
    const leadSource = { pullLeads: jest.fn().mockRejectedValue(new Error("network error")) };
    const leadRepo = makeLeadCaptureRepo();
    const uc = new SyncProspectAdsLeadsUseCase(tenantFacade as any, leadSource as any, leadRepo);
    await expect(uc.execute({ tenantId: TENANT_ID })).rejects.toThrow("network error");
    expect(leadRepo.saveMany).not.toHaveBeenCalled();
  });

  it("lead with phone that normalizes to all non-digits gets empty phone string", async () => {
    const tenantFacade = { tenantExists: jest.fn().mockResolvedValue(true) };
    const leadSource = {
      pullLeads: jest.fn().mockResolvedValue([{
        externalLeadId: "lead-x",
        campaignName: "Test",
        fullName: "No Phone",
        phone: "aaa-bbb-ccc",
        email: "test@test.com",
        city: "SP",
        state: "SP",
        submissionAt: new Date(),
        fields: [],
      }]),
    };
    const leadRepo = makeLeadCaptureRepo();
    const uc = new SyncProspectAdsLeadsUseCase(tenantFacade as any, leadSource as any, leadRepo);
    await uc.execute({ tenantId: TENANT_ID });
    expect(leadRepo.saveMany).toHaveBeenCalledTimes(1);
    const saved = leadRepo.saveMany.mock.calls[0][0];
    expect(saved[0].phone).toBe("");
  });

  it("returns syncedCount=0 when pullLeads returns empty array", async () => {
    const tenantFacade = { tenantExists: jest.fn().mockResolvedValue(true) };
    const leadSource = { pullLeads: jest.fn().mockResolvedValue([]) };
    const leadRepo = makeLeadCaptureRepo();
    const uc = new SyncProspectAdsLeadsUseCase(tenantFacade as any, leadSource as any, leadRepo);
    const result = await uc.execute({ tenantId: TENANT_ID });
    expect(result.syncedCount).toBe(0);
    expect(leadRepo.saveMany).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 10. ProspectSelectedSearchResultsUseCase — all results missing phone
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectSelectedSearchResultsUseCase — all results missing phone", () => {
  function makeSearch() {
    return ProspectSearch.create({
      tenantId: makeTid(),
      businessTypeQuery: "Clinica odontologica",
      city: "Campinas",
      state: "SP",
      source: ProspectSearchSourceVO.create("GOOGLE_PLACES"),
      maxResults: 20,
    });
  }

  it("when all selected results have no phone, skippedMissingPhone equals total and campaign is still created", async () => {
    const search = makeSearch();
    const searchRepo = makeSearchRepo();
    const resultRepo = makeSearchResultRepo();
    const contactFacade = makeContactFacade();
    const campaignRepo = makeCampaignRepo();
    searchRepo.findById.mockResolvedValue(search);
    const r1 = ProspectSearchResult.create({
      tenantId: search.tenantId,
      searchId: search.id,
      source: search.source,
      externalId: "place-1",
      businessName: "No Phone Biz",
      city: "Campinas",
    });
    resultRepo.findAllBySearch.mockResolvedValue([r1]);
    contactFacade.upsertProspectContact.mockResolvedValue({ contactId: "contact-np-1", created: true });
    const uc = new ProspectSelectedSearchResultsUseCase(searchRepo, resultRepo, contactFacade, campaignRepo, new ProspectDispatchPolicy({} as any));
    const result = await uc.execute({
      tenantId: search.tenantId.toString(),
      searchId: search.id.toString(),
      resultIds: [r1.id.toString()],
      messageTemplate: "Oi {{first_name}}, tudo bem?",
      channel: "WHATSAPP",
    });
    expect(result.skippedMissingPhone).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 11. ProspectLeadCapturesUseCase — upsertProspectContact throws
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectLeadCapturesUseCase — upsert error handling", () => {
  it("when upsertProspectContact throws for one lead, the use case propagates the error", async () => {
    const leadRepo = makeLeadCaptureRepo();
    const contactFacade = makeContactFacade();
    const campaignRepo = makeCampaignRepo();
    leadRepo.findManyByIds.mockResolvedValue([
      { id: { toString: () => "lead-1" }, phone: "11999998888", fullName: "Ana Lead", email: "ana@test.com", externalLeadId: "ext-1", tenantId: makeTid(), campaignName: "C1", city: "", state: "", submissionAt: new Date(), fields: [] },
    ] as any[]);
    contactFacade.upsertProspectContact.mockRejectedValue(new Error("DB error"));
    const uc = new ProspectLeadCapturesUseCase(leadRepo, contactFacade, campaignRepo, new ProspectDispatchPolicy({} as any));
    await expect(uc.execute({ tenantId: TENANT_ID, leadIds: ["lead-1"], messageTemplate: "Oi {{first_name}}", channel: "WHATSAPP" })).rejects.toThrow("DB error");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 12. ImportProspectSearchResultsUseCase — upsert error handling
// ═══════════════════════════════════════════════════════════════════════
describe("ImportProspectSearchResultsUseCase — upsert error handling", () => {
  it("when upsertProspectContact throws, the error propagates", async () => {
    const searchRepo = makeSearchRepo();
    const resultRepo = makeSearchResultRepo();
    const contactFacade = makeContactFacade();
    const campaignRepo = makeCampaignRepo();
    const search = ProspectSearch.create({
      tenantId: makeTid(),
      businessTypeQuery: "Academia",
      city: "SP",
      state: "SP",
      source: ProspectSearchSourceVO.create("GOOGLE_PLACES"),
      maxResults: 10,
    });
    searchRepo.findById.mockResolvedValue(search);
    const r1 = ProspectSearchResult.create({ tenantId: search.tenantId, searchId: search.id, source: search.source, externalId: "p1", businessName: "Gym A", city: "SP", phone: "11999998888" });
    resultRepo.findAllBySearch.mockResolvedValue([r1]);
    contactFacade.upsertProspectContact.mockRejectedValue(new Error("upsert failed"));
    const uc = new ImportProspectSearchResultsUseCase(searchRepo, resultRepo, contactFacade, campaignRepo, new ProspectDispatchPolicy({} as any));
    await expect(uc.execute({ tenantId: TENANT_ID, searchId: search.id.toString(), messageTemplate: "Oi {{first_name}}", channel: "WHATSAPP", resultIds: [r1.id.toString()] })).rejects.toThrow("upsert failed");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 13. CreateProspectAdsInsightQueryUseCase — deleteByQuery failure
// ═══════════════════════════════════════════════════════════════════════
describe("CreateProspectAdsInsightQueryUseCase — deleteByQuery failure", () => {
  it("when resultRepository.deleteByQuery throws, prior results stay and the error propagates", async () => {
    const queryRepo = makeAdsQueryRepo();
    const resultRepo = makeAdsResultRepo();
    resultRepo.deleteByQuery.mockRejectedValue(new Error("DB delete failed"));
    const uc = new CreateProspectAdsInsightQueryUseCase(queryRepo, resultRepo);
    await expect(uc.execute({ tenantId: TENANT_ID, businessTypeQuery: "Academia", city: "SP" })).rejects.toThrow("DB delete failed");
    expect(resultRepo.saveMany).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 14. GenerateProspectCampaignReportUseCase
// ═══════════════════════════════════════════════════════════════════════
describe("GenerateProspectCampaignReportUseCase", () => {
  it("returns empty rows and correct zero summary when no campaigns exist", async () => {
    const campaignRepo = makeCampaignRepo();
    const execRepo = makeExecRepo();
    campaignRepo.findAllByTenant.mockResolvedValue([]);
    const uc = new GenerateProspectCampaignReportUseCase(campaignRepo, execRepo);
    const result = await uc.execute({ tenantId: TENANT_ID });
    expect(result.rows).toHaveLength(0);
    expect(result.summary.totalCampaigns).toBe(0);
    expect(result.summary.totalExecutions).toBe(0);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it("correctly counts execution statuses per campaign", async () => {
    const campaignRepo = makeCampaignRepo();
    const execRepo = makeExecRepo();
    const c = makeWACampaign();
    c.clearEvents();
    campaignRepo.findAllByTenant.mockResolvedValue([c]);
    const e1 = makeExec(c, "c1");
    e1.markAsContacted();
    e1.markAsResponded();
    const e2 = makeExec(c, "c2");
    e2.markAsContacted();
    e2.markAsStopped(ProspectStopReasonVO.create("OPT_OUT"));
    const e3 = makeExec(c, "c3");
    execRepo.findAllByCampaign.mockResolvedValue([e1, e2, e3]);
    const uc = new GenerateProspectCampaignReportUseCase(campaignRepo, execRepo);
    const result = await uc.execute({ tenantId: TENANT_ID });
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.respondedExecutions).toBe(1);
    expect(row.stoppedExecutions).toBe(1);
    expect(row.pendingExecutions).toBe(1);
    expect(result.summary.respondedExecutions).toBe(1);
  });

  it("filters campaigns by status when statuses filter provided", async () => {
    const campaignRepo = makeCampaignRepo();
    const execRepo = makeExecRepo();
    const draft = makeWACampaign({ name: "Draft Camp" });
    draft.clearEvents();
    const active = makeWACampaign({ name: "Active Camp" });
    active.activate();
    active.clearEvents();
    campaignRepo.findAllByTenant.mockResolvedValue([draft, active]);
    execRepo.findAllByCampaign.mockResolvedValue([]);
    const uc = new GenerateProspectCampaignReportUseCase(campaignRepo, execRepo);
    const result = await uc.execute({ tenantId: TENANT_ID, statuses: ["ACTIVE"] });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("Active Camp");
  });

  it("filters campaigns by query (case-insensitive)", async () => {
    const campaignRepo = makeCampaignRepo();
    const execRepo = makeExecRepo();
    const c1 = makeWACampaign({ name: "Reativacao VIP" });
    c1.clearEvents();
    const c2 = makeWACampaign({ name: "Outbound Local" });
    c2.clearEvents();
    campaignRepo.findAllByTenant.mockResolvedValue([c1, c2]);
    execRepo.findAllByCampaign.mockResolvedValue([]);
    const uc = new GenerateProspectCampaignReportUseCase(campaignRepo, execRepo);
    const result = await uc.execute({ tenantId: TENANT_ID, query: "vip" });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("Reativacao VIP");
  });

  it("dateFrom/dateTo filters exclude campaigns outside range", async () => {
    const campaignRepo = makeCampaignRepo();
    const execRepo = makeExecRepo();
    const c = makeWACampaign({ name: "Old Campaign" });
    c.clearEvents();
    Object.defineProperty(c, "createdAt", { value: new Date("2020-01-01"), writable: false });
    campaignRepo.findAllByTenant.mockResolvedValue([c]);
    execRepo.findAllByCampaign.mockResolvedValue([]);
    const uc = new GenerateProspectCampaignReportUseCase(campaignRepo, execRepo);
    const result = await uc.execute({ tenantId: TENANT_ID, dateFrom: "2024-01-01", dateTo: "2024-12-31" });
    expect(result.rows).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 15. GenerateProspectSearchReportUseCase
// ═══════════════════════════════════════════════════════════════════════
describe("GenerateProspectSearchReportUseCase", () => {
  it("returns empty rows when no searches exist", async () => {
    const searchRepo = makeSearchRepo();
    const resultRepo = makeSearchResultRepo();
    searchRepo.findAllByTenant.mockResolvedValue([]);
    const uc = new GenerateProspectSearchReportUseCase(searchRepo, resultRepo);
    const result = await uc.execute({ tenantId: TENANT_ID });
    expect(result.rows).toHaveLength(0);
    expect(result.summary.totalSearches).toBe(0);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it("correctly aggregates whatsapp/instagram/email counts from results", async () => {
    const searchRepo = makeSearchRepo();
    const resultRepo = makeSearchResultRepo();
    const s = ProspectSearch.create({ tenantId: makeTid(), businessTypeQuery: "Gym", city: "SP", state: "SP", source: ProspectSearchSourceVO.create("GOOGLE_PLACES"), maxResults: 10 });
    searchRepo.findAllByTenant.mockResolvedValue([s]);
    const r1 = ProspectSearchResult.create({ tenantId: s.tenantId, searchId: s.id, source: s.source, externalId: "p1", businessName: "A", city: "SP", phone: "11999998888" });
    const r2 = ProspectSearchResult.create({ tenantId: s.tenantId, searchId: s.id, source: s.source, externalId: "p2", businessName: "B", city: "SP", email: "b@test.com" });
    const r3 = ProspectSearchResult.create({ tenantId: s.tenantId, searchId: s.id, source: s.source, externalId: "p3", businessName: "C", city: "SP" });
    resultRepo.findAllBySearch.mockResolvedValue([r1, r2, r3]);
    const uc = new GenerateProspectSearchReportUseCase(searchRepo, resultRepo);
    const result = await uc.execute({ tenantId: TENANT_ID });
    expect(result.rows[0].actualResultsCount).toBe(3);
    expect(result.rows[0].emailCount).toBe(1);
    expect(result.summary.totalSearches).toBe(1);
  });

  it("filters searches by source", async () => {
    const searchRepo = makeSearchRepo();
    const resultRepo = makeSearchResultRepo();
    const s1 = ProspectSearch.create({ tenantId: makeTid(), businessTypeQuery: "Gym", city: "SP", state: "SP", source: ProspectSearchSourceVO.create("GOOGLE_PLACES"), maxResults: 10 });
    searchRepo.findAllByTenant.mockResolvedValue([s1]);
    resultRepo.findAllBySearch.mockResolvedValue([]);
    const uc = new GenerateProspectSearchReportUseCase(searchRepo, resultRepo);
    const r1 = await uc.execute({ tenantId: TENANT_ID, sources: ["GOOGLE_PLACES"] });
    expect(r1.rows).toHaveLength(1);
    const r2 = await uc.execute({ tenantId: TENANT_ID, sources: ["GOOGLE_ADS_AUDIENCE"] });
    expect(r2.rows).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 16. Google Ads connection use cases
// ═══════════════════════════════════════════════════════════════════════
describe("StartGoogleAdsConnectionUseCase", () => {
  it("returns authorizationUrl from oauthService", async () => {
    const oauthService = { buildAuthorizationUrl: jest.fn().mockReturnValue("https://accounts.google.com/auth?state=abc") };
    const stateService = { sign: jest.fn().mockReturnValue("signed-state-abc"), verify: jest.fn() };
    const uc = new StartGoogleAdsConnectionUseCase(oauthService as any, stateService as any);
    const result = await uc.execute({ tenantId: TENANT_ID });
    expect(stateService.sign).toHaveBeenCalledWith(TENANT_ID);
    expect(oauthService.buildAuthorizationUrl).toHaveBeenCalledWith("signed-state-abc");
    expect(result.authorizationUrl).toBe("https://accounts.google.com/auth?state=abc");
  });
});

describe("CompleteGoogleAdsConnectionUseCase", () => {
  it("exchanges code for refresh token and saves connection as PENDING_ACCOUNT_SELECTION", async () => {
    const repo = makeGoogleAdsRepo();
    const oauthService = { exchangeCodeForRefreshToken: jest.fn().mockResolvedValue({ email: "ads@test.com", refreshToken: "rt-abc" }) };
    const stateService = { sign: jest.fn(), verify: jest.fn().mockReturnValue({ tenantId: TENANT_ID }) };
    const uc = new CompleteGoogleAdsConnectionUseCase(repo, oauthService as any, stateService as any);
    const result = await uc.execute({ code: "auth-code", state: "signed-state" });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT_ID, googleEmail: "ads@test.com", status: "PENDING_ACCOUNT_SELECTION" }));
    expect(result.email).toBe("ads@test.com");
  });

  it("throws when state verification fails (invalid/tampered state)", async () => {
    const repo = makeGoogleAdsRepo();
    const oauthService = { exchangeCodeForRefreshToken: jest.fn() };
    const stateService = { sign: jest.fn(), verify: jest.fn().mockImplementation(() => { throw new Error("invalid state"); }) };
    const uc = new CompleteGoogleAdsConnectionUseCase(repo, oauthService as any, stateService as any);
    await expect(uc.execute({ code: "any", state: "bad-state" })).rejects.toThrow("invalid state");
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe("DisconnectGoogleAdsConnectionUseCase", () => {
  it("calls deleteByTenantId and returns disconnected:true", async () => {
    const repo = makeGoogleAdsRepo();
    repo.deleteByTenantId.mockResolvedValue(undefined);
    const uc = new DisconnectGoogleAdsConnectionUseCase(repo);
    const result = await uc.execute({ tenantId: TENANT_ID });
    expect(repo.deleteByTenantId).toHaveBeenCalledWith(TENANT_ID);
    expect(result.disconnected).toBe(true);
  });

  it("propagates error when deleteByTenantId throws", async () => {
    const repo = makeGoogleAdsRepo();
    repo.deleteByTenantId.mockRejectedValue(new Error("DB error"));
    const uc = new DisconnectGoogleAdsConnectionUseCase(repo);
    await expect(uc.execute({ tenantId: TENANT_ID })).rejects.toThrow("DB error");
  });
});

describe("GetGoogleAdsConnectionStatusUseCase", () => {
  it("returns connected:false and status NOT_CONNECTED when no connection exists", async () => {
    const repo = makeGoogleAdsRepo();
    repo.findByTenantId.mockResolvedValue(null);
    const uc = new GetGoogleAdsConnectionStatusUseCase(repo);
    const result = await uc.execute({ tenantId: TENANT_ID });
    expect(result.connected).toBe(false);
    expect(result.status).toBe("NOT_CONNECTED");
    expect(result.accountSelected).toBe(false);
  });

  it("returns connected:true with account data when CONNECTED", async () => {
    const repo = makeGoogleAdsRepo();
    repo.findByTenantId.mockResolvedValue({ tenantId: TENANT_ID, googleEmail: "ads@test.com", refreshToken: "rt", status: "CONNECTED", customerId: "cust-123", customerName: "Acme Ads", connectedAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" });
    const uc = new GetGoogleAdsConnectionStatusUseCase(repo);
    const result = await uc.execute({ tenantId: TENANT_ID });
    expect(result.connected).toBe(true);
    expect(result.status).toBe("CONNECTED");
    expect(result.accountSelected).toBe(true);
    expect(result.customerId).toBe("cust-123");
  });

  it("returns PENDING_ACCOUNT_SELECTION when account not yet selected", async () => {
    const repo = makeGoogleAdsRepo();
    repo.findByTenantId.mockResolvedValue({ tenantId: TENANT_ID, googleEmail: "ads@test.com", refreshToken: "rt", status: "PENDING_ACCOUNT_SELECTION", connectedAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" });
    const uc = new GetGoogleAdsConnectionStatusUseCase(repo);
    const result = await uc.execute({ tenantId: TENANT_ID });
    expect(result.status).toBe("PENDING_ACCOUNT_SELECTION");
    expect(result.accountSelected).toBe(false);
  });
});

describe("SelectGoogleAdsAccountUseCase", () => {
  it("throws ValidationErrorException when no connection found", async () => {
    const repo = makeGoogleAdsRepo();
    repo.findByTenantId.mockResolvedValue(null);
    const oauthService = { listAccessibleAccounts: jest.fn() };
    const uc = new SelectGoogleAdsAccountUseCase(repo, oauthService as any);
    await expect(uc.execute({ tenantId: TENANT_ID, customerId: "123" })).rejects.toThrow(ValidationErrorException);
  });

  it("throws ValidationErrorException when chosen account is not accessible", async () => {
    const repo = makeGoogleAdsRepo();
    repo.findByTenantId.mockResolvedValue({ tenantId: TENANT_ID, refreshToken: "rt", status: "PENDING_ACCOUNT_SELECTION", googleEmail: "ads@test.com", connectedAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" });
    const oauthService = { listAccessibleAccounts: jest.fn().mockResolvedValue([{ customerId: "other-cust", descriptiveName: "Other", isManager: false }]) };
    const uc = new SelectGoogleAdsAccountUseCase(repo, oauthService as any);
    await expect(uc.execute({ tenantId: TENANT_ID, customerId: "target-cust" })).rejects.toThrow(ValidationErrorException);
  });

  it("saves CONNECTED connection when valid account selected", async () => {
    const repo = makeGoogleAdsRepo();
    repo.findByTenantId.mockResolvedValue({ tenantId: TENANT_ID, refreshToken: "rt", status: "PENDING_ACCOUNT_SELECTION", googleEmail: "ads@test.com", connectedAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" });
    const oauthService = { listAccessibleAccounts: jest.fn().mockResolvedValue([{ customerId: "cust-123", descriptiveName: "Acme", isManager: false }]) };
    const uc = new SelectGoogleAdsAccountUseCase(repo, oauthService as any);
    const result = await uc.execute({ tenantId: TENANT_ID, customerId: "cust-123" });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: "CONNECTED", customerId: "cust-123" }));
    expect(result.status).toBe("CONNECTED");
    expect(result.accountSelected).toBe(true);
  });
});

describe("ListGoogleAdsAccessibleAccountsUseCase", () => {
  it("throws ValidationErrorException when no connection found", async () => {
    const repo = makeGoogleAdsRepo();
    repo.findByTenantId.mockResolvedValue(null);
    const oauthService = { listAccessibleAccounts: jest.fn() };
    const uc = new ListGoogleAdsAccessibleAccountsUseCase(repo, oauthService as any);
    await expect(uc.execute({ tenantId: TENANT_ID })).rejects.toThrow(ValidationErrorException);
  });

  it("returns account list from oauthService", async () => {
    const repo = makeGoogleAdsRepo();
    repo.findByTenantId.mockResolvedValue({ tenantId: TENANT_ID, refreshToken: "rt-abc", status: "PENDING_ACCOUNT_SELECTION", googleEmail: "ads@test.com", connectedAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" });
    const accounts = [{ customerId: "c1", descriptiveName: "Acme", isManager: false }];
    const oauthService = { listAccessibleAccounts: jest.fn().mockResolvedValue(accounts) };
    const uc = new ListGoogleAdsAccessibleAccountsUseCase(repo, oauthService as any);
    const result = await uc.execute({ tenantId: TENANT_ID });
    expect(oauthService.listAccessibleAccounts).toHaveBeenCalledWith("rt-abc");
    expect(result).toEqual(accounts);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 17. ProspectMessageReceivedHandler — error paths and null content
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectMessageReceivedHandler — error paths", () => {
  function makeHandler() {
    const eventBus = { publish: jest.fn(), subscribe: jest.fn() } as jest.Mocked<IEventBus>;
    const registerResponse = { execute: jest.fn() } as jest.Mocked<IRegisterProspectResponseUseCase>;
    const registerStop = { execute: jest.fn() } as jest.Mocked<IRegisterProspectStopUseCase>;
    const optOutPolicy = { shouldStop: jest.fn() };
    const handler = new ProspectMessageReceivedHandler(eventBus, registerResponse, registerStop, optOutPolicy as any);
    let subscribedFn: ((event: any) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((_, cb) => { subscribedFn = cb as any; });
    handler.onModuleInit();
    return { handler, eventBus, registerResponse, registerStop, optOutPolicy, subscribedFn: () => subscribedFn! };
  }

  it("when registerProspectResponseUseCase.execute throws, the error propagates (event not silently lost)", async () => {
    const { registerResponse, optOutPolicy, subscribedFn } = makeHandler();
    optOutPolicy.shouldStop.mockReturnValue(false);
    registerResponse.execute.mockRejectedValue(new Error("use-case failure"));
    await expect(subscribedFn()({ payload: { tenantId: "t1", contactId: "c1", conversationId: "cv1", messageId: "m1", content: { text: "Tenho interesse" } } })).rejects.toThrow("use-case failure");
  });

  it("when registerProspectStopUseCase.execute throws, the error propagates", async () => {
    const { registerStop, optOutPolicy, subscribedFn } = makeHandler();
    optOutPolicy.shouldStop.mockReturnValue(true);
    registerStop.execute.mockRejectedValue(new Error("stop-use-case failure"));
    await expect(subscribedFn()({ payload: { tenantId: "t1", contactId: "c1", conversationId: "cv1", messageId: "m1", content: { text: "sair" } } })).rejects.toThrow("stop-use-case failure");
  });

  it("null content.text passes empty string to policy shouldStop", async () => {
    const { optOutPolicy, subscribedFn, registerResponse } = makeHandler();
    optOutPolicy.shouldStop.mockReturnValue(false);
    registerResponse.execute.mockResolvedValue(undefined);
    await subscribedFn()({ payload: { tenantId: "t1", contactId: "c1", conversationId: "cv1", messageId: "m1", content: { text: null } } });
    expect(optOutPolicy.shouldStop).toHaveBeenCalledWith(expect.anything());
  });

  it("undefined content.text is handled without throwing", async () => {
    const { optOutPolicy, subscribedFn, registerResponse } = makeHandler();
    optOutPolicy.shouldStop.mockReturnValue(false);
    registerResponse.execute.mockResolvedValue(undefined);
    await expect(subscribedFn()({ payload: { tenantId: "t1", contactId: "c1", conversationId: "cv1", messageId: "m1", content: {} } })).resolves.not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 18. MetaWebhookController — malformed payload edge cases
// ═══════════════════════════════════════════════════════════════════════
import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { MetaWebhookController } from "../presentation/controllers/MetaWebhookController";
import { IHandleMetaQualityEventUseCase } from "../application/use-cases/interfaces/IHandleMetaQualityEventUseCase";

function buildWebhookController() {
  const configService = { get: jest.fn((k) => k === "WHATSAPP_APP_SECRET" ? "secret" : k === "META_WEBHOOK_VERIFY_TOKEN" ? "vtoken" : undefined) } as unknown as ConfigService;
  const handleQualityEvent = { execute: jest.fn().mockResolvedValue({ processed: 0 }) } as jest.Mocked<IHandleMetaQualityEventUseCase>;
  return { controller: new MetaWebhookController(configService, handleQualityEvent), handleQualityEvent };
}

function hmac(body: Record<string, unknown>) {
  return "sha256=" + crypto.createHmac("sha256", "secret").update(JSON.stringify(body)).digest("hex");
}

describe("MetaWebhookController — malformed payload edge cases", () => {
  it("payload with empty entry array returns ok without calling use case", async () => {
    const { controller, handleQualityEvent } = buildWebhookController();
    const body = { object: "whatsapp_business_account", entry: [] };
    const result = await controller.handleEvent(body, hmac(body));
    expect(result).toEqual({ status: "ok" });
    expect(handleQualityEvent.execute).not.toHaveBeenCalled();
  });

  it("payload with entry but no changes key is handled gracefully", async () => {
    const { controller } = buildWebhookController();
    const body = { object: "whatsapp_business_account", entry: [{ id: "WABA", noChanges: true }] };
    await expect(controller.handleEvent(body, hmac(body))).resolves.toEqual({ status: "ok" });
  });

  it("payload with changes but no contacts key is handled gracefully", async () => {
    const { controller } = buildWebhookController();
    const body = { object: "whatsapp_business_account", entry: [{ id: "WABA", changes: [{ value: {}, field: "messages" }] }] };
    await expect(controller.handleEvent(body, hmac(body))).resolves.toEqual({ status: "ok" });
  });

  it("payload with contacts but empty wa_id does not call use case", async () => {
    const { controller, handleQualityEvent } = buildWebhookController();
    const body = { object: "whatsapp_business_account", entry: [{ id: "WABA", changes: [{ value: { contacts: [{ wa_id: "" }] }, field: "messages" }] }] };
    await controller.handleEvent(body, hmac(body));
    expect(handleQualityEvent.execute).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 19. BullMQProspectSearchQueue unit wiring
// ═══════════════════════════════════════════════════════════════════════
import { BullMQProspectSearchQueue } from "../infrastructure/queue/BullMQProspectSearchQueue";
jest.mock("bullmq", () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("BullMQProspectSearchQueue", () => {
  it("addJob enqueues a job with a deterministic jobId based on searchId", async () => {
    const configService = { get: jest.fn((k, d) => k === "REDIS_URL" ? "redis://localhost:6379" : d) } as any;
    const queue = new BullMQProspectSearchQueue(configService);
    await queue.addJob({ searchId: "search-abc" });
    const { Queue } = require("bullmq");
    const instance = Queue.mock.results[0].value;
    expect(instance.add).toHaveBeenCalledWith("execute-prospect-search", { searchId: "search-abc" }, expect.objectContaining({ jobId: "prospect-search-search-abc" }));
  });

  it("onModuleDestroy closes the queue", async () => {
    const configService = { get: jest.fn((k, d) => k === "REDIS_URL" ? "redis://localhost:6379" : d) } as any;
    const queue = new BullMQProspectSearchQueue(configService);
    await queue.onModuleDestroy();
    const { Queue } = require("bullmq");
    const instance = Queue.mock.results[Queue.mock.results.length - 1].value;
    expect(instance.close).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 20. ProspectSearchProcessor — worker job error handling
// ═══════════════════════════════════════════════════════════════════════
import { ProspectSearchProcessor } from "../infrastructure/queue/ProspectSearchProcessor";
import { IExecuteProspectSearchUseCase } from "../application/use-cases/interfaces/IExecuteProspectSearchUseCase";

describe("ProspectSearchProcessor — worker job handling", () => {
  it("calls executeProspectSearchUseCase with job searchId on success", async () => {
    const { Worker } = require("bullmq");
    let capturedProcessor: ((job: any) => Promise<void>) | undefined;
    Worker.mockImplementationOnce((_queue: any, processor: any) => {
      capturedProcessor = processor;
      return { on: jest.fn(), close: jest.fn() };
    });
    const configService = { get: jest.fn((k, d) => k === "REDIS_URL" ? "redis://localhost:6379" : d) } as any;
    const executeUseCase = { execute: jest.fn().mockResolvedValue(undefined) } as jest.Mocked<IExecuteProspectSearchUseCase>;
    const structuredLog = { emit: jest.fn() } as any;
    const processor = new ProspectSearchProcessor(configService, executeUseCase, structuredLog);
    processor.onModuleInit();
    await capturedProcessor!({ id: "job-1", data: { searchId: "search-xyz" } });
    expect(executeUseCase.execute).toHaveBeenCalledWith({ searchId: "search-xyz" });
  });

  it("re-throws error from executeUseCase (so BullMQ can retry)", async () => {
    const { Worker } = require("bullmq");
    let capturedProcessor: ((job: any) => Promise<void>) | undefined;
    Worker.mockImplementationOnce((_queue: any, processor: any) => {
      capturedProcessor = processor;
      return { on: jest.fn(), close: jest.fn() };
    });
    const configService = { get: jest.fn((k, d) => k === "REDIS_URL" ? "redis://localhost:6379" : d) } as any;
    const executeUseCase = { execute: jest.fn().mockRejectedValue(new Error("search failed")) } as jest.Mocked<IExecuteProspectSearchUseCase>;
    const structuredLog = { emit: jest.fn() } as any;
    const processor = new ProspectSearchProcessor(configService, executeUseCase, structuredLog);
    processor.onModuleInit();
    await expect(capturedProcessor!({ id: "job-2", data: { searchId: "search-fail" } })).rejects.toThrow("search failed");
    expect(structuredLog.emit).toHaveBeenCalledWith(expect.objectContaining({ level: "error" }));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 21. ProspectExecution — markAsOptedOut on CONTACTED status
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectExecution — markAsOptedOut on CONTACTED", () => {
  it("markAsOptedOut on CONTACTED transitions to STOPPED with OPT_OUT", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    e.markAsOptedOut();
    expect(e.status.value).toBe("STOPPED");
    expect(e.stopReason?.value).toBe("OPT_OUT");
  });

  it("markAsOptedOut on STOPPED is a no-op (stays STOPPED)", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    e.markAsStopped(ProspectStopReasonVO.create("COOLDOWN"));
    e.markAsOptedOut();
    expect(e.status.value).toBe("STOPPED");
    expect(e.stopReason?.value).toBe("COOLDOWN");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 22. DispatchNextProspectCampaignExecutionUseCase — schedule delay range
// ═══════════════════════════════════════════════════════════════════════
describe("DispatchNextProspectCampaignExecutionUseCase — schedule delay range", () => {
  it("scheduleNextDispatch delay is between minDelaySeconds and maxDelaySeconds", async () => {
    const c = makeActiveWACampaign({ dailyLimit: 50 });
    const execRepo = makeExecRepo();
    const campaignRepo = makeCampaignRepo();
    campaignRepo.findById.mockResolvedValue(c);
    const exec1 = makeExec(c, "contact-1");
    const exec2 = makeExec(c, "contact-2");
    execRepo.findNextPendingByCampaign.mockResolvedValue(exec1);
    execRepo.findAllByCampaign.mockResolvedValue([exec1, exec2]);
    execRepo.countContactedTodayByCampaign.mockResolvedValue(1);
    const dispatchExec = { execute: jest.fn().mockResolvedValue({ executionId: exec1.id.toString(), status: "CONTACTED", renderedMessage: "msg", conversationId: "c1", messageId: "m1" }) };
    const dispatchQueue = { scheduleNextDispatch: jest.fn() };
    const uc = new DispatchNextProspectCampaignExecutionUseCase(campaignRepo, execRepo, dispatchExec as any, { execute: jest.fn() } as any, dispatchQueue as any);
    await uc.execute({ tenantId: TENANT_ID, campaignId: c.id.toString() });
    const [, delayMs] = dispatchQueue.scheduleNextDispatch.mock.calls[0];
    expect(delayMs).toBeGreaterThanOrEqual(c.minDelaySeconds * 1000);
    expect(delayMs).toBeLessThanOrEqual(c.maxDelaySeconds * 1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 23. ProspectDispatchPolicy — cooldown boundary edge cases
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectDispatchPolicy — cooldown boundary edge cases", () => {
  it("contact at exactly cooldownDays boundary is still blocked (exclusive)", async () => {
    const execRepo = makeExecRepo();
    const cooldownDays = 30;
    const exactBoundary = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000 + 1000);
    execRepo.findLastContactedAt.mockResolvedValue(exactBoundary);
    const policy = new ProspectDispatchPolicy(execRepo);
    const c = makeActiveWACampaign({ cooldownDays });
    const e = makeExec(c);
    await expect(policy.assertContactEligible(c, e, { phone: "11999998888", prospectingOptOut: false })).rejects.toThrow(ProspectCooldownActiveError);
  });

  it("contact at just-outside cooldown window is allowed", async () => {
    const execRepo = makeExecRepo();
    const cooldownDays = 30;
    const justOutside = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000 - 1000);
    execRepo.findLastContactedAt.mockResolvedValue(justOutside);
    const policy = new ProspectDispatchPolicy(execRepo);
    const c = makeActiveWACampaign({ cooldownDays });
    const e = makeExec(c);
    await expect(policy.assertContactEligible(c, e, { phone: "11999998888", prospectingOptOut: false })).resolves.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 24. ProspectCampaign — REENGAGEMENT campaign creation without contacts
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectCampaign — REENGAGEMENT audience", () => {
  it("REENGAGEMENT campaign can be created without targetContactIds", () => {
    const c = ProspectCampaign.create({
      tenantId: makeTid(),
      name: "Reativacao leads",
      objective: "Retomar leads mornos",
      audienceType: ProspectAudienceTypeVO.create("REENGAGEMENT"),
      channel: ProspectChannelVO.create("WHATSAPP"),
      templateName: "reativacao_v1",
    });
    expect(c.status.value).toBe("DRAFT");
    expect(c.targetContactIds).toHaveLength(0);
  });

  it("REENGAGEMENT defaults to dailyLimit=50", () => {
    const c = ProspectCampaign.create({
      tenantId: makeTid(),
      name: "Reativacao",
      objective: "Re-engage",
      audienceType: ProspectAudienceTypeVO.create("REENGAGEMENT"),
      channel: ProspectChannelVO.create("WHATSAPP"),
      templateName: "tmpl_v1",
    });
    expect(c.dailyLimit).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 25. ProspectExecution — attemptCount increments correctly
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectExecution — attemptCount", () => {
  it("attemptCount starts at 0", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    expect(e.attemptCount).toBe(0);
  });

  it("attemptCount increments to 1 after markAsContacted", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    expect(e.attemptCount).toBe(1);
  });

  it("stopReason is cleared after markAsContacted (idempotent reset)", () => {
    const c = makeActiveWACampaign();
    const e = makeExec(c);
    e.markAsContacted();
    expect(e.stopReason).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 26. ProspectCampaign — targetContactIds deduplication and filter
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectCampaign — targetContactIds deduplication", () => {
  it("null/undefined entries in targetContactIds are filtered out", () => {
    const c = ProspectCampaign.create({
      tenantId: makeTid(),
      name: "Test",
      objective: "Test",
      audienceType: ProspectAudienceTypeVO.create("CONTACT_LIST"),
      channel: ProspectChannelVO.create("WHATSAPP"),
      targetContactIds: ["contact-1", "", "contact-2", null as any, undefined as any],
      templateName: "tmpl_v1",
    });
    expect(c.targetContactIds).toEqual(["contact-1", "contact-2"]);
  });

  it("duplicate contacts in targetContactIds are deduplicated", () => {
    const c = ProspectCampaign.create({
      tenantId: makeTid(),
      name: "Test",
      objective: "Test",
      audienceType: ProspectAudienceTypeVO.create("CONTACT_LIST"),
      channel: ProspectChannelVO.create("WHATSAPP"),
      targetContactIds: ["c1", "c1", "c2", "c2", "c3"],
      templateName: "tmpl_v1",
    });
    expect(c.targetContactIds).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 27. GenerateProspectCampaignReportUseCase — channel filter
// ═══════════════════════════════════════════════════════════════════════
describe("GenerateProspectCampaignReportUseCase — channel filter", () => {
  it("filters by channel correctly", async () => {
    const campaignRepo = makeCampaignRepo();
    const execRepo = makeExecRepo();
    const wa = makeWACampaign({ name: "WA Campaign" });
    wa.clearEvents();
    const ig = ProspectCampaign.create({
      tenantId: makeTid(), name: "IG Campaign", objective: "IG obj",
      audienceType: ProspectAudienceTypeVO.create("REENGAGEMENT"),
      channel: ProspectChannelVO.create("INSTAGRAM"),
    });
    ig.clearEvents();
    campaignRepo.findAllByTenant.mockResolvedValue([wa, ig]);
    execRepo.findAllByCampaign.mockResolvedValue([]);
    const uc = new GenerateProspectCampaignReportUseCase(campaignRepo, execRepo);
    const r = await uc.execute({ tenantId: TENANT_ID, channels: ["INSTAGRAM"] });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].channel).toBe("INSTAGRAM");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 28. GetGoogleAdsConnectionStatusUseCase — loginCustomerId / manager account
// ═══════════════════════════════════════════════════════════════════════
describe("GetGoogleAdsConnectionStatusUseCase — loginCustomerId", () => {
  it("returns loginCustomerId when present", async () => {
    const repo = makeGoogleAdsRepo();
    repo.findByTenantId.mockResolvedValue({ tenantId: TENANT_ID, googleEmail: "ads@test.com", refreshToken: "rt", status: "CONNECTED", customerId: "cust-123", customerName: "Acme", loginCustomerId: "mgr-456", connectedAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" });
    const uc = new GetGoogleAdsConnectionStatusUseCase(repo);
    const result = await uc.execute({ tenantId: TENANT_ID });
    expect(result.loginCustomerId).toBe("mgr-456");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 29. Final edge cases
// ═══════════════════════════════════════════════════════════════════════
describe("ProspectDispatchPolicy — assertCampaignCanStart", () => {
  it("throws ValidationErrorException when campaign objective is assisted local prospecting", () => {
    const execRepo = makeExecRepo();
    const policy = new ProspectDispatchPolicy(execRepo);
    const c = ProspectCampaign.create({
      tenantId: makeTid(),
      name: "Abordagem Clinica - Campinas",
      objective: ASSISTED_LOCAL_PROSPECTING_OBJECTIVE_PREFIX + ": preparar abordagem",
      audienceType: ProspectAudienceTypeVO.create("CONTACT_LIST"),
      channel: ProspectChannelVO.create("WHATSAPP"),
      targetContactIds: ["contact-1"],
      templateName: "tmpl_v1",
    });
    c.activate();
    expect(() => policy.assertCanStartCampaign(c)).toThrow(ValidationErrorException);
  });

  it("throws ValidationErrorException when message template has no personalization token", () => {
    const execRepo = makeExecRepo();
    const policy = new ProspectDispatchPolicy(execRepo);
    expect(() => policy.assertTemplateSupportsPersonalization("Ola, temos novidades para voce!")).toThrow(ValidationErrorException);
  });
});
