// alerts.e2e-new.spec.ts - NEW e2e tests for AlertReminderController
// Covers gaps: 24-29 (auth, JWT validation, DTO boundaries, error mapping)

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { TOKEN_SERVICE } from '@shared/application/ports/ITokenService';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { AlertReminderController } from '../presentation/controllers/AlertReminderController';
import { CreateAlertReminderUseCase } from '../application/use-cases/CreateAlertReminderUseCase';
import { ListAlertRemindersUseCase } from '../application/use-cases/ListAlertRemindersUseCase';
import { UpdateAlertReminderUseCase } from '../application/use-cases/UpdateAlertReminderUseCase';
import { DeleteAlertReminderUseCase } from '../application/use-cases/DeleteAlertReminderUseCase';

describe('AlertReminderController – new e2e tests', () => {
  let app: INestApplication;
  const createReminder = { execute: jest.fn() };
  const listReminders = { execute: jest.fn() };
  const updateReminder = { execute: jest.fn() };
  const deleteReminder = { execute: jest.fn() };
  const tokenService = { verifyAccessToken: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AlertReminderController],
      providers: [
        { provide: CreateAlertReminderUseCase, useValue: createReminder },
        { provide: ListAlertRemindersUseCase, useValue: listReminders },
        { provide: UpdateAlertReminderUseCase, useValue: updateReminder },
        { provide: DeleteAlertReminderUseCase, useValue: deleteReminder },
        { provide: TOKEN_SERVICE, useValue: tokenService },
        JwtCookieGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    tokenService.verifyAccessToken.mockResolvedValue({ sub: 'user-1', tenantId: 'tenant-1', email: 'owner@test.com', role: 'OWNER', type: 'access' });
    listReminders.execute.mockResolvedValue([]);
    createReminder.execute.mockResolvedValue({ id: 'reminder-1', tenantId: 'tenant-1', userId: 'user-1', status: 'ACTIVE' });
    updateReminder.execute.mockResolvedValue({ id: 'reminder-1', tenantId: 'tenant-1', userId: 'user-1', status: 'PAUSED' });
    deleteReminder.execute.mockResolvedValue(undefined);
  });

  afterAll(async () => { await app.close(); });

  // ─── GAP 24: Unauthenticated requests (missing cookie) ──────────────────
  it('GAP-24a: GET /alerts/reminders without cookie returns 401', async () => {
    tokenService.verifyAccessToken.mockRejectedValue(new Error('no token'));
    await request(app.getHttpServer())
      .get('/api/v1/alerts/reminders')
      .expect(401);
    expect(listReminders.execute).not.toHaveBeenCalled();
  });

  it('GAP-24b: POST /alerts/reminders without cookie returns 401', async () => {
    tokenService.verifyAccessToken.mockRejectedValue(new Error('no token'));
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .send({ title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' })
      .expect(401);
    expect(createReminder.execute).not.toHaveBeenCalled();
  });

  it('GAP-24c: PUT /alerts/reminders/:id without cookie returns 401', async () => {
    tokenService.verifyAccessToken.mockRejectedValue(new Error('no token'));
    await request(app.getHttpServer())
      .put('/api/v1/alerts/reminders/reminder-1')
      .send({ status: 'PAUSED' })
      .expect(401);
    expect(updateReminder.execute).not.toHaveBeenCalled();
  });

  it('GAP-24d: DELETE /alerts/reminders/:id without cookie returns 401', async () => {
    tokenService.verifyAccessToken.mockRejectedValue(new Error('no token'));
    await request(app.getHttpServer())
      .delete('/api/v1/alerts/reminders/reminder-1')
      .expect(401);
    expect(deleteReminder.execute).not.toHaveBeenCalled();
  });

  // ─── GAP 25: Invalid / expired JWT ─────────────────────────────────────
  it('GAP-25a: GET /alerts/reminders with expired token returns 401', async () => {
    tokenService.verifyAccessToken.mockRejectedValue(new Error('token expired'));
    await request(app.getHttpServer())
      .get('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=expired-token'])
      .expect(401);
  });

  it('GAP-25b: POST /alerts/reminders with invalid JWT signature returns 401', async () => {
    tokenService.verifyAccessToken.mockRejectedValue(new Error('invalid signature'));
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=bad-sig-token'])
      .send({ title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' })
      .expect(401);
  });

  it('GAP-25c: DELETE with invalid token does not call use case', async () => {
    tokenService.verifyAccessToken.mockRejectedValue(new Error('malformed'));
    await request(app.getHttpServer())
      .delete('/api/v1/alerts/reminders/reminder-1')
      .set('Cookie', ['atendeai_access=bad-token'])
      .expect(401);
    expect(deleteReminder.execute).not.toHaveBeenCalled();
  });

  // ─── GAP 26: DTO validation boundaries ─────────────────────────────────
  it('GAP-26a: title at exactly 120 chars is valid (boundary)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ title: 'A'.repeat(120), message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' })
      .expect(201);
  });

  it('GAP-26b: title at 121 chars is invalid (over boundary)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ title: 'A'.repeat(121), message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' })
      .expect(400);
    expect(createReminder.execute).not.toHaveBeenCalled();
  });

  it('GAP-26c: message at exactly 1000 chars is valid (boundary)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ title: 'T', message: 'B'.repeat(1000), frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' })
      .expect(201);
  });

  it('GAP-26d: message at 1001 chars is invalid (over boundary)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ title: 'T', message: 'B'.repeat(1001), frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' })
      .expect(400);
    expect(createReminder.execute).not.toHaveBeenCalled();
  });

  it('GAP-26e: timeOfDay with 4 chars (9:00) is invalid', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ title: 'T', message: 'M', frequency: 'DAILY', timeOfDay: '9:00' })
      .expect(400);
    expect(createReminder.execute).not.toHaveBeenCalled();
  });

  it('GAP-26f: timeOfDay with 5 chars (09:00) is valid', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ title: 'T', message: 'M', frequency: 'DAILY', timeOfDay: '09:00' })
      .expect(201);
  });

  it('GAP-26g: timeOfDay with 6 chars (009:00) is invalid', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ title: 'T', message: 'M', frequency: 'DAILY', timeOfDay: '009:00' })
      .expect(400);
  });

  // ─── GAP 27: GET without branchId ──────────────────────────────────────
  it('GAP-27a: GET /alerts/reminders without branchId passes undefined to use case', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(200);
    expect(listReminders.execute).toHaveBeenCalledWith({ tenantId: 'tenant-1', userId: 'user-1', branchId: undefined });
  });

  it('GAP-27b: GET /alerts/reminders with branchId passes branchId as string', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/alerts/reminders?branchId=branch-99')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(200);
    expect(listReminders.execute).toHaveBeenCalledWith({ tenantId: 'tenant-1', userId: 'user-1', branchId: 'branch-99' });
  });

  it('GAP-27c: GET without branchId does not forward empty string as branchId', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(200);
    const callArg = listReminders.execute.mock.calls[0][0];
    expect(callArg.branchId).not.toBe('');
  });

  // ─── GAP 28: PUT returns 404 when UpdateAlertReminderUseCase throws EntityNotFoundException ─
  it('GAP-28a: PUT returns 404 when UpdateAlertReminderUseCase throws EntityNotFoundException', async () => {
    const { EntityNotFoundException } = await import('@shared/domain/exceptions/DomainExceptions');
    updateReminder.execute.mockRejectedValue(new EntityNotFoundException('Alert reminder', 'non-existent'));
    await request(app.getHttpServer())
      .put('/api/v1/alerts/reminders/non-existent')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ title: 'Updated' })
      .expect(404);
  });

  it('GAP-28b: PUT returns 200 on successful update', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/alerts/reminders/reminder-1')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ title: 'Updated Title' })
      .expect(200);
    expect(updateReminder.execute).toHaveBeenCalledWith(expect.objectContaining({ reminderId: 'reminder-1' }));
  });

  it('GAP-28c: PUT with invalid frequency returns 400 (DTO validation before use case)', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/alerts/reminders/reminder-1')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ frequency: 'MONTHLY' })
      .expect(400);
    expect(updateReminder.execute).not.toHaveBeenCalled();
  });

  // ─── GAP 29: DELETE error mapping ──────────────────────────────────────
  it('GAP-29a: DELETE returns 404 when DeleteAlertReminderUseCase throws EntityNotFoundException', async () => {
    const { EntityNotFoundException } = await import('@shared/domain/exceptions/DomainExceptions');
    deleteReminder.execute.mockRejectedValue(new EntityNotFoundException('Alert reminder', 'non-existent'));
    await request(app.getHttpServer())
      .delete('/api/v1/alerts/reminders/non-existent')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(404);
  });

  it('GAP-29b: DELETE returns 200 with {deleted:true} on success', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/alerts/reminders/reminder-1')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(200)
      .expect({ deleted: true });
  });

  it('GAP-29c: DELETE calls use case with correct tenantId and userId from token', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/alerts/reminders/rem-xyz')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(200);
    expect(deleteReminder.execute).toHaveBeenCalledWith({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'rem-xyz' });
  });

  // ─── Additional e2e edge cases to round out coverage ───────────────────
  it('POST with WEEKLY frequency returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ title: 'T', message: 'M', frequency: 'WEEKLY', scheduledAt: '2030-06-01T14:00:00.000Z' })
      .expect(400);
  });

  it('POST with tenantId in body returns 400 (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ tenantId: 'forged', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' })
      .expect(400);
  });

  it('POST with userId in body returns 400 (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ userId: 'forged', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' })
      .expect(400);
  });

  it('PUT with non-ISO scheduledAt returns 400', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/alerts/reminders/reminder-1')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ scheduledAt: 'not-a-date' })
      .expect(400);
  });

  it('GET /alerts/reminders returns 200 with empty array when no reminders', async () => {
    listReminders.execute.mockResolvedValue([]);
    const res = await request(app.getHttpServer())
      .get('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('POST returns 201 with reminder object on success', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' })
      .expect(201);
    expect(res.body.id).toBeDefined();
  });

  it('PUT passes status field to use case', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/alerts/reminders/reminder-1')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(updateReminder.execute).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' }));
  });

});
