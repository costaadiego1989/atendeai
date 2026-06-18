import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';

import { VoiceConfigController } from '../presentation/controllers/VoiceConfigController';
import { GetVoiceConfigUseCase } from '../application/use-cases/GetVoiceConfigUseCase';
import { UpdateVoiceConfigUseCase } from '../application/use-cases/UpdateVoiceConfigUseCase';
import { ListVoiceCallsUseCase } from '../application/use-cases/ListVoiceCallsUseCase';
import { SuggestVoiceScriptUseCase } from '../application/use-cases/SuggestVoiceScriptUseCase';

// ─── Mock guards that bypass auth in tests ────────────────────────────────────

import { CanActivate, ExecutionContext } from '@nestjs/common';

class AllowAllGuard implements CanActivate {
  canActivate(_ctx: ExecutionContext): boolean {
    return true;
  }
}

class DenyAllGuard implements CanActivate {
  canActivate(_ctx: ExecutionContext): boolean {
    return false;
  }
}

// ─── Mock return values ───────────────────────────────────────────────────────

const mockConfig = {
  enabled: true,
  persona: { name: 'Agente', tone: 'professional', voiceId: 'v1', language: 'pt-BR', speed: 1 },
  allowedHours: { start: '09:00', end: '18:00' },
  recovery: { enabled: false },
  scripts: [],
  twilioPhoneNumber: null,
  activeScriptName: null,
};

const mockCallsList = {
  items: [
    { id: 'c1', contactId: 'ct1', direction: 'OUTBOUND', status: 'COMPLETED', duration: 60, result: 'PAID', createdAt: new Date() },
  ],
  total: 1,
  page: 1,
  totalPages: 1,
};

async function buildApp(overrideGuards = true): Promise<{ app: INestApplication; module: TestingModule }> {
  const mockGetConfig = { execute: jest.fn().mockResolvedValue(mockConfig) };
  const mockUpdateConfig = { execute: jest.fn().mockResolvedValue(mockConfig) };
  const mockListCalls = { execute: jest.fn().mockResolvedValue(mockCallsList) };
  const mockSuggest = { execute: jest.fn().mockResolvedValue({ template: 'Script template' }) };

  let builder = Test.createTestingModule({
    controllers: [VoiceConfigController],
    providers: [
      { provide: GetVoiceConfigUseCase, useValue: mockGetConfig },
      { provide: UpdateVoiceConfigUseCase, useValue: mockUpdateConfig },
      { provide: ListVoiceCallsUseCase, useValue: mockListCalls },
      { provide: SuggestVoiceScriptUseCase, useValue: mockSuggest },
    ],
  });

  if (overrideGuards) {
    builder = builder
      .overrideGuard('JwtCookieGuard')
      .useClass(AllowAllGuard)
      .overrideGuard('RolesGuard')
      .useClass(AllowAllGuard)
      .overrideGuard('TenantGuard')
      .useClass(AllowAllGuard);
  }

  const module = await builder.compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();
  return { app, module };
}

// ─── E2E Tests ────────────────────────────────────────────────────────────────

