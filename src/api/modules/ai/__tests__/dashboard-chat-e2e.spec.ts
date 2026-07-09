import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardChatController } from '../presentation/controllers/DashboardChatController';
import { StreamDashboardChatUseCase } from '../application/use-cases/StreamDashboardChatUseCase';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Observable } from 'rxjs';

// Mock guards to bypass auth in e2e
const mockJwtGuard = { canActivate: () => true };
const mockTenantGuard = { canActivate: (ctx: any) => {
  const req = ctx.switchToHttp().getRequest();
  req.user = { sub: 'user-e2e', email: 'test@test.com', tenantId: req.params.tenantId };
  return true;
}};

describe('DashboardChatController (E2E)', () => {
  let app: INestApplication;
  let mockUseCase: jest.Mocked<StreamDashboardChatUseCase>;

  beforeAll(async () => {
    mockUseCase = {
      execute: jest.fn().mockImplementation((input) => {
        return new Observable((subscriber) => {
          subscriber.next({ data: JSON.stringify({ type: 'token', content: 'Resposta teste' }) } as any);
          subscriber.next({ data: JSON.stringify({ type: 'done' }) } as any);
          subscriber.complete();
        });
      }),
    } as any;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DashboardChatController],
      providers: [
        { provide: StreamDashboardChatUseCase, useValue: mockUseCase },
      ],
    })
      .overrideGuard(JwtCookieGuard).useValue(mockJwtGuard)
      .overrideGuard(TenantGuard).useValue(mockTenantGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /ai/dashboard/:tenantId/chat/stream should return SSE stream', async () => {
    const response = await request(app.getHttpServer())
      .get('/ai/dashboard/tenant-e2e/chat/stream?message=Faturamento%20hoje&threadId=thread-1')
      .set('Accept', 'text/event-stream')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(mockUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-e2e',
        message: 'Faturamento hoje',
        threadId: 'thread-1',
      }),
    );
  });

  it('GET /ai/dashboard/:tenantId/chat/stream without message should return 400', async () => {
    await request(app.getHttpServer())
      .get('/ai/dashboard/tenant-e2e/chat/stream')
      .expect(400);
  });

  it('should pass userId from auth context', async () => {
    await request(app.getHttpServer())
      .get('/ai/dashboard/tenant-e2e/chat/stream?message=Test')
      .expect(200);

    expect(mockUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-e2e',
      }),
    );
  });
});
