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

describe('AlertReminderController (e2e)', () => {
  let app: INestApplication;
  const createReminder = { execute: jest.fn() };
  const listReminders = { execute: jest.fn() };
  const updateReminder = { execute: jest.fn() };
  const deleteReminder = { execute: jest.fn() };
  const tokenService = {
    verifyAccessToken: jest.fn(),
  };

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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    tokenService.verifyAccessToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      email: 'owner@test.com',
      role: 'OWNER',
      type: 'access',
    });
    listReminders.execute.mockResolvedValue([]);
    createReminder.execute.mockResolvedValue({
      id: 'reminder-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      status: 'ACTIVE',
    });
    updateReminder.execute.mockResolvedValue({
      id: 'reminder-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      status: 'PAUSED',
    });
    deleteReminder.execute.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it('ALT-T-010: rejects invalid frequency before scheduling anything', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({
        title: 'Ligar para cliente',
        message: 'Confirmar visita',
        frequency: 'WEEKLY',
      })
      .expect(400);

    expect(createReminder.execute).not.toHaveBeenCalled();
  });

  it('ALT-T-020: creates and lists reminders with tenant/user from token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({
        tenantId: 'tenant-forged',
        userId: 'user-forged',
        branchId: 'branch-1',
        title: 'Ligar para cliente',
        message: 'Confirmar visita',
        frequency: 'ONCE',
        scheduledAt: '2030-01-10T12:00:00.000Z',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/alerts/reminders')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({
        branchId: 'branch-1',
        title: 'Ligar para cliente',
        message: 'Confirmar visita',
        frequency: 'ONCE',
        scheduledAt: '2030-01-10T12:00:00.000Z',
      })
      .expect(201);

    expect(createReminder.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        branchId: 'branch-1',
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/alerts/reminders?branchId=branch-1')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(200);

    expect(listReminders.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      branchId: 'branch-1',
    });
  });

  it('ALT-T-030: updates and deletes only as authenticated user scope', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/alerts/reminders/reminder-1')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({
        status: 'PAUSED',
        timezone: 'America/Sao_Paulo',
      })
      .expect(200);

    expect(updateReminder.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        reminderId: 'reminder-1',
        status: 'PAUSED',
      }),
    );

    await request(app.getHttpServer())
      .delete('/api/v1/alerts/reminders/reminder-1')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(200)
      .expect({ deleted: true });

    expect(deleteReminder.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      reminderId: 'reminder-1',
    });
  });
});
