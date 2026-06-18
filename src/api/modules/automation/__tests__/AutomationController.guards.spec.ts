/**
 * T4-A: AutomationController guard tests
 * These tests verify that all automation endpoints are protected by JwtCookieGuard and TenantGuard.
 * Written BEFORE adding guards (TDD: red → green).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import request from 'supertest';
import { AutomationController } from '../presentation/controllers/AutomationController';
import { CreateAutomationUseCase } from '../application/use-cases/CreateAutomationUseCase';
import { UpdateAutomationUseCase } from '../application/use-cases/UpdateAutomationUseCase';
import { ListAutomationsUseCase } from '../application/use-cases/ListAutomationsUseCase';
import { DeleteAutomationUseCase } from '../application/use-cases/DeleteAutomationUseCase';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Reflector } from '@nestjs/core';

// Guard that always rejects (simulates missing/invalid token)
const rejectingJwtGuard = {
  canActivate: jest.fn().mockImplementation(() => {
    throw new UnauthorizedException('Access token not provided');
  }),
};

const passingTenantGuard = {
  canActivate: jest.fn().mockReturnValue(true),
};

describe('AutomationController – T4-A guard enforcement', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AutomationController],
      providers: [
        { provide: CreateAutomationUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateAutomationUseCase, useValue: { execute: jest.fn() } },
        { provide: ListAutomationsUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
        { provide: DeleteAutomationUseCase, useValue: { execute: jest.fn() } },
        Reflector,
      ],
    })
      .overrideGuard(JwtCookieGuard)
      .useValue(rejectingJwtGuard)
      .overrideGuard(TenantGuard)
      .useValue(passingTenantGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    rejectingJwtGuard.canActivate.mockImplementation(() => {
      throw new UnauthorizedException('Access token not provided');
    });
  });

  const tenantId = 'tenant-test-123';

  it('GET /api/v1/tenants/:tenantId/automations → 401 without auth token', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/automations`)
      .expect(401);
  });

  it('POST /api/v1/tenants/:tenantId/automations → 401 without auth token', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/automations`)
      .send({ name: 'Test', trigger: { type: 'MESSAGE_RECEIVED' }, steps: [] })
      .expect(401);
  });

  it('PUT /api/v1/tenants/:tenantId/automations/:id → 401 without auth token', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/tenants/${tenantId}/automations/auto-1`)
      .send({ name: 'Updated' })
      .expect(401);
  });

  it('DELETE /api/v1/tenants/:tenantId/automations/:id → 401 without auth token', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/tenants/${tenantId}/automations/auto-1`)
      .expect(401);
  });

  it('PUT /api/v1/tenants/:tenantId/automations/:id/activate → 401 without auth token', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/tenants/${tenantId}/automations/auto-1/activate`)
      .expect(401);
  });
});

describe('AutomationController – T4-A tenant isolation (cross-tenant 403)', () => {
  let app: INestApplication;

  // Guard that authenticates as tenant-A
  const tenantAUser = { tenantId: 'tenant-A', type: 'access', role: 'OWNER' };

  const jwtGuardTenantA = {
    canActivate: jest.fn().mockImplementation((ctx: any) => {
      const req = ctx.switchToHttp().getRequest();
      req.user = tenantAUser;
      return true;
    }),
  };

  // Simulate real TenantGuard behaviour
  const tenantGuard = {
    canActivate: jest.fn().mockImplementation((ctx: any) => {
      const req = ctx.switchToHttp().getRequest();
      const user = req.user;
      const tenantId = req.params.tenantId;
      if (!user) throw new UnauthorizedException('User not authenticated');
      if (tenantId && user.tenantId !== tenantId) {
        throw new ForbiddenException('Access denied: tenant mismatch');
      }
      return true;
    }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AutomationController],
      providers: [
        { provide: CreateAutomationUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateAutomationUseCase, useValue: { execute: jest.fn() } },
        { provide: ListAutomationsUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
        { provide: DeleteAutomationUseCase, useValue: { execute: jest.fn() } },
        Reflector,
      ],
    })
      .overrideGuard(JwtCookieGuard)
      .useValue(jwtGuardTenantA)
      .overrideGuard(TenantGuard)
      .useValue(tenantGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(() => app.close());

  it('GET tenant-A automations with tenant-A token → 200', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants/tenant-A/automations')
      .expect(200);
  });

  it('GET tenant-B automations with tenant-A token → 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants/tenant-B/automations')
      .expect(403);
  });
});
