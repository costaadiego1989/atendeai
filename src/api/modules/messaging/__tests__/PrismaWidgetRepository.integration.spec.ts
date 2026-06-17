import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  WIDGET_CONFIG_REPOSITORY,
  IWidgetConfigRepository,
} from '../domain/repositories/IWidgetConfigRepository';
import {
  WIDGET_SESSION_REPOSITORY,
  IWidgetSessionRepository,
} from '../domain/repositories/IWidgetSessionRepository';

describe('Prisma widget repositories (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let configRepo: IWidgetConfigRepository;
  let sessionRepo: IWidgetSessionRepository;
  let tenantId: string;
  let otherTenantId: string;
  const stamp = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    configRepo = app.get<IWidgetConfigRepository>(WIDGET_CONFIG_REPOSITORY);
    sessionRepo = app.get<IWidgetSessionRepository>(WIDGET_SESSION_REPOSITORY);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Widget Repo Store',
        cnpj: `wc${stamp}`,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const other = await prisma.tenant.create({
      data: {
        companyName: 'Widget Repo Other',
        cnpj: `wo${stamp}`,
        plan: 'ESSENCIAL',
      },
    });
    otherTenantId = other.id;
  });

  afterAll(async () => {
    for (const id of [tenantId, otherTenantId]) {
      if (!id) continue;
      await prisma.widgetSession.deleteMany({ where: { tenantId: id } });
      await prisma.widgetConfig.deleteMany({ where: { tenantId: id } });
      await prisma.tenant.delete({ where: { id } }).catch(() => undefined);
    }
    await app.close();
  });

  describe('WidgetConfig', () => {
    it('findOrCreate is idempotent per tenant', async () => {
      const first = await configRepo.findOrCreate(tenantId);
      const second = await configRepo.findOrCreate(tenantId);

      expect(first.id).toBe(second.id);
      expect(first.tenantId).toBe(tenantId);
      expect(first.publicToken).toBeTruthy();
    });

    it('findByPublicToken resolves the owning tenant', async () => {
      const created = await configRepo.findOrCreate(tenantId);

      const found = await configRepo.findByPublicToken(created.publicToken);

      expect(found?.id).toBe(created.id);
      expect(found?.tenantId).toBe(tenantId);
    });

    it('upsertByTenantId updates only the calling tenant config', async () => {
      await configRepo.findOrCreate(tenantId);

      const updated = await configRepo.upsertByTenantId(tenantId, {
        name: 'Renamed',
        collectName: true,
        collectPhone: false,
        collectEmail: false,
      });

      expect(updated.tenantId).toBe(tenantId);
      expect(updated.name).toBe('Renamed');
    });

    it('rejects an update whose tenantId does not own the config', async () => {
      const config = await configRepo.findOrCreate(tenantId);

      await expect(
        configRepo.update(config.id, otherTenantId, { name: 'Hijack' }),
      ).rejects.toThrow('Tenant mismatch');
    });
  });

  describe('WidgetSession', () => {
    let configId: string;

    beforeAll(async () => {
      const config = await configRepo.findOrCreate(tenantId);
      configId = config.id;
    });

    it('creates and reads a session scoped by tenant', async () => {
      const session = await sessionRepo.create({
        widgetConfigId: configId,
        tenantId,
        visitorId: `visitor-${stamp}`,
      });

      const found = await sessionRepo.findById(session.id, tenantId);
      expect(found?.id).toBe(session.id);

      const foreign = await sessionRepo.findById(session.id, otherTenantId);
      expect(foreign).toBeNull();
    });

    it('rejects update/close from a non-owning tenant', async () => {
      const session = await sessionRepo.create({
        widgetConfigId: configId,
        tenantId,
        visitorId: `visitor-x-${stamp}`,
      });

      await expect(
        sessionRepo.update(session.id, otherTenantId, { visitorName: 'X' }),
      ).rejects.toThrow('Tenant mismatch');

      await expect(
        sessionRepo.close(session.id, otherTenantId),
      ).rejects.toThrow('Tenant mismatch');
    });

    it('findActiveByVisitor only matches active sessions of the same tenant', async () => {
      const visitorId = `visitor-active-${stamp}`;
      const session = await sessionRepo.create({
        widgetConfigId: configId,
        tenantId,
        visitorId,
      });

      const active = await sessionRepo.findActiveByVisitor(
        configId,
        tenantId,
        visitorId,
      );
      expect(active?.id).toBe(session.id);

      await sessionRepo.close(session.id, tenantId);

      const afterClose = await sessionRepo.findActiveByVisitor(
        configId,
        tenantId,
        visitorId,
      );
      expect(afterClose).toBeNull();
    });
  });
});