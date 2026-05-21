import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import * as bcrypt from 'bcryptjs';

describe('DocumentsController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let authCookie: string;
  let otherAuthCookie: string;
  let uploadedDocId: string;

  const ownerEmail = `docs-owner-${Date.now()}@test.com`;
  const otherOwnerEmail = `docs-other-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `dc${Date.now()}`.slice(-14);
  const otherTenantCnpj = `do${Date.now() + 1}`.slice(-14);

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const cookies = res.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: { companyName: 'Documents E2E Store', cnpj: tenantCnpj, plan: 'ESSENCIAL' },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: { companyName: 'Other Documents Store', cnpj: otherTenantCnpj, plan: 'ESSENCIAL' },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.createMany({
      data: [
        { tenantId, name: 'Docs Owner', email: ownerEmail, phone: '11970000081', passwordHash, role: 'OWNER' },
        { tenantId: otherTenantId, name: 'Other Owner', email: otherOwnerEmail, phone: '11970000082', passwordHash, role: 'OWNER' },
      ],
    });

    authCookie = await login(ownerEmail);
    otherAuthCookie = await login(otherOwnerEmail);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherOwnerEmail] } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await app.close();
  });

  describe('GET /api/v1/tenants/:tenantId/documents', () => {
    it('should return empty list initially', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/documents`)
        .set('Cookie', [authCookie])
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/documents`)
        .expect(401);
    });

    it('should return 403 when accessing another tenant documents', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/documents`)
        .set('Cookie', [otherAuthCookie])
        .expect(403);
    });
  });

  describe('POST /api/v1/tenants/:tenantId/documents', () => {
    it('should upload a PDF document and return DocumentDTO', async () => {
      const fakePdf = Buffer.from('%PDF-1.4 fake pdf content for testing');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/documents`)
        .set('Cookie', [authCookie])
        .attach('file', fakePdf, { filename: 'test-doc.pdf', contentType: 'application/pdf' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBeDefined();
      expect(res.body.fileUrl).toBeDefined();

      uploadedDocId = res.body.id;
    });

    it('should return same document on duplicate upload (checksum dedup)', async () => {
      const fakePdf = Buffer.from('%PDF-1.4 fake pdf content for testing');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/documents`)
        .set('Cookie', [authCookie])
        .attach('file', fakePdf, { filename: 'test-doc-dup.pdf', contentType: 'application/pdf' })
        .expect(201);

      expect(res.body.id).toBe(uploadedDocId);
    });

    it('should reject unsupported file type with 422', async () => {
      const fakeImage = Buffer.from('fake image data');

      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/documents`)
        .set('Cookie', [authCookie])
        .attach('file', fakeImage, { filename: 'image.jpg', contentType: 'image/jpeg' })
        .expect(422);
    });

    it('should accept TXT file', async () => {
      const fakeTxt = Buffer.from('This is a plain text knowledge base document.');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/documents`)
        .set('Cookie', [authCookie])
        .attach('file', fakeTxt, { filename: 'knowledge.txt', contentType: 'text/plain' })
        .expect(201);

      expect(res.body.id).toBeDefined();
    });

    it('should return 403 for wrong tenant', async () => {
      const fakePdf = Buffer.from('%PDF-1.4 other tenant');

      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/documents`)
        .set('Cookie', [otherAuthCookie])
        .attach('file', fakePdf, { filename: 'hack.pdf', contentType: 'application/pdf' })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/tenants/:tenantId/documents/:docId', () => {
    it('should delete document and return 204', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tenants/${tenantId}/documents/${uploadedDocId}`)
        .set('Cookie', [authCookie])
        .expect(204);
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000099';

      await request(app.getHttpServer())
        .delete(`/api/v1/tenants/${tenantId}/documents/${fakeId}`)
        .set('Cookie', [authCookie])
        .expect(404);
    });

    it('should return 403 when deleting from wrong tenant', async () => {
      // Upload a doc first to get a real ID to attempt cross-tenant delete
      const fakeTxt = Buffer.from('doc for cross-tenant delete test');
      const uploadRes = await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantId}/documents`)
        .set('Cookie', [authCookie])
        .attach('file', fakeTxt, { filename: 'cross.txt', contentType: 'text/plain' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/tenants/${tenantId}/documents/${uploadRes.body.id}`)
        .set('Cookie', [otherAuthCookie])
        .expect(403);
    });
  });
});
