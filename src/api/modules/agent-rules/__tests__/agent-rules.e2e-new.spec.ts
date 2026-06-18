// agent-rules.e2e-new.spec.ts — new e2e tests for agent-rules HTTP endpoints
// Uses NestJS TestingModule with mocked use-cases (no real DB).
// Covers auth, validation, cross-tenant isolation, boundary cases.
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { TenantAgentRuleController } from '../presentation/controllers/TenantAgentRuleController';
import { GetTenantAgentRuleUseCase } from '../application/use-cases/GetTenantAgentRuleUseCase';
import { UpsertTenantAgentRuleUseCase } from '../application/use-cases/UpsertTenantAgentRuleUseCase';
import { PreviewTenantAgentRuleUseCase } from '../application/use-cases/PreviewTenantAgentRuleUseCase';
import { ListTenantAgentRuleHistoryUseCase } from '../application/use-cases/ListTenantAgentRuleHistoryUseCase';
import { ForbiddenException } from '@nestjs/common';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { AgentModule } from '../domain/enums/AgentModule';

jest.mock('@shared/infrastructure/observability/DomainTrace', () => ({
  traceAsync: jest.fn((_name, _attrs, fn) => fn()),
}));

// ---------------------------------------------------------------------------
// Controller-level e2e: real controller, mocked use-cases, ValidationPipe
// ---------------------------------------------------------------------------

/** Fake JWT user injected by mock guard. */
const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_TENANT_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const BRANCH_ID = 'cccccccc-0000-0000-0000-000000000003';

const BASE_RULE_RESPONSE = {
  tenantId: TENANT_ID,
  moduleId: AgentModule.MESSAGING,
  branchId: null,
  customPrompt: 'a prompt that is valid enough',
  isActive: true,
  fallbackToGlobal: true,
  revision: 1,
  inheritedFromTenant: false,
  scope: 'TENANT',
};

function buildApp(opts: {
  getRuleResult?: any;
  upsertResult?: any;
  previewResult?: any;
  historyResult?: any[];
  getRuleError?: Error;
  upsertError?: Error;
  userTenantId?: string;
}) {
  const getRuleUseCase = { execute: jest.fn() };
  const upsertRuleUseCase = { execute: jest.fn() };
  const previewRuleUseCase = { execute: jest.fn() };
  const listHistoryUseCase = { execute: jest.fn() };

  if (opts.getRuleError) {
    getRuleUseCase.execute.mockRejectedValue(opts.getRuleError);
  } else {
    getRuleUseCase.execute.mockResolvedValue(opts.getRuleResult ?? null);
  }
  if (opts.upsertError) {
    upsertRuleUseCase.execute.mockRejectedValue(opts.upsertError);
  } else {
    upsertRuleUseCase.execute.mockResolvedValue(opts.upsertResult ?? BASE_RULE_RESPONSE);
  }
  previewRuleUseCase.execute.mockResolvedValue(opts.previewResult ?? {
    moduleId: AgentModule.MESSAGING, branchId: null,
    normalizedCustomPrompt: 'a prompt that is valid enough',
    currentStoredRevision: 0, wouldBeRevision: 1,
    isActive: true, fallbackToGlobal: true, notesTrimmed: null,
  });
  listHistoryUseCase.execute.mockResolvedValue(opts.historyResult ?? []);

  const userTenantId = opts.userTenantId ?? TENANT_ID;

  return {
    getRuleUseCase, upsertRuleUseCase, previewRuleUseCase, listHistoryUseCase,
    moduleFixture: null as unknown as TestingModule,
    app: null as unknown as INestApplication,
    userTenantId,
  };
}