describe('VoiceConfigController E2E', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeEach(async () => {
    ({ app, module } = await buildApp());
  });

  afterEach(async () => {
    await app.close();
  });

  // ── GET /tenants/:tenantId/voice/config ───────────────────────────────────

  it('should return 200 and config on GET /tenants/:tenantId/voice/config', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/tenant-1/voice/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enabled');
  });

  it('should return config with persona on GET config', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/tenant-1/voice/config');
    expect(res.body).toHaveProperty('persona');
  });

  it('should return config with allowedHours on GET config', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/tenant-1/voice/config');
    expect(res.body).toHaveProperty('allowedHours');
    expect(res.body.allowedHours).toHaveProperty('start');
  });

  it('should pass tenantId from path param to use case on GET config', async () => {
    await request(app.getHttpServer()).get('/tenants/my-tenant/voice/config');
    const getConfig = module.get(GetVoiceConfigUseCase);
    expect(getConfig.execute).toHaveBeenCalledWith('my-tenant');
  });

  // ── PUT /tenants/:tenantId/voice/config ────────────────────────────────────

  it('should return 200 on PUT /tenants/:tenantId/voice/config with valid body', async () => {
    const res = await request(app.getHttpServer())
      .put('/tenants/tenant-1/voice/config')
      .send({ enabled: false });
    expect(res.status).toBe(200);
  });

  it('should accept empty body on PUT config', async () => {
    const res = await request(app.getHttpServer())
      .put('/tenants/tenant-1/voice/config')
      .send({});
    expect(res.status).toBe(200);
  });

  it('should accept enabled:true on PUT config', async () => {
    const res = await request(app.getHttpServer())
      .put('/tenants/tenant-1/voice/config')
      .send({ enabled: true });
    expect(res.status).toBe(200);
  });

  it('should pass body to updateConfig use case on PUT config', async () => {
    await request(app.getHttpServer())
      .put('/tenants/tenant-99/voice/config')
      .send({ enabled: false });
    const updateConfig = module.get(UpdateVoiceConfigUseCase);
    expect(updateConfig.execute).toHaveBeenCalledWith('tenant-99', expect.objectContaining({ enabled: false }));
  });

  // ── GET /tenants/:tenantId/voice/calls ────────────────────────────────────

  it('should return 200 on GET /tenants/:tenantId/voice/calls', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/tenant-1/voice/calls');
    expect(res.status).toBe(200);
  });

  it('should return items array in calls response', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/tenant-1/voice/calls');
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('should return total and page in calls response', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/tenant-1/voice/calls');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
  });

  it('should pass page and limit query params to ListVoiceCallsUseCase', async () => {
    await request(app.getHttpServer()).get('/tenants/tenant-1/voice/calls?page=2&limit=5');
    const listCalls = module.get(ListVoiceCallsUseCase);
    expect(listCalls.execute).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 5 }));
  });

  it('should pass status filter to ListVoiceCallsUseCase', async () => {
    await request(app.getHttpServer()).get('/tenants/tenant-1/voice/calls?status=COMPLETED');
    const listCalls = module.get(ListVoiceCallsUseCase);
    expect(listCalls.execute).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
  });

  // ── GET /tenants/:tenantId/voice/metrics ──────────────────────────────────

  it('should return 200 on GET /tenants/:tenantId/voice/metrics', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/tenant-1/voice/metrics');
    expect(res.status).toBe(200);
  });

  it('should return metrics object with totalCalls field', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/tenant-1/voice/metrics');
    expect(res.body).toHaveProperty('totalCalls');
  });

  it('should return answeredRate and agreementRate in metrics', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/tenant-1/voice/metrics');
    expect(res.body).toHaveProperty('answeredRate');
    expect(res.body).toHaveProperty('agreementRate');
  });

  // ── POST /tenants/:tenantId/voice/suggest-script ──────────────────────────

  it('should return 200 on POST suggest-script with valid body', async () => {
    const res = await request(app.getHttpServer())
      .post('/tenants/tenant-1/voice/suggest-script')
      .send({ name: 'My Script', type: 'recovery' });
    expect(res.status).toBe(201);
  });

  it('should return template in suggest-script response', async () => {
    const res = await request(app.getHttpServer())
      .post('/tenants/tenant-1/voice/suggest-script')
      .send({ name: 'Test', type: 'recovery' });
    expect(res.body).toHaveProperty('template');
  });

  it('should pass name and type to SuggestVoiceScriptUseCase', async () => {
    await request(app.getHttpServer())
      .post('/tenants/tenant-9/voice/suggest-script')
      .send({ name: 'My Script', type: 'follow_up' });
    const suggestUC = module.get(SuggestVoiceScriptUseCase);
    expect(suggestUC.execute).toHaveBeenCalledWith('tenant-9', { name: 'My Script', type: 'follow_up' });
  });

  // ── Auth validation (guards deny) ─────────────────────────────────────────

  it('should return 403 when all guards deny on GET config', async () => {
    const denyModule = await Test.createTestingModule({
      controllers: [VoiceConfigController],
      providers: [
        { provide: GetVoiceConfigUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateVoiceConfigUseCase, useValue: { execute: jest.fn() } },
        { provide: ListVoiceCallsUseCase, useValue: { execute: jest.fn() } },
        { provide: SuggestVoiceScriptUseCase, useValue: { execute: jest.fn() } },
      ],
    })
      .overrideGuard('JwtCookieGuard')
      .useClass(DenyAllGuard)
      .compile();
    const denyApp = denyModule.createNestApplication();
    await denyApp.init();
    const res = await request(denyApp.getHttpServer()).get('/tenants/tenant-1/voice/config');
    expect(res.status).toBe(403);
    await denyApp.close();
  });

  it('should return 403 when guards deny on PUT config', async () => {
    const denyModule = await Test.createTestingModule({
      controllers: [VoiceConfigController],
      providers: [
        { provide: GetVoiceConfigUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateVoiceConfigUseCase, useValue: { execute: jest.fn() } },
        { provide: ListVoiceCallsUseCase, useValue: { execute: jest.fn() } },
        { provide: SuggestVoiceScriptUseCase, useValue: { execute: jest.fn() } },
      ],
    })
      .overrideGuard('JwtCookieGuard')
      .useClass(DenyAllGuard)
      .compile();
    const denyApp = denyModule.createNestApplication();
    await denyApp.init();
    const res = await request(denyApp.getHttpServer())
      .put('/tenants/tenant-1/voice/config')
      .send({ enabled: true });
    expect(res.status).toBe(403);
    await denyApp.close();
  });

  it('should return 403 when guards deny on GET calls', async () => {
    const denyModule = await Test.createTestingModule({
      controllers: [VoiceConfigController],
      providers: [
        { provide: GetVoiceConfigUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateVoiceConfigUseCase, useValue: { execute: jest.fn() } },
        { provide: ListVoiceCallsUseCase, useValue: { execute: jest.fn() } },
        { provide: SuggestVoiceScriptUseCase, useValue: { execute: jest.fn() } },
      ],
    })
      .overrideGuard('JwtCookieGuard')
      .useClass(DenyAllGuard)
      .compile();
    const denyApp = denyModule.createNestApplication();
    await denyApp.init();
    const res = await request(denyApp.getHttpServer()).get('/tenants/tenant-1/voice/calls');
    expect(res.status).toBe(403);
    await denyApp.close();
  });

  // ── Additional e2e edge cases ─────────────────────────────────────────────

  it('should accept calls query with only page param', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/tenant-1/voice/calls?page=3');
    expect(res.status).toBe(200);
    const listCalls = module.get(ListVoiceCallsUseCase);
    expect(listCalls.execute).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }));
  });

  it('should accept calls query with only limit param', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/tenant-1/voice/calls?limit=50');
    expect(res.status).toBe(200);
    const listCalls = module.get(ListVoiceCallsUseCase);
    expect(listCalls.execute).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });

  it('should return 404 for unknown endpoint under voice route', async () => {
    const res = await request(app.getHttpServer()).get('/tenants/tenant-1/voice/nonexistent-endpoint');
    expect(res.status).toBe(404);
  });
});