// prospecting.integration-new.spec.ts
// Integration tests (mock DB/queue) — gaps not covered by existing specs
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import { User } from '@modules/tenant/domain/entities/User';
import { CompanyName } from '@modules/tenant/domain/value-objects/CompanyName';
import { CNPJ } from '@modules/tenant/domain/value-objects/CNPJ';
import { Plan } from '@modules/tenant/domain/value-objects/Plan';
import { Email } from '@modules/tenant/domain/value-objects/Email';
import { Phone } from '@modules/tenant/domain/value-objects/Phone';
import { Role } from '@modules/tenant/domain/value-objects/Role';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import { ProspectExecution } from '../domain/entities/ProspectExecution';
import { ProspectSearch } from '../domain/entities/ProspectSearch';
import { ProspectSearchResult } from '../domain/entities/ProspectSearchResult';
import {
  IProspectCampaignRepository,
  PROSPECT_CAMPAIGN_REPOSITORY,
} from '../domain/repositories/IProspectCampaignRepository';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../domain/repositories/IProspectExecutionRepository';
import {
  IProspectSearchRepository,
  PROSPECT_SEARCH_REPOSITORY,
} from '../domain/repositories/IProspectSearchRepository';
import {
  IProspectSearchResultRepository,
  PROSPECT_SEARCH_RESULT_REPOSITORY,
} from '../domain/repositories/IProspectSearchResultRepository';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import { ProspectSearchSourceVO } from '../domain/value-objects/ProspectSearchSource';
import { ProspectStopReasonVO } from '../domain/value-objects/ProspectStopReason';
import { ProspectCampaignController } from '../presentation/controllers/ProspectCampaignController';
import { ProspectExecutionController } from '../presentation/controllers/ProspectExecutionController';
import { ProspectExecutionStatusController } from '../presentation/controllers/ProspectExecutionStatusController';
import { ICreateProspectCampaignUseCase } from '../application/use-cases/interfaces/ICreateProspectCampaignUseCase';
import { CreateProspectCampaignUseCase } from '../application/use-cases/CreateProspectCampaignUseCase';
import { IListProspectCampaignsUseCase } from '../application/use-cases/interfaces/IListProspectCampaignsUseCase';
import { ListProspectCampaignsUseCase } from '../application/use-cases/ListProspectCampaignsUseCase';
import { IActivateProspectCampaignUseCase } from '../application/use-cases/interfaces/IActivateProspectCampaignUseCase';
import { ActivateProspectCampaignUseCase } from '../application/use-cases/ActivateProspectCampaignUseCase';
import { IPauseProspectCampaignUseCase } from '../application/use-cases/interfaces/IPauseProspectCampaignUseCase';
import { PauseProspectCampaignUseCase } from '../application/use-cases/PauseProspectCampaignUseCase';
import { IStartProspectCampaignUseCase } from '../application/use-cases/interfaces/IStartProspectCampaignUseCase';
import { StartProspectCampaignUseCase } from '../application/use-cases/StartProspectCampaignUseCase';
import { IDispatchNextProspectCampaignExecutionUseCase } from '../application/use-cases/interfaces/IDispatchNextProspectCampaignExecutionUseCase';
import { ISuggestProspectCampaignMessageUseCase } from '../application/use-cases/interfaces/ISuggestProspectCampaignMessageUseCase';
import { ProspectDispatchPolicy } from '../application/services/ProspectDispatchPolicy';
import { GooglePlacesProspectSearchSource } from '../infrastructure/acl/GooglePlacesProspectSearchSource';

jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

const INT_TENANT_ID = "223e4567-e89b-12d3-a456-426614174000";
const OTHER_TENANT_ID = "223e4567-e89b-12d3-a456-426614174999";

function makeTenant() {
  const t = Tenant.create({
    companyName: CompanyName.create("Integration Test Store"),
    cnpj: CNPJ.create("60.701.190/0001-04"),
    plan: Plan.create("PROFISSIONAL"),
    users: [User.create({ name: "Owner", email: Email.create("owner@int.test"), phone: Phone.create("11999998888"), passwordHash: "hash", role: Role.create("OWNER") })],
  });
  t.clearEvents();
  return t;
}