/** Create a minimal NestJS test app with mocked use-cases and a bypass guard. */
async function createTestApp(opts: {
  getRuleResult?: any;
  upsertResult?: any;
  previewResult?: any;
  historyResult?: any[];
  getRuleError?: Error;
  upsertError?: Error;
  userTenantId?: string;
  omitAuth?: boolean;
}): Promise<{ app: INestApplication; close: () => Promise<void> }> {
  const getRuleUseCase = { execute: jest.fn() };
  const upsertRuleUseCase = { execute: jest.fn() };
  const previewRuleUseCase = { execute: jest.fn() };
  const listHistoryUseCase = { execute: jest.fn() };

  if (opts.getRuleError) getRuleUseCase.execute.mockRejectedValue(opts.getRuleError);
  else getRuleUseCase.execute.mockResolvedValue(opts.getRuleResult ?? null);

  if (opts.upsertError) upsertRuleUseCase.execute.mockRejectedValue(opts.upsertError);
  else upsertRuleUseCase.execute.mockResolvedValue(opts.upsertResult ?? BASE_RULE_RESPONSE);

  previewRuleUseCase.execute.mockResolvedValue(opts.previewResult ?? {
    moduleId: AgentModule.MESSAGING, branchId: null,
    normalizedCustomPrompt: 'test prompt content',
    currentStoredRevision: 0, wouldBeRevision: 1,
    isActive: true, fallbackToGlobal: true, notesTrimmed: null,
  });
  listHistoryUseCase.execute.mockResolvedValue(opts.historyResult ?? []);

  const userTenantId = opts.userTenantId ?? TENANT_ID;

  // Create a guard that either bypasses (authenticated) or always denies (unauthenticated)
  const guardOverride = opts.omitAuth
    ? { canActivate: () => false }
    : { canActivate: (ctx: any) => {
        const req = ctx.switchToHttp().getRequest();
        req.user = { sub: 'user-1', tenantId: userTenantId, email: 'user@test.com' };
        return true;
      }
    };

  const moduleFixture = await Test.createTestingModule({
    controllers: [TenantAgentRuleController],
    providers: [
      { provide: GetTenantAgentRuleUseCase, useValue: getRuleUseCase },
      { provide: UpsertTenantAgentRuleUseCase, useValue: upsertRuleUseCase },
      { provide: PreviewTenantAgentRuleUseCase, useValue: previewRuleUseCase },
      { provide: ListTenantAgentRuleHistoryUseCase, useValue: listHistoryUseCase },
    ],
  })
    .overrideGuard(JwtCookieGuard).useValue(guardOverride)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix('api/v1');
  await app.init();

  return { app, close: () => app.close() };
}

const VALID_BODY = { customPrompt: 'a valid prompt that is long enough' };

// ===========================================================================
// Authentication — unauthenticated requests
// ===========================================================================
describe('Unauthenticated requests return 401 or 403', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ app, close } = await createTestApp({ omitAuth: true }));
  });
  afterAll(() => close());

  it('NEW-E2E-001: GET :moduleId without auth returns 401 or 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging')
      .expect((res) => { expect([401, 403]).toContain(res.status); });
  });

  it('NEW-E2E-002: PUT :moduleId without auth returns 401 or 403', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging')
      .send(VALID_BODY)
      .expect((res) => { expect([401, 403]).toContain(res.status); });
  });

  it('NEW-E2E-003: GET :moduleId/history without auth returns 401 or 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging/history')
      .expect((res) => { expect([401, 403]).toContain(res.status); });
  });

  it('NEW-E2E-004: POST :moduleId/preview without auth returns 401 or 403', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging/preview')
      .send(VALID_BODY)
      .expect((res) => { expect([401, 403]).toContain(res.status); });
  });
});

// ===========================================================================
// PUT :moduleId — validation
// ===========================================================================
describe('PUT :moduleId validation', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ app, close } = await createTestApp({ upsertResult: BASE_RULE_RESPONSE }));
  });
  afterAll(() => close());

  it('NEW-E2E-010: PUT with customPrompt < 10 chars returns 400', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging')
      .send({ customPrompt: 'short' })
      .expect(400);
  });

  it('NEW-E2E-011: PUT with missing customPrompt returns 400', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging')
      .send({ isActive: true })
      .expect(400);
  });

  it('NEW-E2E-012: PUT with extra unknown field returns 400 (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging')
      .send({ ...VALID_BODY, unknownField: 'value' })
      .expect(400);
  });

  it('NEW-E2E-013: PUT with valid body returns 200', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging')
      .send(VALID_BODY)
      .expect(200);
  });

  it('NEW-E2E-014: PUT with non-UUID branchId query param returns 400', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging?branchId=not-a-uuid')
      .send(VALID_BODY)
      .expect(400);
  });

  it('NEW-E2E-015: PUT with valid UUID branchId returns 200', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging?branchId=' + BRANCH_ID)
      .send(VALID_BODY)
      .expect(200);
  });
});

