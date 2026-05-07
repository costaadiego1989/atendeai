import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { RecoveryController } from '../../recovery/presentation/controllers/RecoveryController';
import { CreateRecoveryCaseUseCase } from '../../recovery/application/use-cases/CreateRecoveryCaseUseCase';
import { RecoveryAsyncJobsService } from '../../recovery/application/services/RecoveryAsyncJobsService';
import { GenerateRecoveryPaymentLinkUseCase } from '../../recovery/application/use-cases/GenerateRecoveryPaymentLinkUseCase';
import { GenerateRecoveryReportUseCase } from '../../recovery/application/use-cases/GenerateRecoveryReportUseCase';
import { GetRecoveryCaseUseCase } from '../../recovery/application/use-cases/GetRecoveryCaseUseCase';
import { ListRecoveryCasesUseCase } from '../../recovery/application/use-cases/ListRecoveryCasesUseCase';
import { RegenerateRecoveryGuidanceUseCase } from '../../recovery/application/use-cases/RegenerateRecoveryGuidanceUseCase';
import { SendRecoveryGuidanceUseCase } from '../../recovery/application/use-cases/SendRecoveryGuidanceUseCase';
import { TriggerRecoveryOutreachUseCase } from '../../recovery/application/use-cases/TriggerRecoveryOutreachUseCase';
import { UpdateRecoveryCaseStatusUseCase } from '../../recovery/application/use-cases/UpdateRecoveryCaseStatusUseCase';
import { ListRecoveryPlaybooksUseCase } from '../../recovery/application/use-cases/ListRecoveryPlaybooksUseCase';
import { SeedDefaultRecoveryPlaybookUseCase } from '../../recovery/application/use-cases/SeedDefaultRecoveryPlaybookUseCase';
import { CreateRecoveryPlaybookUseCase } from '../../recovery/application/use-cases/CreateRecoveryPlaybookUseCase';
import { ActivateRecoveryPlaybookUseCase } from '../../recovery/application/use-cases/ActivateRecoveryPlaybookUseCase';
import { ScheduleRecoveryRecurringChargeUseCase } from '../../recovery/application/use-cases/ScheduleRecoveryRecurringChargeUseCase';
import { ListRecoveryRecurringChargesUseCase } from '../../recovery/application/use-cases/ListRecoveryRecurringChargesUseCase';
import { CancelRecoveryRecurringChargeUseCase } from '../../recovery/application/use-cases/CancelRecoveryRecurringChargeUseCase';

describe('Messaging Recovery Flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RecoveryController],
      providers: [
        {
          provide: CreateRecoveryCaseUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              id: 'recovery-1',
              debtorName: 'Cliente em atraso',
              status: 'READY_TO_CONTACT',
              amountDue: 199,
            }),
          },
        },
        { provide: RecoveryAsyncJobsService, useValue: { createJob: jest.fn(), attachQueueJobId: jest.fn(), getJob: jest.fn(), listJobs: jest.fn(), getDownloadPayload: jest.fn() } },
        {
          provide: GenerateRecoveryPaymentLinkUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              paymentLinkId: 'plink-recovery-1',
              paymentLinkUrl: 'https://pay.test/recovery-1',
            }),
          },
        },
        { provide: GenerateRecoveryReportUseCase, useValue: { execute: jest.fn() } },
        { provide: GetRecoveryCaseUseCase, useValue: { execute: jest.fn() } },
        {
          provide: ListRecoveryCasesUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue([
              {
                id: 'recovery-1',
                debtorName: 'Cliente em atraso',
                status: 'PAID',
                amountDue: 199,
              },
            ]),
          },
        },
        { provide: RegenerateRecoveryGuidanceUseCase, useValue: { execute: jest.fn() } },
        { provide: SendRecoveryGuidanceUseCase, useValue: { execute: jest.fn() } },
        { provide: TriggerRecoveryOutreachUseCase, useValue: { execute: jest.fn() } },
        {
          provide: UpdateRecoveryCaseStatusUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              id: 'recovery-1',
              status: 'PAID',
            }),
          },
        },
        { provide: ListRecoveryPlaybooksUseCase, useValue: { execute: jest.fn() } },
        { provide: SeedDefaultRecoveryPlaybookUseCase, useValue: { execute: jest.fn() } },
        { provide: CreateRecoveryPlaybookUseCase, useValue: { execute: jest.fn() } },
        { provide: ActivateRecoveryPlaybookUseCase, useValue: { execute: jest.fn() } },
        { provide: ScheduleRecoveryRecurringChargeUseCase, useValue: { execute: jest.fn() } },
        { provide: ListRecoveryRecurringChargesUseCase, useValue: { execute: jest.fn() } },
        { provide: CancelRecoveryRecurringChargeUseCase, useValue: { execute: jest.fn() } },
        { provide: 'BullQueue_recovery-async-jobs', useValue: { add: jest.fn() } },
      ],
    })
      .overrideGuard(JwtCookieGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a recovery case, generates a payment link and marks the case as paid', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/tenants/tenant-1/recovery/cases')
      .send({
        debtorName: 'Cliente em atraso',
        phone: '5511999999999',
        amountDue: 199,
      })
      .expect(201);

    expect(created.body).toEqual(
      expect.objectContaining({
        id: 'recovery-1',
        status: 'READY_TO_CONTACT',
      }),
    );

    const paymentLink = await request(app.getHttpServer())
      .post('/api/v1/tenants/tenant-1/recovery/cases/recovery-1/payment-link')
      .send({ billingType: 'PIX' })
      .expect(201);

    expect(paymentLink.body).toEqual(
      expect.objectContaining({
        paymentLinkId: 'plink-recovery-1',
        paymentLinkUrl: 'https://pay.test/recovery-1',
      }),
    );

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/tenants/tenant-1/recovery/cases/recovery-1/status')
      .send({ status: 'PAID' })
      .expect(200);

    expect(updated.body).toEqual(
      expect.objectContaining({
        id: 'recovery-1',
        status: 'PAID',
      }),
    );
  });
});