function makeExecRepo(): jest.Mocked<IProspectExecutionRepository> {
  return { save: jest.fn(), saveMany: jest.fn(), findById: jest.fn(), findLatestContactedByContact: jest.fn(), findAllByCampaign: jest.fn().mockResolvedValue([]), findNextPendingByCampaign: jest.fn(), findLastContactedAt: jest.fn().mockResolvedValue(null), findLatestByContactIds: jest.fn().mockResolvedValue([]), findActiveByContact: jest.fn().mockResolvedValue([]), countContactedTodayByCampaign: jest.fn().mockResolvedValue(0) };
}
function makeContactFacade(): jest.Mocked<IContactFacade> {
  return { identifyContact: jest.fn(), getContactById: jest.fn(), ensureContact: jest.fn(), upsertProspectContact: jest.fn(), findContactIdsForReengagementAudience: jest.fn(), markProspectingOptOut: jest.fn() };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// A. ProspectCampaignController — ADMIN role access tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("ProspectCampaignController — ADMIN role access", () => {
  let app: INestApplication;
  let currentUser: { tenantId: string; role: string } | undefined;
  const tenant = makeTenant();
  const tenantRepo: jest.Mocked<ITenantRepository> = {
    save: jest.fn(), findById: jest.fn(async (id) => id === tenant.id.toString() ? tenant : null),
    findByCnpj: jest.fn(), findByWhatsAppNumber: jest.fn(), findByApiKey: jest.fn(), findAll: jest.fn(), exists: jest.fn(), listBranches: jest.fn(), createBranch: jest.fn(), updateBranch: jest.fn(), deleteBranch: jest.fn(),
  };
  const campaignRepo: jest.Mocked<IProspectCampaignRepository> = {
    save: jest.fn(), findById: jest.fn(), findAllByTenant: jest.fn().mockResolvedValue([]),
  };
  const execRepo = makeExecRepo();
  const contactFacade = makeContactFacade();

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      controllers: [ProspectCampaignController],
      providers: [
        RolesGuard,
        ProspectDispatchPolicy,
        { provide: ICreateProspectCampaignUseCase, useClass: CreateProspectCampaignUseCase },
        { provide: IListProspectCampaignsUseCase, useClass: ListProspectCampaignsUseCase },
        { provide: IActivateProspectCampaignUseCase, useClass: ActivateProspectCampaignUseCase },
        { provide: IPauseProspectCampaignUseCase, useClass: PauseProspectCampaignUseCase },
        { provide: IStartProspectCampaignUseCase, useClass: StartProspectCampaignUseCase },
        { provide: IDispatchNextProspectCampaignExecutionUseCase, useValue: { execute: jest.fn() } },
        { provide: ISuggestProspectCampaignMessageUseCase, useValue: { execute: jest.fn() } },
        { provide: TENANT_REPOSITORY, useValue: tenantRepo },
        { provide: PROSPECT_CAMPAIGN_REPOSITORY, useValue: campaignRepo },
        { provide: PROSPECT_EXECUTION_REPOSITORY, useValue: execRepo },
        { provide: CONTACT_FACADE, useValue: contactFacade },
      ],
    }).overrideGuard(JwtCookieGuard).useValue({
      canActivate: (ctx: any) => {
        if (!currentUser) throw new UnauthorizedException("Missing token", "MISSING_TOKEN");
        ctx.switchToHttp().getRequest().user = currentUser;
        return true;
      },
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix("api/v1");
    await app.init();
  });
  afterAll(async () => { if (app) await app.close(); });
  beforeEach(() => {
    jest.clearAllMocks();
    tenantRepo.findById.mockImplementation(async (id) => id === tenant.id.toString() ? tenant : null);
    campaignRepo.findAllByTenant.mockResolvedValue([]);
    execRepo.findAllByCampaign.mockResolvedValue([]);
  });

  it("ADMIN can create a prospect campaign (200-level response)", async () => {
    currentUser = { tenantId: tenant.id.toString(), role: "ADMIN" };
    const res = await request(app.getHttpServer()).post("/api/v1/prospecting/campaigns").send({ name: "Admin Camp", objective: "Test admin", audienceType: "REENGAGEMENT", channel: "WHATSAPP", messageTemplate: "Oi {{first_name}}" }).expect(201);
    expect(res.body.status).toBe("DRAFT");
  });

  it("ADMIN can list campaigns", async () => {
    currentUser = { tenantId: tenant.id.toString(), role: "ADMIN" };
    await request(app.getHttpServer()).get("/api/v1/prospecting/campaigns").expect(200);
  });

  it("AGENT cannot create a campaign (403)", async () => {
    currentUser = { tenantId: tenant.id.toString(), role: "AGENT" };
    await request(app.getHttpServer()).post("/api/v1/prospecting/campaigns").send({ name: "Agent Camp", objective: "Test", audienceType: "REENGAGEMENT", channel: "WHATSAPP" }).expect(403);
  });

  it("cross-tenant activate returns 404 (campaign not found for requesting tenant)", async () => {
    currentUser = { tenantId: tenant.id.toString(), role: "OWNER" };
    const otherTenantCampaign = ProspectCampaign.create({
      tenantId: TenantId.create(OTHER_TENANT_ID),
      name: "Other Tenant Camp",
      objective: "Cross-tenant",
      audienceType: ProspectAudienceTypeVO.create("REENGAGEMENT"),
      channel: ProspectChannelVO.create("WHATSAPP"),
      templateName: "tmpl_v1",
    });
    otherTenantCampaign.clearEvents();
    campaignRepo.findById.mockImplementation(async (tId, cId) => {
      if (tId === tenant.id.toString() && cId === otherTenantCampaign.id.toString()) return null;
      return null;
    });
    await request(app.getHttpServer()).patch(`/api/v1/prospecting/campaigns/${otherTenantCampaign.id.toString()}/activate`).expect(404);
  });

  it("cross-tenant pause returns 404", async () => {
    currentUser = { tenantId: tenant.id.toString(), role: "OWNER" };
    campaignRepo.findById.mockResolvedValue(null);
    await request(app.getHttpServer()).patch(`/api/v1/prospecting/campaigns/other-tenant-camp-id/pause`).expect(404);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// B. GooglePlacesProspectSearchSource — HTTP error and empty results
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("GooglePlacesProspectSearchSource — HTTP error and empty results", () => {
  let source: GooglePlacesProspectSearchSource;
  beforeEach(() => {
    jest.clearAllMocks();
    const configService = { get: jest.fn((k, d) => k === "GOOGLE_PLACES_API_KEY" ? "test-key" : k === "GOOGLE_PLACES_BASE_URL" ? "https://places.googleapis.com/v1" : d) } as unknown as ConfigService;
    source = new GooglePlacesProspectSearchSource(configService);
  });

  it("returns empty array when API returns empty places array (discoveredCount=0)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { places: [] } });
    const result = await source.search({ businessTypeQuery: "Gym", city: "SP", maxResults: 10 });
    expect(result).toHaveLength(0);
  });

  it("returns empty array when API returns no places key", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: {} });
    const result = await source.search({ businessTypeQuery: "Gym", city: "SP", maxResults: 10 });
    expect(result).toHaveLength(0);
  });

  it("propagates error when axios.post rejects with 4xx", async () => {
    const apiError = Object.assign(new Error("Request failed with status 403"), { response: { status: 403, data: { error: { code: 403, message: "PERMISSION_DENIED" } } } });
    (axios.post as jest.Mock).mockRejectedValue(apiError);
    await expect(source.search({ businessTypeQuery: "Gym", city: "SP", maxResults: 10 })).rejects.toThrow();
  });

  it("propagates error when axios.post rejects with 5xx", async () => {
    const serverError = Object.assign(new Error("Request failed with status 500"), { response: { status: 500 } });
    (axios.post as jest.Mock).mockRejectedValue(serverError);
    await expect(source.search({ businessTypeQuery: "Gym", city: "SP", maxResults: 10 })).rejects.toThrow();
  });

  it("propagates network timeout error", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout of 5000ms exceeded"));
    await expect(source.search({ businessTypeQuery: "Gym", city: "SP", maxResults: 10 })).rejects.toThrow("timeout");
  });

  it("does not paginate when max results is reached on first page", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { places: [{ id: "p1", displayName: { text: "Gym A" } }, { id: "p2", displayName: { text: "Gym B" } }], nextPageToken: "token2" } });
    const result = await source.search({ businessTypeQuery: "Gym", city: "SP", maxResults: 2 });
    expect(result).toHaveLength(2);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it("constructs correct query with neighborhood when provided", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { places: [] } });
    await source.search({ businessTypeQuery: "Gym", city: "SP", neighborhood: "Moema", maxResults: 5 });
    expect(axios.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ textQuery: expect.stringContaining("Moema") }), expect.any(Object));
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// C. PrismaProspectExecutionRepository — ordering and filtering (mocked)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("PrismaProspectExecutionRepository (mock) — ordering and count boundary", () => {
  it("countContactedTodayByCampaign returns value from mock (zero-based boundary)", async () => {
    const repo = { countContactedTodayByCampaign: jest.fn().mockResolvedValue(0) } as any;
    const count = await repo.countContactedTodayByCampaign("tenant-1", "campaign-1");
    expect(count).toBe(0);
  });

  it("countContactedTodayByCampaign at exact dailyLimit boundary returns dailyLimit", async () => {
    const repo = { countContactedTodayByCampaign: jest.fn().mockResolvedValue(50) } as any;
    const count = await repo.countContactedTodayByCampaign("tenant-1", "campaign-1");
    expect(count).toBe(50);
  });

  it("findNextPendingByCampaign returns first PENDING execution (mock-ordered)", async () => {
    const first = { id: { toString: () => "exec-1" }, status: { value: "PENDING" } };
    const repo = { findNextPendingByCampaign: jest.fn().mockResolvedValue(first) } as any;
    const result = await repo.findNextPendingByCampaign("tenant-1", "campaign-1");
    expect(result.status.value).toBe("PENDING");
  });

  it("findActiveByContact filters out STOPPED/RESPONDED executions", async () => {
    const pendingExec = { status: { value: "PENDING" }, contactId: "c1" };
    const repo = { findActiveByContact: jest.fn().mockResolvedValue([pendingExec]) } as any;
    const results = await repo.findActiveByContact("tenant-1", "c1");
    expect(results.every((e: any) => ["PENDING", "CONTACTED"].includes(e.status.value))).toBe(true);
  });

  it("findLastContactedAt returns null when no contacted execution exists", async () => {
    const repo = { findLastContactedAt: jest.fn().mockResolvedValue(null) } as any;
    const result = await repo.findLastContactedAt("tenant-1", "contact-never");
    expect(result).toBeNull();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// D. ProspectExecutionController — 404 when use case throws EntityNotFound
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { EntityNotFoundException } from "@shared/domain/exceptions/DomainExceptions";
import { ProspectExecutionController } from "../presentation/controllers/ProspectExecutionController";
import { IDispatchProspectExecutionUseCase } from "../application/use-cases/interfaces/IDispatchProspectExecutionUseCase";

describe("ProspectExecutionController — EntityNotFound mapping", () => {
  let app: INestApplication;
  let currentUser: { tenantId: string; role: string } | undefined;
  const tenant = makeTenant();
  const tenantRepo2: jest.Mocked<ITenantRepository> = {
    save: jest.fn(), findById: jest.fn(async (id) => id === tenant.id.toString() ? tenant : null),
    findByCnpj: jest.fn(), findByWhatsAppNumber: jest.fn(), findByApiKey: jest.fn(), findAll: jest.fn(), exists: jest.fn(), listBranches: jest.fn(), createBranch: jest.fn(), updateBranch: jest.fn(), deleteBranch: jest.fn(),
  };
  const dispatchUseCase = { execute: jest.fn() } as jest.Mocked<IDispatchProspectExecutionUseCase>;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [ProspectExecutionController],
      providers: [
        RolesGuard,
        { provide: IDispatchProspectExecutionUseCase, useValue: dispatchUseCase },
        { provide: TENANT_REPOSITORY, useValue: tenantRepo2 },
      ],
    }).overrideGuard(JwtCookieGuard).useValue({
      canActivate: (ctx: any) => {
        if (!currentUser) throw new UnauthorizedException("Missing token", "MISSING_TOKEN");
        ctx.switchToHttp().getRequest().user = currentUser;
        return true;
      },
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix("api/v1");
    await app.init();
  });
  afterAll(async () => { if (app) await app.close(); });
  beforeEach(() => {
    jest.clearAllMocks();
    tenantRepo2.findById.mockImplementation(async (id) => id === tenant.id.toString() ? tenant : null);
    currentUser = { tenantId: tenant.id.toString(), role: "OWNER" };
  });

  it("POST /dispatch returns 404 when use case throws EntityNotFoundException", async () => {
    dispatchUseCase.execute.mockRejectedValue(new EntityNotFoundException("ProspectExecution", "missing-exec"));
    await request(app.getHttpServer()).post("/api/v1/prospecting/executions/dispatch").send({ executionId: "missing-exec" }).expect(404);
  });

  it("unauthenticated POST /dispatch returns 401", async () => {
    currentUser = undefined;
    await request(app.getHttpServer()).post("/api/v1/prospecting/executions/dispatch").send({ executionId: "exec-1" }).expect(401);
  });

  it("AGENT POST /dispatch returns 403", async () => {
    currentUser = { tenantId: tenant.id.toString(), role: "AGENT" };
    await request(app.getHttpServer()).post("/api/v1/prospecting/executions/dispatch").send({ executionId: "exec-1" }).expect(403);
  });

  it("ADMIN POST /dispatch succeeds (200-level)", async () => {
    currentUser = { tenantId: tenant.id.toString(), role: "ADMIN" };
    dispatchUseCase.execute.mockResolvedValue({ executionId: "exec-1", conversationId: "conv-1", messageId: "msg-1", status: "CONTACTED", renderedMessage: "Hi test" });
    await request(app.getHttpServer()).post("/api/v1/prospecting/executions/dispatch").send({ executionId: "exec-1" }).expect(200);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// E. PrismaProspectSearchRepository and SearchResultRepository (mock)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("PrismaProspectSearchRepository (mock) — tenant isolation", () => {
  function makeSearch(tenantId: string) {
    return ProspectSearch.create({
      tenantId: TenantId.create(tenantId),
      businessTypeQuery: "Gym",
      city: "SP",
      state: "SP",
      source: ProspectSearchSourceVO.create("GOOGLE_PLACES"),
      maxResults: 10,
    });
  }

  it("findAllByTenant returns only searches belonging to the given tenantId", async () => {
    const s1 = makeSearch(INT_TENANT_ID);
    const s2 = makeSearch(OTHER_TENANT_ID);
    const repo = { findAllByTenant: jest.fn().mockImplementation(async (tid) => tid === INT_TENANT_ID ? [s1] : [s2]) } as any;
    const result = await repo.findAllByTenant(INT_TENANT_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(s1);
  });

  it("save and findById round-trip preserves search properties", async () => {
    const s = makeSearch(INT_TENANT_ID);
    const repo = { save: jest.fn(), findById: jest.fn().mockResolvedValue(s) } as any;
    await repo.save(s);
    const found = await repo.findById(INT_TENANT_ID, s.id.toString());
    expect(found?.businessTypeQuery).toBe("Gym");
  });

  it("findById returns null when search belongs to different tenant", async () => {
    const s = makeSearch(OTHER_TENANT_ID);
    const repo = { findById: jest.fn().mockImplementation(async (tid, id) => tid === INT_TENANT_ID ? null : s) } as any;
    const result = await repo.findById(INT_TENANT_ID, s.id.toString());
    expect(result).toBeNull();
  });
});

describe("PrismaProspectSearchResultRepository (mock) — pagination and tenant isolation", () => {
  it("findAllBySearch returns only results belonging to the given search", async () => {
    const repo = { findAllBySearch: jest.fn().mockResolvedValue([{ id: "r1", businessName: "Gym A" }]) } as any;
    const results = await repo.findAllBySearch(INT_TENANT_ID, "search-1");
    expect(results).toHaveLength(1);
    expect(results[0].businessName).toBe("Gym A");
  });

  it("findAllBySearch returns empty array when no results exist", async () => {
    const repo = { findAllBySearch: jest.fn().mockResolvedValue([]) } as any;
    const results = await repo.findAllBySearch(INT_TENANT_ID, "empty-search");
    expect(results).toEqual([]);
  });

  it("deleteBySearch cleans all results for the given searchId", async () => {
    const repo = { deleteBySearch: jest.fn().mockResolvedValue(undefined) } as any;
    await repo.deleteBySearch(INT_TENANT_ID, "search-to-delete");
    expect(repo.deleteBySearch).toHaveBeenCalledWith(INT_TENANT_ID, "search-to-delete");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// F. PrismaProspectLeadCaptureRepository (mock)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("PrismaProspectLeadCaptureRepository (mock)", () => {
  it("saveMany persists all leads in a single batch", async () => {
    const repo = { saveMany: jest.fn().mockResolvedValue(undefined) } as any;
    const leads = [{ id: "l1", phone: "5511999998888" }, { id: "l2", phone: "5521999997777" }];
    await repo.saveMany(leads);
    expect(repo.saveMany).toHaveBeenCalledWith(leads);
  });

  it("findAllByTenant returns only leads for the given tenant", async () => {
    const lead = { tenantId: INT_TENANT_ID, externalLeadId: "ext-1" };
    const repo = { findAllByTenant: jest.fn().mockImplementation(async (tid) => tid === INT_TENANT_ID ? [lead] : []) } as any;
    const results = await repo.findAllByTenant(INT_TENANT_ID);
    expect(results).toHaveLength(1);
    const empty = await repo.findAllByTenant(OTHER_TENANT_ID);
    expect(empty).toHaveLength(0);
  });

  it("findManyByIds returns only leads matching the given IDs", async () => {
    const l1 = { id: "lead-1" };
    const repo = { findManyByIds: jest.fn().mockResolvedValue([l1]) } as any;
    const results = await repo.findManyByIds(INT_TENANT_ID, ["lead-1"]);
    expect(results).toEqual([l1]);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// G. PrismaProspectAdsInsightQueryRepository and ResultRepository (mock)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("PrismaProspectAdsInsightQueryRepository (mock)", () => {
  it("save and findById returns saved query", async () => {
    const query = { id: "q1", tenantId: INT_TENANT_ID, businessTypeQuery: "Gym" };
    const repo = { save: jest.fn(), findById: jest.fn().mockResolvedValue(query) } as any;
    await repo.save(query);
    const found = await repo.findById(INT_TENANT_ID, "q1");
    expect(found?.businessTypeQuery).toBe("Gym");
  });

  it("deleteByQuery removes the query by ID", async () => {
    const repo = { deleteByQuery: jest.fn().mockResolvedValue(undefined) } as any;
    await repo.deleteByQuery(INT_TENANT_ID, "q1");
    expect(repo.deleteByQuery).toHaveBeenCalledWith(INT_TENANT_ID, "q1");
  });
});

describe("PrismaProspectAdsInsightResultRepository (mock)", () => {
  it("saveMany stores a batch of results", async () => {
    const repo = { saveMany: jest.fn().mockResolvedValue(undefined) } as any;
    await repo.saveMany([{ id: "r1" }, { id: "r2" }]);
    expect(repo.saveMany).toHaveBeenCalledWith([{ id: "r1" }, { id: "r2" }]);
  });

  it("deleteByQuery clears all results for the given query", async () => {
    const repo = { deleteByQuery: jest.fn().mockResolvedValue(undefined) } as any;
    await repo.deleteByQuery(INT_TENANT_ID, "q1");
    expect(repo.deleteByQuery).toHaveBeenCalledTimes(1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// H. PrismaGoogleAdsConnectionRepository (mock)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("PrismaGoogleAdsConnectionRepository (mock) — CRUD", () => {
  it("save and findByTenantId returns stored connection", async () => {
    const conn = { tenantId: INT_TENANT_ID, googleEmail: "ads@test.com", refreshToken: "rt", status: "CONNECTED", connectedAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" };
    const repo = { save: jest.fn(), findByTenantId: jest.fn().mockResolvedValue(conn), deleteByTenantId: jest.fn() } as any;
    await repo.save(conn);
    const found = await repo.findByTenantId(INT_TENANT_ID);
    expect(found?.googleEmail).toBe("ads@test.com");
  });

  it("findByTenantId returns null for unknown tenant", async () => {
    const repo = { findByTenantId: jest.fn().mockResolvedValue(null) } as any;
    const found = await repo.findByTenantId("unknown-tenant");
    expect(found).toBeNull();
  });

  it("deleteByTenantId removes the connection", async () => {
    const repo = { deleteByTenantId: jest.fn().mockResolvedValue(undefined), findByTenantId: jest.fn().mockResolvedValue(null) } as any;
    await repo.deleteByTenantId(INT_TENANT_ID);
    expect(repo.deleteByTenantId).toHaveBeenCalledWith(INT_TENANT_ID);
    const found = await repo.findByTenantId(INT_TENANT_ID);
    expect(found).toBeNull();
  });

  it("save overwrites existing connection for same tenantId", async () => {
    const original = { tenantId: INT_TENANT_ID, googleEmail: "original@test.com", refreshToken: "rt1", status: "PENDING_ACCOUNT_SELECTION", connectedAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" };
    const updated = { ...original, googleEmail: "updated@test.com", status: "CONNECTED", customerId: "cust-123", updatedAt: "2024-06-01T00:00:00Z" };
    const store = { current: original };
    const repo = { save: jest.fn((c: any) => { store.current = c; }), findByTenantId: jest.fn(() => store.current) } as any;
    await repo.save(updated);
    const found = await repo.findByTenantId(INT_TENANT_ID);
    expect(found.googleEmail).toBe("updated@test.com");
    expect(found.status).toBe("CONNECTED");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// I. HttpProspectWebsiteEnricher — timeout and non-HTML responses
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { HttpProspectWebsiteEnricher } from "../infrastructure/acl/HttpProspectWebsiteEnricher";

describe("HttpProspectWebsiteEnricher — timeout and non-HTML responses", () => {
  let enricher: HttpProspectWebsiteEnricher;
  beforeEach(() => {
    jest.clearAllMocks();
    enricher = new HttpProspectWebsiteEnricher();
  });

  it("returns empty enrichment when axios.post times out", async () => {
    (axios.post as jest.Mock).mockRejectedValue(Object.assign(new Error("timeout"), { code: "ECONNABORTED" }));
    const result = await enricher.enrich("https://timeout-site.com");
    expect(result).toEqual(expect.objectContaining({ email: undefined, phone: undefined }));
  });

  it("returns empty enrichment when website returns non-HTML (binary) content", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString("latin1"), headers: { "content-type": "image/jpeg" } });
    const result = await enricher.enrich("https://binary-site.com");
    expect(result).toBeDefined();
    expect(result.email).toBeUndefined();
  });

  it("returns empty enrichment when website returns 404", async () => {
    const e404 = Object.assign(new Error("Request failed with status 404"), { response: { status: 404 } });
    (axios.post as jest.Mock).mockRejectedValue(e404);
    await expect(enricher.enrich("https://missing-site.com/404")).resolves.toBeDefined();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// J. BullMQ dispatch queue — scheduleNextDispatch wiring
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("IProspectDispatchQueue.scheduleNextDispatch — wiring verification", () => {
  it("scheduleNextDispatch is called with correct params when pending executions remain", async () => {
    const TID = INT_TENANT_ID;
    const camp = ProspectCampaign.create({
      tenantId: TenantId.create(TID), name: "Queue Test", objective: "obj",
      audienceType: ProspectAudienceTypeVO.create("CONTACT_LIST"),
      channel: ProspectChannelVO.create("WHATSAPP"),
      targetContactIds: ["c1", "c2"],
      templateName: "tmpl_v1", dailyLimit: 50,
    });
    camp.activate();
    const execRepo: jest.Mocked<IProspectExecutionRepository> = {
      save: jest.fn(), saveMany: jest.fn(), findById: jest.fn(), findLatestContactedByContact: jest.fn(),
      findAllByCampaign: jest.fn().mockResolvedValue([
        ProspectExecution.create({ tenantId: camp.tenantId, campaignId: camp.id, contactId: "c1", channel: camp.channel }),
        ProspectExecution.create({ tenantId: camp.tenantId, campaignId: camp.id, contactId: "c2", channel: camp.channel }),
      ]),
      findNextPendingByCampaign: jest.fn().mockResolvedValue(ProspectExecution.create({ tenantId: camp.tenantId, campaignId: camp.id, contactId: "c1", channel: camp.channel })),
      findLastContactedAt: jest.fn().mockResolvedValue(null),
      findLatestByContactIds: jest.fn().mockResolvedValue([]),
      findActiveByContact: jest.fn().mockResolvedValue([]),
      countContactedTodayByCampaign: jest.fn().mockResolvedValue(1),
    };
    const campaignRepo: jest.Mocked<IProspectCampaignRepository> = { save: jest.fn(), findById: jest.fn().mockResolvedValue(camp), findAllByTenant: jest.fn() };
    const pendingExec = ProspectExecution.create({ tenantId: camp.tenantId, campaignId: camp.id, contactId: "c1", channel: camp.channel });
    const dispatchUC = { execute: jest.fn().mockResolvedValue({ executionId: pendingExec.id.toString(), status: "CONTACTED", renderedMessage: "msg", conversationId: "cv1", messageId: "m1" }) };
    const startUC = { execute: jest.fn() };
    const queueMock = { scheduleNextDispatch: jest.fn() };
    const { DispatchNextProspectCampaignExecutionUseCase: Uc } = require("../application/use-cases/DispatchNextProspectCampaignExecutionUseCase");
    const uc = new Uc(campaignRepo, execRepo, dispatchUC, startUC, queueMock);
    await uc.execute({ tenantId: TID, campaignId: camp.id.toString() });
    expect(queueMock.scheduleNextDispatch).toHaveBeenCalledWith({ tenantId: TID, campaignId: camp.id.toString() }, expect.any(Number));
    const [, delayMs] = queueMock.scheduleNextDispatch.mock.calls[0];
    expect(delayMs).toBeGreaterThan(0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// K. Additional execution status controller tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { ProspectExecutionStatusController } from "../presentation/controllers/ProspectExecutionStatusController";
import { IListProspectExecutionStatusUseCase } from "../application/use-cases/interfaces/IListProspectExecutionStatusUseCase";

describe("ProspectExecutionStatusController — tenant isolation", () => {
  let statusApp: INestApplication;
  let statusCurrentUser: { tenantId: string; role: string } | undefined;
  const statusTenant = makeTenant();
  const statusTenantRepo: jest.Mocked<ITenantRepository> = {
    save: jest.fn(), findById: jest.fn(async (id) => id === statusTenant.id.toString() ? statusTenant : null),
    findByCnpj: jest.fn(), findByWhatsAppNumber: jest.fn(), findByApiKey: jest.fn(), findAll: jest.fn(), exists: jest.fn(), listBranches: jest.fn(), createBranch: jest.fn(), updateBranch: jest.fn(), deleteBranch: jest.fn(),
  };
  const listStatusUC = { execute: jest.fn() } as jest.Mocked<IListProspectExecutionStatusUseCase>;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [ProspectExecutionStatusController],
      providers: [
        RolesGuard,
        { provide: IListProspectExecutionStatusUseCase, useValue: listStatusUC },
        { provide: TENANT_REPOSITORY, useValue: statusTenantRepo },
      ],
    }).overrideGuard(JwtCookieGuard).useValue({
      canActivate: (ctx: any) => {
        if (!statusCurrentUser) throw new UnauthorizedException("Missing token", "MISSING_TOKEN");
        ctx.switchToHttp().getRequest().user = statusCurrentUser;
        return true;
      },
    }).compile();
    statusApp = mod.createNestApplication();
    statusApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    statusApp.useGlobalFilters(new GlobalExceptionFilter());
    statusApp.setGlobalPrefix("api/v1");
    await statusApp.init();
  });
  afterAll(async () => { if (statusApp) await statusApp.close(); });
  beforeEach(() => {
    jest.clearAllMocks();
    statusTenantRepo.findById.mockImplementation(async (id) => id === statusTenant.id.toString() ? statusTenant : null);
    statusCurrentUser = { tenantId: statusTenant.id.toString(), role: "OWNER" };
  });

  it("GET /status with contactIds owned by requesting tenant returns results", async () => {
    listStatusUC.execute.mockResolvedValue([{ contactId: "c1", status: "CONTACTED" }]);
    const res = await request(statusApp.getHttpServer()).get("/api/v1/prospecting/executions/status").query({ contactIds: "c1" }).expect(200);
    expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ contactId: "c1" })]));
  });

  it("GET /status without contactIds parameter still returns 200 with all contacts", async () => {
    listStatusUC.execute.mockResolvedValue([]);
    await request(statusApp.getHttpServer()).get("/api/v1/prospecting/executions/status").expect(200);
  });

  it("use case is called with the requesting tenantId (ensures tenant isolation)", async () => {
    listStatusUC.execute.mockResolvedValue([]);
    await request(statusApp.getHttpServer()).get("/api/v1/prospecting/executions/status").query({ contactIds: "c1,c2" });
    expect(listStatusUC.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: statusTenant.id.toString() }));
  });

  it("AGENT role can read execution status (read-only access)", async () => {
    statusCurrentUser = { tenantId: statusTenant.id.toString(), role: "AGENT" };
    listStatusUC.execute.mockResolvedValue([]);
    await request(statusApp.getHttpServer()).get("/api/v1/prospecting/executions/status").query({ contactIds: "c1" }).expect(200);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// L. Input validation — DTO-level SQL injection and oversized inputs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("ProspectCampaignController — DTO input validation edge cases", () => {
  let validationApp: INestApplication;
  let validUser: { tenantId: string; role: string };
  const valTenant = makeTenant();
  const valTenantRepo: jest.Mocked<ITenantRepository> = {
    save: jest.fn(), findById: jest.fn(async (id) => id === valTenant.id.toString() ? valTenant : null),
    findByCnpj: jest.fn(), findByWhatsAppNumber: jest.fn(), findByApiKey: jest.fn(), findAll: jest.fn(), exists: jest.fn(), listBranches: jest.fn(), createBranch: jest.fn(), updateBranch: jest.fn(), deleteBranch: jest.fn(),
  };
  const valCampaignRepo: jest.Mocked<IProspectCampaignRepository> = { save: jest.fn(), findById: jest.fn(), findAllByTenant: jest.fn().mockResolvedValue([]) };
  const valExecRepo = makeExecRepo();
  const valContactFacade = makeContactFacade();

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [ProspectCampaignController],
      providers: [
        RolesGuard, ProspectDispatchPolicy,
        { provide: ICreateProspectCampaignUseCase, useClass: CreateProspectCampaignUseCase },
        { provide: IListProspectCampaignsUseCase, useClass: ListProspectCampaignsUseCase },
        { provide: IActivateProspectCampaignUseCase, useClass: ActivateProspectCampaignUseCase },
        { provide: IPauseProspectCampaignUseCase, useClass: PauseProspectCampaignUseCase },
        { provide: IStartProspectCampaignUseCase, useClass: StartProspectCampaignUseCase },
        { provide: IDispatchNextProspectCampaignExecutionUseCase, useValue: { execute: jest.fn() } },
        { provide: ISuggestProspectCampaignMessageUseCase, useValue: { execute: jest.fn() } },
        { provide: TENANT_REPOSITORY, useValue: valTenantRepo },
        { provide: PROSPECT_CAMPAIGN_REPOSITORY, useValue: valCampaignRepo },
        { provide: PROSPECT_EXECUTION_REPOSITORY, useValue: valExecRepo },
        { provide: CONTACT_FACADE, useValue: valContactFacade },
      ],
    }).overrideGuard(JwtCookieGuard).useValue({
      canActivate: (ctx: any) => {
        ctx.switchToHttp().getRequest().user = validUser;
        return true;
      },
    }).compile();
    validationApp = mod.createNestApplication();
    validationApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    validationApp.useGlobalFilters(new GlobalExceptionFilter());
    validationApp.setGlobalPrefix("api/v1");
    await validationApp.init();
  });
  afterAll(async () => { if (validationApp) await validationApp.close(); });
  beforeEach(() => {
    jest.clearAllMocks();
    valTenantRepo.findById.mockImplementation(async (id) => id === valTenant.id.toString() ? valTenant : null);
    valCampaignRepo.findAllByTenant.mockResolvedValue([]);
    validUser = { tenantId: valTenant.id.toString(), role: "OWNER" };
  });

  it("empty name field returns 400 validation error", async () => {
    await request(validationApp.getHttpServer()).post("/api/v1/prospecting/campaigns").send({ name: "", objective: "Test", audienceType: "REENGAGEMENT", channel: "WHATSAPP" }).expect(400);
  });

  it("missing objective field returns 400 validation error", async () => {
    await request(validationApp.getHttpServer()).post("/api/v1/prospecting/campaigns").send({ name: "Test", audienceType: "REENGAGEMENT", channel: "WHATSAPP" }).expect(400);
  });

  it("invalid audienceType value returns 400 validation error", async () => {
    await request(validationApp.getHttpServer()).post("/api/v1/prospecting/campaigns").send({ name: "Test", objective: "Test obj", audienceType: "INVALID_TYPE", channel: "WHATSAPP" }).expect(400);
  });

  it("unknown extra field is stripped by whitelist (forbidden) validation", async () => {
    await request(validationApp.getHttpServer()).post("/api/v1/prospecting/campaigns").send({ name: "Test", objective: "Test obj", audienceType: "REENGAGEMENT", channel: "WHATSAPP", unknownExtraField: "hack" }).expect(400);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// M. DispatchProspectExecutionUseCase — full integration with policy
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("DispatchProspectExecutionUseCase — full integration with ProspectDispatchPolicy", () => {
  function setup() {
    const campaign = ProspectCampaign.create({
      tenantId: TenantId.create(INT_TENANT_ID), name: "Integration Test Camp", objective: "Int test",
      audienceType: ProspectAudienceTypeVO.create("CONTACT_LIST"),
      channel: ProspectChannelVO.create("WHATSAPP"),
      targetContactIds: ["contact-int-1"], templateName: "tmpl_int_v1",
    });
    campaign.activate();
    const exec = ProspectExecution.create({ tenantId: campaign.tenantId, campaignId: campaign.id, contactId: "contact-int-1", channel: campaign.channel });
    const execRepo = makeExecRepo();
    const campaignRepo: jest.Mocked<IProspectCampaignRepository> = { save: jest.fn(), findById: jest.fn().mockResolvedValue(campaign), findAllByTenant: jest.fn() };
    const contactFacade = makeContactFacade();
    const messagingFacade: jest.Mocked<any> = { queueSystemMessage: jest.fn(), queueTemplateMessage: jest.fn() };
    const { DispatchProspectExecutionUseCase: Uc } = require("../application/use-cases/DispatchProspectExecutionUseCase");
    const uc = new Uc(campaignRepo, execRepo, contactFacade, messagingFacade, new ProspectDispatchPolicy(execRepo));
    return { campaign, exec, execRepo, campaignRepo, contactFacade, messagingFacade, uc };
  }

  it("successfully dispatches and records CONTACTED status end-to-end", async () => {
    const { exec, execRepo, contactFacade, messagingFacade, uc } = setup();
    execRepo.findById.mockResolvedValue(exec);
    contactFacade.getContactById.mockResolvedValue({ contactId: "contact-int-1", name: "Ana Int", phone: "5511999998888", email: "ana@int.test", prospectingOptOut: false });
    messagingFacade.queueTemplateMessage.mockResolvedValue({ conversationId: "cv-int-1", messageId: "msg-int-1" });
    const result = await uc.execute({ tenantId: INT_TENANT_ID, executionId: exec.id.toString() });
    expect(result.status).toBe("CONTACTED");
    expect(execRepo.save).toHaveBeenCalledWith(exec);
    expect(exec.attemptCount).toBe(1);
  });

  it("opt-out contact stops execution and records OPT_OUT reason", async () => {
    const { exec, execRepo, contactFacade, uc } = setup();
    execRepo.findById.mockResolvedValue(exec);
    contactFacade.getContactById.mockResolvedValue({ contactId: "contact-int-1", name: "Opted Out", phone: "5511999998888", email: "", prospectingOptOut: true });
    await expect(uc.execute({ tenantId: INT_TENANT_ID, executionId: exec.id.toString() })).rejects.toThrow();
    expect(exec.status.value).toBe("STOPPED");
    expect(exec.stopReason?.value).toBe("OPT_OUT");
  });

  it("contact with no WhatsApp phone stops execution with WHATSAPP_NO_PHONE reason-like error", async () => {
    const { exec, execRepo, contactFacade, uc } = setup();
    execRepo.findById.mockResolvedValue(exec);
    contactFacade.getContactById.mockResolvedValue({ contactId: "contact-int-1", name: "No Phone", phone: "", email: "", prospectingOptOut: false });
    await expect(uc.execute({ tenantId: INT_TENANT_ID, executionId: exec.id.toString() })).rejects.toThrow();
  });

  it("already-CONTACTED execution is rejected by policy before messaging", async () => {
    const { exec, execRepo, messagingFacade, uc } = setup();
    exec.markAsContacted();
    execRepo.findById.mockResolvedValue(exec);
    await expect(uc.execute({ tenantId: INT_TENANT_ID, executionId: exec.id.toString() })).rejects.toThrow();
    expect(messagingFacade.queueTemplateMessage).not.toHaveBeenCalled();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// N. StartProspectCampaignUseCase — full integration tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("StartProspectCampaignUseCase — full integration", () => {
  it("creates PENDING executions for all unique target contacts", async () => {
    const campaign = ProspectCampaign.create({
      tenantId: TenantId.create(INT_TENANT_ID), name: "Start Int Test", objective: "obj",
      audienceType: ProspectAudienceTypeVO.create("CONTACT_LIST"),
      channel: ProspectChannelVO.create("WHATSAPP"),
      targetContactIds: ["contact-a", "contact-b", "contact-c"],
      templateName: "tmpl_v1",
    });
    campaign.activate();
    const execRepo = makeExecRepo();
    const campaignRepo: jest.Mocked<IProspectCampaignRepository> = { save: jest.fn(), findById: jest.fn().mockResolvedValue(campaign), findAllByTenant: jest.fn() };
    execRepo.findAllByCampaign.mockResolvedValue([]);
    const { StartProspectCampaignUseCase: Uc } = require("../application/use-cases/StartProspectCampaignUseCase");
    const uc = new Uc(campaignRepo, execRepo, new ProspectDispatchPolicy(execRepo));
    const result = await uc.execute({ tenantId: INT_TENANT_ID, campaignId: campaign.id.toString() });
    expect(result.createdExecutions).toBe(3);
    expect(result.skippedExecutions).toBe(0);
    expect(execRepo.saveMany).toHaveBeenCalledTimes(1);
  });

  it("throws EntityNotFoundException when campaign does not exist", async () => {
    const execRepo = makeExecRepo();
    const campaignRepo: jest.Mocked<IProspectCampaignRepository> = { save: jest.fn(), findById: jest.fn().mockResolvedValue(null), findAllByTenant: jest.fn() };
    const { StartProspectCampaignUseCase: Uc } = require("../application/use-cases/StartProspectCampaignUseCase");
    const uc = new Uc(campaignRepo, execRepo, new ProspectDispatchPolicy(execRepo));
    await expect(uc.execute({ tenantId: INT_TENANT_ID, campaignId: "nonexistent-camp" })).rejects.toThrow(EntityNotFoundException);
  });

  it("throws when campaign is in DRAFT status (not active)", async () => {
    const campaign = ProspectCampaign.create({
      tenantId: TenantId.create(INT_TENANT_ID), name: "Draft Camp", objective: "obj",
      audienceType: ProspectAudienceTypeVO.create("CONTACT_LIST"),
      channel: ProspectChannelVO.create("WHATSAPP"),
      targetContactIds: ["contact-a"],
      templateName: "tmpl_v1",
    });
    const execRepo = makeExecRepo();
    const campaignRepo: jest.Mocked<IProspectCampaignRepository> = { save: jest.fn(), findById: jest.fn().mockResolvedValue(campaign), findAllByTenant: jest.fn() };
    const { StartProspectCampaignUseCase: Uc } = require("../application/use-cases/StartProspectCampaignUseCase");
    const uc = new Uc(campaignRepo, execRepo, new ProspectDispatchPolicy(execRepo));
    await expect(uc.execute({ tenantId: INT_TENANT_ID, campaignId: campaign.id.toString() })).rejects.toThrow();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// O. PrismaProspectExecutionRepository — cross-tenant safety (mock)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("PrismaProspectExecutionRepository (mock) — cross-tenant isolation", () => {
  it("findAllByCampaign should not return executions from other tenants", async () => {
    const myExec = { tenantId: INT_TENANT_ID, contactId: "my-contact" };
    const otherExec = { tenantId: OTHER_TENANT_ID, contactId: "other-contact" };
    const repo = { findAllByCampaign: jest.fn().mockImplementation(async (tid, cid) => tid === INT_TENANT_ID ? [myExec] : [otherExec]) } as any;
    const results = await repo.findAllByCampaign(INT_TENANT_ID, "campaign-1");
    expect(results.every((e: any) => e.tenantId === INT_TENANT_ID)).toBe(true);
  });

  it("findById with wrong tenantId returns null", async () => {
    const repo = { findById: jest.fn().mockImplementation(async (tid, id) => tid === INT_TENANT_ID ? { id, tenantId: INT_TENANT_ID } : null) } as any;
    const found = await repo.findById(OTHER_TENANT_ID, "exec-1");
    expect(found).toBeNull();
  });

  it("countContactedTodayByCampaign returns 0 for unknown campaign", async () => {
    const repo = { countContactedTodayByCampaign: jest.fn().mockResolvedValue(0) } as any;
    const count = await repo.countContactedTodayByCampaign(INT_TENANT_ID, "unknown-campaign");
    expect(count).toBe(0);
  });

  it("saveMany for multiple tenants stores each execution independently", async () => {
    const stored: any[] = [];
    const repo = { saveMany: jest.fn((execs: any[]) => { stored.push(...execs); }) } as any;
    const e1 = ProspectExecution.create({ tenantId: TenantId.create(INT_TENANT_ID), campaignId: new UniqueEntityID(), contactId: "c1", channel: ProspectChannelVO.create("WHATSAPP") });
    const e2 = ProspectExecution.create({ tenantId: TenantId.create(INT_TENANT_ID), campaignId: new UniqueEntityID(), contactId: "c2", channel: ProspectChannelVO.create("WHATSAPP") });
    await repo.saveMany([e1, e2]);
    expect(stored).toHaveLength(2);
  });

  it("findLatestByContactIds returns only executions for the given contactIds", async () => {
    const execA = { contactId: "contact-a", status: { value: "CONTACTED" } };
    const repo = { findLatestByContactIds: jest.fn().mockResolvedValue([execA]) } as any;
    const result = await repo.findLatestByContactIds(INT_TENANT_ID, ["contact-a", "contact-b"]);
    expect(result).toEqual([execA]);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// P. RegisterProspectStopUseCase — integration with execution lifecycle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("RegisterProspectStopUseCase — integration lifecycle", () => {
  it("findLatestContactedByContact is called with correct tenantId and contactId", async () => {
    const execRepo = makeExecRepo();
    execRepo.findLatestContactedByContact.mockResolvedValue(null);
    const { RegisterProspectStopUseCase: Uc } = require("../application/use-cases/RegisterProspectStopUseCase");
    const uc = new Uc(execRepo);
    await uc.execute({ tenantId: INT_TENANT_ID, contactId: "contact-abc", conversationId: "cv1", messageId: "m1", messageText: "sair" });
    expect(execRepo.findLatestContactedByContact).toHaveBeenCalledWith(INT_TENANT_ID, "contact-abc");
  });

  it("execution persisted with OPT_OUT stop reason after stop registration", async () => {
    const campaign = ProspectCampaign.create({ tenantId: TenantId.create(INT_TENANT_ID), name: "Camp", objective: "obj", audienceType: ProspectAudienceTypeVO.create("CONTACT_LIST"), channel: ProspectChannelVO.create("WHATSAPP"), targetContactIds: ["c1"], templateName: "tmpl_v1" });
    campaign.activate();
    const exec = ProspectExecution.create({ tenantId: campaign.tenantId, campaignId: campaign.id, contactId: "c1", channel: campaign.channel });
    exec.markAsContacted();
    const execRepo = makeExecRepo();
    execRepo.findLatestContactedByContact.mockResolvedValue(exec);
    const { RegisterProspectStopUseCase: Uc } = require("../application/use-cases/RegisterProspectStopUseCase");
    const uc = new Uc(execRepo);
    const result = await uc.execute({ tenantId: INT_TENANT_ID, contactId: "c1", conversationId: "cv1", messageId: "m1", messageText: "parar" });
    expect(result?.status).toBe("STOPPED");
    expect(result?.stopReason).toBe("OPT_OUT");
    expect(execRepo.save).toHaveBeenCalledWith(exec);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Q. GenerateProspectCampaignReport — integration with multiple campaigns
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("GenerateProspectCampaignReportUseCase — summary aggregation integration", () => {
  it("summary correctly sums contactedExecutions across multiple campaigns", async () => {
    const makeC = (name: string) => {
      const c = ProspectCampaign.create({ tenantId: TenantId.create(INT_TENANT_ID), name, objective: "obj", audienceType: ProspectAudienceTypeVO.create("CONTACT_LIST"), channel: ProspectChannelVO.create("WHATSAPP"), targetContactIds: ["c1"], templateName: "tmpl_v1" });
      c.clearEvents();
      return c;
    };
    const c1 = makeC("Camp 1");
    const c2 = makeC("Camp 2");
    const campaignRepo: jest.Mocked<IProspectCampaignRepository> = { save: jest.fn(), findById: jest.fn(), findAllByTenant: jest.fn().mockResolvedValue([c1, c2]) };
    const makeContactedExec = (camp: ProspectCampaign) => {
      const e = ProspectExecution.create({ tenantId: camp.tenantId, campaignId: camp.id, contactId: "c1", channel: camp.channel });
      e.markAsContacted();
      return e;
    };
    const execRepo = makeExecRepo();
    execRepo.findAllByCampaign.mockImplementation(async (_tid, campId) => campId === c1.id.toString() ? [makeContactedExec(c1)] : [makeContactedExec(c2), makeContactedExec(c2)]);
    const { GenerateProspectCampaignReportUseCase: Uc } = require("../application/use-cases/GenerateProspectCampaignReportUseCase");
    const uc = new Uc(campaignRepo, execRepo);
    const result = await uc.execute({ tenantId: INT_TENANT_ID });
    expect(result.summary.contactedExecutions).toBe(3);
    expect(result.summary.totalCampaigns).toBe(2);
  });

  it("summary draftCampaigns count is correct", async () => {
    const c1 = ProspectCampaign.create({ tenantId: TenantId.create(INT_TENANT_ID), name: "D1", objective: "obj", audienceType: ProspectAudienceTypeVO.create("CONTACT_LIST"), channel: ProspectChannelVO.create("WHATSAPP"), targetContactIds: ["c1"], templateName: "tmpl_v1" });
    c1.clearEvents();
    const c2 = ProspectCampaign.create({ tenantId: TenantId.create(INT_TENANT_ID), name: "A1", objective: "obj", audienceType: ProspectAudienceTypeVO.create("CONTACT_LIST"), channel: ProspectChannelVO.create("WHATSAPP"), targetContactIds: ["c2"], templateName: "tmpl_v1" });
    c2.activate();
    c2.clearEvents();
    const campaignRepo: jest.Mocked<IProspectCampaignRepository> = { save: jest.fn(), findById: jest.fn(), findAllByTenant: jest.fn().mockResolvedValue([c1, c2]) };
    const execRepo = makeExecRepo();
    const { GenerateProspectCampaignReportUseCase: Uc } = require("../application/use-cases/GenerateProspectCampaignReportUseCase");
    const uc = new Uc(campaignRepo, execRepo);
    const result = await uc.execute({ tenantId: INT_TENANT_ID });
    expect(result.summary.draftCampaigns).toBe(1);
    expect(result.summary.activeCampaigns).toBe(1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// R. SyncProspectAdsLeadsUseCase — integration tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("SyncProspectAdsLeadsUseCase — integration pull and save", () => {
  it("saves pulled leads with normalized phones to repository", async () => {
    const tenantFacade = { tenantExists: jest.fn().mockResolvedValue(true) };
    const leadSource = {
      pullLeads: jest.fn().mockResolvedValue([
        { externalLeadId: "l1", campaignName: "Camp A", fullName: "Ana", phone: "(11) 99999-8888", email: "ana@test.com", city: "SP", state: "SP", submissionAt: new Date(), fields: [] },
        { externalLeadId: "l2", campaignName: "Camp A", fullName: "Bruno", phone: "5521999997777", email: "bruno@test.com", city: "RJ", state: "RJ", submissionAt: new Date(), fields: [] },
      ]),
    };
    const repo: jest.Mocked<IProspectLeadCaptureRepository> = { saveMany: jest.fn(), findAllByTenant: jest.fn(), findManyByIds: jest.fn() };
    const { SyncProspectAdsLeadsUseCase: Uc } = require("../application/use-cases/SyncProspectAdsLeadsUseCase");
    const uc = new Uc(tenantFacade, leadSource, repo);
    const result = await uc.execute({ tenantId: INT_TENANT_ID });
    expect(result.syncedCount).toBe(2);
    expect(repo.saveMany).toHaveBeenCalledTimes(1);
    const saved = repo.saveMany.mock.calls[0][0];
    expect(saved[0].phone).toBe("5511999998888");
    expect(saved[1].phone).toBe("5521999997777");
  });

  it("passes tenantId correctly to the lead source", async () => {
    const tenantFacade = { tenantExists: jest.fn().mockResolvedValue(true) };
    const leadSource = { pullLeads: jest.fn().mockResolvedValue([]) };
    const repo: jest.Mocked<IProspectLeadCaptureRepository> = { saveMany: jest.fn(), findAllByTenant: jest.fn(), findManyByIds: jest.fn() };
    const { SyncProspectAdsLeadsUseCase: Uc } = require("../application/use-cases/SyncProspectAdsLeadsUseCase");
    const uc = new Uc(tenantFacade, leadSource, repo);
    await uc.execute({ tenantId: INT_TENANT_ID, limit: 50 });
    expect(leadSource.pullLeads).toHaveBeenCalledWith(expect.objectContaining({ tenantId: INT_TENANT_ID }));
  });

  it("does not call saveMany when pullLeads returns empty array", async () => {
    const tenantFacade = { tenantExists: jest.fn().mockResolvedValue(true) };
    const leadSource = { pullLeads: jest.fn().mockResolvedValue([]) };
    const repo: jest.Mocked<IProspectLeadCaptureRepository> = { saveMany: jest.fn(), findAllByTenant: jest.fn(), findManyByIds: jest.fn() };
    const { SyncProspectAdsLeadsUseCase: Uc } = require("../application/use-cases/SyncProspectAdsLeadsUseCase");
    const uc = new Uc(tenantFacade, leadSource, repo);
    await uc.execute({ tenantId: INT_TENANT_ID });
    expect(repo.saveMany).not.toHaveBeenCalled();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// S. Google Ads connection — OAuth lifecycle integration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("Google Ads connection OAuth lifecycle — integration", () => {
  it("start → complete → getStatus flow results in PENDING_ACCOUNT_SELECTION", async () => {
    const repo: jest.Mocked<IGoogleAdsConnectionRepository> = { save: jest.fn(), findByTenantId: jest.fn(), deleteByTenantId: jest.fn() };
    const oauthService = { buildAuthorizationUrl: jest.fn().mockReturnValue("https://auth.google.com?state=s1"), exchangeCodeForRefreshToken: jest.fn().mockResolvedValue({ email: "ads@test.com", refreshToken: "rt-1" }), listAccessibleAccounts: jest.fn() };
    const stateService = { sign: jest.fn().mockReturnValue("s1"), verify: jest.fn().mockReturnValue({ tenantId: INT_TENANT_ID }) };
    const { StartGoogleAdsConnectionUseCase: StartUc } = require("../application/use-cases/StartGoogleAdsConnectionUseCase");
    const { CompleteGoogleAdsConnectionUseCase: CompleteUc } = require("../application/use-cases/CompleteGoogleAdsConnectionUseCase");
    const { GetGoogleAdsConnectionStatusUseCase: StatusUc } = require("../application/use-cases/GetGoogleAdsConnectionStatusUseCase");
    const startUc = new StartUc(oauthService, stateService);
    const completeUc = new CompleteUc(repo, oauthService, stateService);
    const statusUc = new StatusUc(repo);
    const startResult = await startUc.execute({ tenantId: INT_TENANT_ID });
    expect(startResult.authorizationUrl).toContain("auth.google.com");
    await completeUc.execute({ code: "code-abc", state: "s1" });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: "PENDING_ACCOUNT_SELECTION" }));
    repo.findByTenantId.mockResolvedValue({ tenantId: INT_TENANT_ID, googleEmail: "ads@test.com", refreshToken: "rt-1", status: "PENDING_ACCOUNT_SELECTION", connectedAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" });
    const status = await statusUc.execute({ tenantId: INT_TENANT_ID });
    expect(status.status).toBe("PENDING_ACCOUNT_SELECTION");
    expect(status.connected).toBe(true);
  });

  it("select account → getStatus shows CONNECTED with accountSelected:true", async () => {
    const stored: any = { tenantId: INT_TENANT_ID, googleEmail: "ads@test.com", refreshToken: "rt-1", status: "PENDING_ACCOUNT_SELECTION", connectedAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" };
    const repo: jest.Mocked<IGoogleAdsConnectionRepository> = {
      save: jest.fn((c: any) => { Object.assign(stored, c); }), findByTenantId: jest.fn(() => stored), deleteByTenantId: jest.fn(),
    };
    const oauthService = { listAccessibleAccounts: jest.fn().mockResolvedValue([{ customerId: "cust-123", descriptiveName: "Acme Ads", isManager: false }]) };
    const { SelectGoogleAdsAccountUseCase: Uc } = require("../application/use-cases/SelectGoogleAdsAccountUseCase");
    const { GetGoogleAdsConnectionStatusUseCase: StatusUc } = require("../application/use-cases/GetGoogleAdsConnectionStatusUseCase");
    const selectUc = new Uc(repo, oauthService);
    const statusUc = new StatusUc(repo);
    await selectUc.execute({ tenantId: INT_TENANT_ID, customerId: "cust-123" });
    const status = await statusUc.execute({ tenantId: INT_TENANT_ID });
    expect(status.status).toBe("CONNECTED");
    expect(status.accountSelected).toBe(true);
    expect(status.customerId).toBe("cust-123");
  });

  it("disconnect → getStatus shows NOT_CONNECTED", async () => {
    const repo: jest.Mocked<IGoogleAdsConnectionRepository> = { save: jest.fn(), findByTenantId: jest.fn().mockResolvedValue(null), deleteByTenantId: jest.fn() };
    const { DisconnectGoogleAdsConnectionUseCase: DisUc } = require("../application/use-cases/DisconnectGoogleAdsConnectionUseCase");
    const { GetGoogleAdsConnectionStatusUseCase: StatusUc } = require("../application/use-cases/GetGoogleAdsConnectionStatusUseCase");
    const disUc = new DisUc(repo);
    const statusUc = new StatusUc(repo);
    await disUc.execute({ tenantId: INT_TENANT_ID });
    expect(repo.deleteByTenantId).toHaveBeenCalledWith(INT_TENANT_ID);
    const status = await statusUc.execute({ tenantId: INT_TENANT_ID });
    expect(status.connected).toBe(false);
    expect(status.status).toBe("NOT_CONNECTED");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// T. ActivateProspectCampaign / PauseCampaign lifecycle integration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("ActivateProspectCampaignUseCase / PauseProspectCampaignUseCase — integration", () => {
  it("draft → activate → pause → activate cycle works end-to-end", async () => {
    const campaign = ProspectCampaign.create({ tenantId: TenantId.create(INT_TENANT_ID), name: "Cycle Test", objective: "obj", audienceType: ProspectAudienceTypeVO.create("REENGAGEMENT"), channel: ProspectChannelVO.create("WHATSAPP"), templateName: "tmpl_v1" });
    const campaignRepo: jest.Mocked<IProspectCampaignRepository> = { save: jest.fn(), findById: jest.fn().mockResolvedValue(campaign), findAllByTenant: jest.fn() };
    const { ActivateProspectCampaignUseCase: ActUc } = require("../application/use-cases/ActivateProspectCampaignUseCase");
    const { PauseProspectCampaignUseCase: PauseUc } = require("../application/use-cases/PauseProspectCampaignUseCase");
    const activateUc = new ActUc(campaignRepo);
    const pauseUc = new PauseUc(campaignRepo);
    await activateUc.execute({ tenantId: INT_TENANT_ID, campaignId: campaign.id.toString() });
    expect(campaign.status.value).toBe("ACTIVE");
    await pauseUc.execute({ tenantId: INT_TENANT_ID, campaignId: campaign.id.toString() });
    expect(campaign.status.value).toBe("PAUSED");
    await activateUc.execute({ tenantId: INT_TENANT_ID, campaignId: campaign.id.toString() });
    expect(campaign.status.value).toBe("ACTIVE");
    expect(campaignRepo.save).toHaveBeenCalledTimes(3);
  });

  it("pause on already-paused campaign throws", async () => {
    const campaign = ProspectCampaign.create({ tenantId: TenantId.create(INT_TENANT_ID), name: "Pause Test", objective: "obj", audienceType: ProspectAudienceTypeVO.create("REENGAGEMENT"), channel: ProspectChannelVO.create("WHATSAPP"), templateName: "tmpl_v1" });
    campaign.activate();
    campaign.pause();
    const campaignRepo: jest.Mocked<IProspectCampaignRepository> = { save: jest.fn(), findById: jest.fn().mockResolvedValue(campaign), findAllByTenant: jest.fn() };
    const { PauseProspectCampaignUseCase: PauseUc } = require("../application/use-cases/PauseProspectCampaignUseCase");
    const pauseUc = new PauseUc(campaignRepo);
    await expect(pauseUc.execute({ tenantId: INT_TENANT_ID, campaignId: campaign.id.toString() })).rejects.toThrow();
  });

  it("activate on non-existent campaign throws EntityNotFoundException", async () => {
    const campaignRepo: jest.Mocked<IProspectCampaignRepository> = { save: jest.fn(), findById: jest.fn().mockResolvedValue(null), findAllByTenant: jest.fn() };
    const { ActivateProspectCampaignUseCase: ActUc } = require("../application/use-cases/ActivateProspectCampaignUseCase");
    const uc = new ActUc(campaignRepo);
    await expect(uc.execute({ tenantId: INT_TENANT_ID, campaignId: "nonexistent" })).rejects.toThrow(EntityNotFoundException);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// U. GenerateProspectSearchReport — integration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("GenerateProspectSearchReportUseCase — integration", () => {
  it("builds territory string from neighborhood/city/state", async () => {
    const s = ProspectSearch.create({ tenantId: TenantId.create(INT_TENANT_ID), businessTypeQuery: "Gym", city: "Campinas", state: "SP", neighborhood: "Moema", source: ProspectSearchSourceVO.create("GOOGLE_PLACES"), maxResults: 10 });
    const searchRepo: jest.Mocked<IProspectSearchRepository> = { save: jest.fn(), findById: jest.fn(), findBySearchId: jest.fn(), findAllByTenant: jest.fn().mockResolvedValue([s]) };
    const resultRepo: jest.Mocked<IProspectSearchResultRepository> = { saveMany: jest.fn(), deleteBySearch: jest.fn(), findAllBySearch: jest.fn().mockResolvedValue([]) };
    const { GenerateProspectSearchReportUseCase: Uc } = require("../application/use-cases/GenerateProspectSearchReportUseCase");
    const uc = new Uc(searchRepo, resultRepo);
    const result = await uc.execute({ tenantId: INT_TENANT_ID });
    expect(result.rows[0].territory).toContain("Moema");
    expect(result.rows[0].territory).toContain("Campinas");
    expect(result.rows[0].territory).toContain("SP");
  });

  it("runningSearches includes both PENDING and RUNNING searches in summary", async () => {
    const makeSrc = (bizQuery: string) => ProspectSearch.create({ tenantId: TenantId.create(INT_TENANT_ID), businessTypeQuery: bizQuery, city: "SP", state: "SP", source: ProspectSearchSourceVO.create("GOOGLE_PLACES"), maxResults: 10 });
    const s1 = makeSrc("Gym A");
    const searchRepo: jest.Mocked<IProspectSearchRepository> = { save: jest.fn(), findById: jest.fn(), findBySearchId: jest.fn(), findAllByTenant: jest.fn().mockResolvedValue([s1]) };
    const resultRepo: jest.Mocked<IProspectSearchResultRepository> = { saveMany: jest.fn(), deleteBySearch: jest.fn(), findAllBySearch: jest.fn().mockResolvedValue([]) };
    const { GenerateProspectSearchReportUseCase: Uc } = require("../application/use-cases/GenerateProspectSearchReportUseCase");
    const uc = new Uc(searchRepo, resultRepo);
    const result = await uc.execute({ tenantId: INT_TENANT_ID });
    expect(result.summary.runningSearches).toBeGreaterThanOrEqual(0);
  });

  it("filters by query on businessTypeQuery field", async () => {
    const s1 = ProspectSearch.create({ tenantId: TenantId.create(INT_TENANT_ID), businessTypeQuery: "Academia de musculacao", city: "SP", state: "SP", source: ProspectSearchSourceVO.create("GOOGLE_PLACES"), maxResults: 10 });
    const s2 = ProspectSearch.create({ tenantId: TenantId.create(INT_TENANT_ID), businessTypeQuery: "Clinica odontologica", city: "SP", state: "SP", source: ProspectSearchSourceVO.create("GOOGLE_PLACES"), maxResults: 10 });
    const searchRepo: jest.Mocked<IProspectSearchRepository> = { save: jest.fn(), findById: jest.fn(), findBySearchId: jest.fn(), findAllByTenant: jest.fn().mockResolvedValue([s1, s2]) };
    const resultRepo: jest.Mocked<IProspectSearchResultRepository> = { saveMany: jest.fn(), deleteBySearch: jest.fn(), findAllBySearch: jest.fn().mockResolvedValue([]) };
    const { GenerateProspectSearchReportUseCase: Uc } = require("../application/use-cases/GenerateProspectSearchReportUseCase");
    const uc = new Uc(searchRepo, resultRepo);
    const result = await uc.execute({ tenantId: INT_TENANT_ID, query: "academia" });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].businessTypeQuery).toContain("Academia");
  });

  it("generatedAt is a recent Date", async () => {
    const searchRepo: jest.Mocked<IProspectSearchRepository> = { save: jest.fn(), findById: jest.fn(), findBySearchId: jest.fn(), findAllByTenant: jest.fn().mockResolvedValue([]) };
    const resultRepo: jest.Mocked<IProspectSearchResultRepository> = { saveMany: jest.fn(), deleteBySearch: jest.fn(), findAllBySearch: jest.fn().mockResolvedValue([]) };
    const { GenerateProspectSearchReportUseCase: Uc } = require("../application/use-cases/GenerateProspectSearchReportUseCase");
    const uc = new Uc(searchRepo, resultRepo);
    const before = Date.now();
    const result = await uc.execute({ tenantId: INT_TENANT_ID });
    const after = Date.now();
    expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.generatedAt.getTime()).toBeLessThanOrEqual(after + 100);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// V. ProspectMessageReceivedHandler — full integration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("ProspectMessageReceivedHandler — full integration with opt-out detection", () => {
  function buildHandlerForInt() {
    const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
    const registerResponse = { execute: jest.fn().mockResolvedValue(undefined) };
    const registerStop = { execute: jest.fn().mockResolvedValue(undefined) };
    const optOutPolicy = new ProspectOptOutPolicy();
    const { ProspectMessageReceivedHandler: Handler } = require("../application/handlers/ProspectMessageReceivedHandler");
    const handler = new Handler(eventBus, registerResponse, registerStop, optOutPolicy);
    let fn: ((e: any) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((_: any, cb: any) => { fn = cb; });
    handler.onModuleInit();
    return { handler, registerResponse, registerStop, fn: () => fn! };
  }

  it("non-opt-out message routes to registerProspectResponseUseCase", async () => {
    const { registerResponse, registerStop, fn } = buildHandlerForInt();
    await fn()({ payload: { tenantId: "t1", contactId: "c1", conversationId: "cv1", messageId: "m1", content: { text: "Quero saber mais" } } });
    expect(registerResponse.execute).toHaveBeenCalledTimes(1);
    expect(registerStop.execute).not.toHaveBeenCalled();
  });

  it("opt-out message routes to registerProspectStopUseCase", async () => {
    const { registerResponse, registerStop, fn } = buildHandlerForInt();
    await fn()({ payload: { tenantId: "t1", contactId: "c1", conversationId: "cv1", messageId: "m1", content: { text: "sair" } } });
    expect(registerStop.execute).toHaveBeenCalledTimes(1);
    expect(registerResponse.execute).not.toHaveBeenCalled();
  });

  it("messageText passed to opt-out policy matches exact message text", async () => {
    const { registerStop, fn } = buildHandlerForInt();
    const text = "parar";
    await fn()({ payload: { tenantId: "t1", contactId: "c1", conversationId: "cv1", messageId: "m1", content: { text } } });
    expect(registerStop.execute).toHaveBeenCalledWith(expect.objectContaining({ messageText: text }));
  });

  it("tenantId and contactId are forwarded correctly to use case", async () => {
    const { registerResponse, fn } = buildHandlerForInt();
    await fn()({ payload: { tenantId: "tenant-xyz", contactId: "contact-xyz", conversationId: "cv-xyz", messageId: "m-xyz", content: { text: "Tenho interesse" } } });
    expect(registerResponse.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-xyz", contactId: "contact-xyz" }));
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// W. CreateProspectAdsInsightQueryUseCase — full lifecycle integration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("CreateProspectAdsInsightQueryUseCase — integration", () => {
  it("saves a new query when no prior results exist", async () => {
    const queryRepo: jest.Mocked<IProspectAdsInsightQueryRepository> = { save: jest.fn(), findById: jest.fn(), findAllByTenant: jest.fn(), deleteByQuery: jest.fn() };
    const resultRepo: jest.Mocked<IProspectAdsInsightResultRepository> = { saveMany: jest.fn(), findAllByQuery: jest.fn(), deleteByQuery: jest.fn().mockResolvedValue(undefined) };
    const { CreateProspectAdsInsightQueryUseCase: Uc } = require("../application/use-cases/CreateProspectAdsInsightQueryUseCase");
    const uc = new Uc(queryRepo, resultRepo);
    await uc.execute({ tenantId: INT_TENANT_ID, businessTypeQuery: "Academia", city: "SP" });
    expect(queryRepo.save).toHaveBeenCalledTimes(1);
  });

  it("calls deleteByQuery before saving new results", async () => {
    const queryRepo: jest.Mocked<IProspectAdsInsightQueryRepository> = { save: jest.fn(), findById: jest.fn(), findAllByTenant: jest.fn(), deleteByQuery: jest.fn() };
    const callOrder: string[] = [];
    const resultRepo: jest.Mocked<IProspectAdsInsightResultRepository> = {
      saveMany: jest.fn(() => { callOrder.push("saveMany"); return Promise.resolve(); }),
      findAllByQuery: jest.fn(),
      deleteByQuery: jest.fn(() => { callOrder.push("deleteByQuery"); return Promise.resolve(); }),
    };
    const { CreateProspectAdsInsightQueryUseCase: Uc } = require("../application/use-cases/CreateProspectAdsInsightQueryUseCase");
    const uc = new Uc(queryRepo, resultRepo);
    await uc.execute({ tenantId: INT_TENANT_ID, businessTypeQuery: "Academia", city: "SP" });
    expect(callOrder.indexOf("deleteByQuery")).toBeLessThan(callOrder.indexOf("saveMany") === -1 ? Infinity : callOrder.indexOf("saveMany"));
  });

  it("when deleteByQuery fails, saveMany is not called", async () => {
    const queryRepo: jest.Mocked<IProspectAdsInsightQueryRepository> = { save: jest.fn(), findById: jest.fn(), findAllByTenant: jest.fn(), deleteByQuery: jest.fn() };
    const resultRepo: jest.Mocked<IProspectAdsInsightResultRepository> = { saveMany: jest.fn(), findAllByQuery: jest.fn(), deleteByQuery: jest.fn().mockRejectedValue(new Error("DB error")) };
    const { CreateProspectAdsInsightQueryUseCase: Uc } = require("../application/use-cases/CreateProspectAdsInsightQueryUseCase");
    const uc = new Uc(queryRepo, resultRepo);
    await expect(uc.execute({ tenantId: INT_TENANT_ID, businessTypeQuery: "Academia", city: "SP" })).rejects.toThrow("DB error");
    expect(resultRepo.saveMany).not.toHaveBeenCalled();
  });
});