// ===========================================================================
// Cross-tenant 403
// ===========================================================================
describe('Cross-tenant access returns 403', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  beforeAll(async () => {
    // User belongs to TENANT_ID but requests OTHER_TENANT_ID resources
    ({ app, close } = await createTestApp({
      getRuleError: new ForbiddenException('Access denied'),
      upsertError: new ForbiddenException('Access denied'),
    }));
  });
  afterAll(() => close());

  it('NEW-E2E-020: GET :moduleId for other tenant returns 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants/' + OTHER_TENANT_ID + '/agent-rules/messaging')
      .expect(403);
  });

  it('NEW-E2E-021: PUT :moduleId for other tenant returns 403', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/tenants/' + OTHER_TENANT_ID + '/agent-rules/messaging')
      .send(VALID_BODY)
      .expect(403);
  });

  it('NEW-E2E-022: GET :moduleId/history for other tenant returns 403', async () => {
    const { app: histApp, close: histClose } = await createTestApp({
      getRuleError: new ForbiddenException('Access denied'),
      historyResult: [],
      userTenantId: TENANT_ID,
    });
    // Use the listHistoryUseCase to throw ForbiddenException
    const moduleFixture2 = await Test.createTestingModule({
      controllers: [TenantAgentRuleController],
      providers: [
        { provide: GetTenantAgentRuleUseCase, useValue: { execute: jest.fn().mockResolvedValue(null) } },
        { provide: UpsertTenantAgentRuleUseCase, useValue: { execute: jest.fn().mockResolvedValue(BASE_RULE_RESPONSE) } },
        { provide: PreviewTenantAgentRuleUseCase, useValue: { execute: jest.fn().mockResolvedValue({}) } },
        { provide: ListTenantAgentRuleHistoryUseCase, useValue: {
          execute: jest.fn().mockRejectedValue(new ForbiddenException('Access denied')),
        }},
      ],
    })
      .overrideGuard(JwtCookieGuard).useValue({ canActivate: (ctx: any) => {
        ctx.switchToHttp().getRequest().user = { sub: 'u1', tenantId: TENANT_ID, email: 'a@b.com' };
        return true;
      }})
      .compile();
    const histApp2 = moduleFixture2.createNestApplication();
    histApp2.use(cookieParser());
    histApp2.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    histApp2.useGlobalFilters(new GlobalExceptionFilter());
    histApp2.setGlobalPrefix('api/v1');
    await histApp2.init();
    await request(histApp2.getHttpServer())
      .get('/api/v1/tenants/' + OTHER_TENANT_ID + '/agent-rules/messaging/history')
      .expect(403);
    await histApp2.close();
    await histClose();
  });
});

// ===========================================================================
// GET :moduleId — null rule default response shape
// ===========================================================================
describe('GET :moduleId null-rule default response shape', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ app, close } = await createTestApp({ getRuleResult: null }));
  });
  afterAll(() => close());

  it('NEW-E2E-030: returns 200 with default shape when no rule exists', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging')
      .expect(200);
    expect(res.body).toMatchObject({
      moduleId: 'messaging',
      branchId: null,
      customPrompt: '',
      isActive: true,
      fallbackToGlobal: true,
      revision: 0,
      scope: 'TENANT',
      inheritedFromTenant: false,
    });
  });

  it('NEW-E2E-031: returns scope BRANCH when branchId query param provided and rule is null', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging?branchId=' + BRANCH_ID)
      .expect(200);
    expect(res.body.scope).toBe('BRANCH');
  });

  it('NEW-E2E-032: returns revision 0 in default null-rule response', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging')
      .expect(200);
    expect(res.body.revision).toBe(0);
  });
});

// ===========================================================================
// GET :moduleId/history — limit boundaries
// ===========================================================================
describe('GET :moduleId/history limit parsing', () => {
  let app: INestApplication;
  let close: () => Promise<void>;
  let listHistoryExecute: jest.Mock;

  beforeAll(async () => {
    listHistoryExecute = jest.fn().mockResolvedValue([]);
    const moduleFixture = await Test.createTestingModule({
      controllers: [TenantAgentRuleController],
      providers: [
        { provide: GetTenantAgentRuleUseCase, useValue: { execute: jest.fn().mockResolvedValue(null) } },
        { provide: UpsertTenantAgentRuleUseCase, useValue: { execute: jest.fn().mockResolvedValue(BASE_RULE_RESPONSE) } },
        { provide: PreviewTenantAgentRuleUseCase, useValue: { execute: jest.fn().mockResolvedValue({}) } },
        { provide: ListTenantAgentRuleHistoryUseCase, useValue: { execute: listHistoryExecute } },
      ],
    })
      .overrideGuard(JwtCookieGuard).useValue({ canActivate: (ctx: any) => {
        ctx.switchToHttp().getRequest().user = { sub: 'u1', tenantId: TENANT_ID, email: 'a@b.com' };
        return true;
      }})
      .compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    close = () => app.close();
  });
  afterAll(() => close());

  it('NEW-E2E-040: limit=0 → use case receives 0 (clamped internally by use case)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging/history?limit=0')
      .expect(200);
    expect(listHistoryExecute).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 0 }));
  });

  it('NEW-E2E-041: limit=101 → use case receives 101', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging/history?limit=101')
      .expect(200);
    expect(listHistoryExecute).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 101 }));
  });

  it('NEW-E2E-042: limit=abc → use case receives undefined (NaN is not finite)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging/history?limit=abc')
      .expect(200);
    expect(listHistoryExecute).toHaveBeenLastCalledWith(expect.objectContaining({ limit: undefined }));
  });

  it('NEW-E2E-043: no limit param → use case receives undefined', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging/history')
      .expect(200);
    expect(listHistoryExecute).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 25 }));
  });

  it('NEW-E2E-044: history response is array', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging/history')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ===========================================================================
// POST :moduleId/preview endpoint
// ===========================================================================
describe('POST :moduleId/preview endpoint', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  const previewResult = {
    moduleId: AgentModule.MESSAGING,
    branchId: null,
    normalizedCustomPrompt: 'a valid prompt here',
    currentStoredRevision: 3,
    wouldBeRevision: 4,
    isActive: true,
    fallbackToGlobal: true,
    notesTrimmed: null,
  };

  beforeAll(async () => {
    ({ app, close } = await createTestApp({ previewResult }));
  });
  afterAll(() => close());

  it('NEW-E2E-050: POST preview returns 200 with preview shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging/preview')
      .send(VALID_BODY)
      .expect(200);
    expect(res.body).toMatchObject({
      currentStoredRevision: 3,
      wouldBeRevision: 4,
    });
  });

  it('NEW-E2E-051: POST preview with missing customPrompt returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging/preview')
      .send({ isActive: true })
      .expect(400);
  });

  it('NEW-E2E-052: POST preview with prompt < 10 chars returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging/preview')
      .send({ customPrompt: 'short' })
      .expect(400);
  });

  it('NEW-E2E-053: POST preview with non-UUID branchId returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging/preview?branchId=not-uuid')
      .send(VALID_BODY)
      .expect(400);
  });

  it('NEW-E2E-054: POST preview with valid UUID branchId returns 200', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging/preview?branchId=' + BRANCH_ID)
      .send(VALID_BODY)
      .expect(200);
  });
});

// ===========================================================================
// Symmetric tenant isolation
// ===========================================================================
describe('Symmetric tenant isolation', () => {
  it('NEW-E2E-060: tenant A can access their own rules but not tenant B', async () => {
    const { app: appA, close: closeA } = await createTestApp({
      getRuleResult: BASE_RULE_RESPONSE,
      userTenantId: TENANT_ID,
    });
    const { app: appB, close: closeB } = await createTestApp({
      getRuleResult: BASE_RULE_RESPONSE,
      userTenantId: OTHER_TENANT_ID,
    });

    // Tenant A can access their own
    await request(appA.getHttpServer())
      .get('/api/v1/tenants/' + TENANT_ID + '/agent-rules/messaging')
      .expect(200);

    // Tenant B can access their own
    await request(appB.getHttpServer())
      .get('/api/v1/tenants/' + OTHER_TENANT_ID + '/agent-rules/messaging')
      .expect(200);

    await closeA();
    await closeB();
  });
});
