import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { SchedulingController } from '../../scheduling/presentation/controllers/SchedulingController';
import { CreateSchedulingProfessionalUseCase } from '../../scheduling/application/use-cases/CreateSchedulingProfessionalUseCase';
import { ListSchedulingProfessionalsUseCase } from '../../scheduling/application/use-cases/ListSchedulingProfessionalsUseCase';
import { SetProfessionalAvailabilityUseCase } from '../../scheduling/application/use-cases/SetProfessionalAvailabilityUseCase';
import { GetProfessionalAvailabilityUseCase } from '../../scheduling/application/use-cases/GetProfessionalAvailabilityUseCase';
import { ReserveProfessionalSlotUseCase } from '../../scheduling/application/use-cases/ReserveProfessionalSlotUseCase';
import { CreateSchedulingCategoryUseCase } from '../../scheduling/application/use-cases/CreateSchedulingCategoryUseCase';
import { ListSchedulingCategoriesUseCase } from '../../scheduling/application/use-cases/ListSchedulingCategoriesUseCase';
import { AssignProfessionalCategoriesUseCase } from '../../scheduling/application/use-cases/AssignProfessionalCategoriesUseCase';
import { ListCategoryProfessionalsUseCase } from '../../scheduling/application/use-cases/ListCategoryProfessionalsUseCase';
import { GetCategoryAvailabilityUseCase } from '../../scheduling/application/use-cases/GetCategoryAvailabilityUseCase';
import { UpdateAvailabilitySlotUseCase } from '../../scheduling/application/use-cases/UpdateAvailabilitySlotUseCase';
import { GenerateSchedulingPaymentLinkUseCase } from '../../scheduling/application/use-cases/GenerateSchedulingPaymentLinkUseCase';
import { RescheduleSchedulingReservationUseCase } from '../../scheduling/application/use-cases/RescheduleSchedulingReservationUseCase';
import { CreateSchedulingRecurrenceUseCase } from '../../scheduling/application/use-cases/CreateSchedulingRecurrenceUseCase';
import { ListSchedulingRecurrencesUseCase } from '../../scheduling/application/use-cases/ListSchedulingRecurrencesUseCase';
import { CancelSchedulingRecurrenceUseCase } from '../../scheduling/application/use-cases/CancelSchedulingRecurrenceUseCase';
import { DeleteSchedulingRecurrenceUseCase } from '../../scheduling/application/use-cases/DeleteSchedulingRecurrenceUseCase';
import { ProcessSchedulingRecurringReservationUseCase } from '../../scheduling/application/use-cases/ProcessSchedulingRecurringReservationUseCase';
import { SchedulingAsyncJobsService } from '../../scheduling/application/services/SchedulingAsyncJobsService';
import { GenerateSchedulingReportUseCase } from '../../scheduling/application/use-cases/GenerateSchedulingReportUseCase';

describe('Messaging Scheduling Flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SchedulingController],
      providers: [
        { provide: CreateSchedulingProfessionalUseCase, useValue: { execute: jest.fn() } },
        {
          provide: ListSchedulingProfessionalsUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue([
              { id: 'prof-1', name: 'Dra Ana', role: 'Dentista' },
            ]),
          },
        },
        { provide: SetProfessionalAvailabilityUseCase, useValue: { execute: jest.fn() } },
        {
          provide: GetProfessionalAvailabilityUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              professionalId: 'prof-1',
              date: '2026-05-10',
              slots: [
                {
                  id: 'slot-1',
                  startsAt: '2026-05-10T13:00:00.000Z',
                  endsAt: '2026-05-10T13:30:00.000Z',
                  status: 'AVAILABLE',
                },
              ],
            }),
          },
        },
        {
          provide: ReserveProfessionalSlotUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              reservationId: 'reservation-1',
              slotId: 'slot-1',
              status: 'RESERVED',
            }),
          },
        },
        { provide: CreateSchedulingCategoryUseCase, useValue: { execute: jest.fn() } },
        {
          provide: ListSchedulingCategoriesUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue([
              { id: 'cat-1', name: 'Avaliacao' },
            ]),
          },
        },
        { provide: AssignProfessionalCategoriesUseCase, useValue: { execute: jest.fn() } },
        {
          provide: ListCategoryProfessionalsUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue([
              { id: 'prof-1', name: 'Dra Ana' },
            ]),
          },
        },
        {
          provide: GetCategoryAvailabilityUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue([
              {
                professionalId: 'prof-1',
                professionalName: 'Dra Ana',
                slots: [
                  {
                    id: 'slot-1',
                    startsAt: '2026-05-10T13:00:00.000Z',
                    endsAt: '2026-05-10T13:30:00.000Z',
                    status: 'AVAILABLE',
                  },
                ],
              },
            ]),
          },
        },
        { provide: UpdateAvailabilitySlotUseCase, useValue: { execute: jest.fn() } },
        {
          provide: GenerateSchedulingPaymentLinkUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              paymentLinkId: 'plink-1',
              paymentLinkUrl: 'https://pay.test/scheduling-1',
            }),
          },
        },
        { provide: RescheduleSchedulingReservationUseCase, useValue: { execute: jest.fn() } },
        { provide: CreateSchedulingRecurrenceUseCase, useValue: { execute: jest.fn() } },
        { provide: ListSchedulingRecurrencesUseCase, useValue: { execute: jest.fn() } },
        { provide: CancelSchedulingRecurrenceUseCase, useValue: { execute: jest.fn() } },
        { provide: DeleteSchedulingRecurrenceUseCase, useValue: { execute: jest.fn() } },
        { provide: ProcessSchedulingRecurringReservationUseCase, useValue: { execute: jest.fn() } },
        { provide: SchedulingAsyncJobsService, useValue: { createJob: jest.fn(), attachQueueJobId: jest.fn(), getJob: jest.fn(), listJobs: jest.fn(), getDownloadPayload: jest.fn() } },
        { provide: GenerateSchedulingReportUseCase, useValue: { execute: jest.fn() } },
        { provide: 'BullQueue_scheduling-async-jobs', useValue: { add: jest.fn() } },
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

  it('lists professionals and categories, shows availability and reserves a slot', async () => {
    const professionals = await request(app.getHttpServer())
      .get('/api/v1/tenants/tenant-1/scheduling/professionals')
      .expect(200);

    expect(professionals.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Dra Ana' })]),
    );

    const categories = await request(app.getHttpServer())
      .get('/api/v1/tenants/tenant-1/scheduling/categories')
      .expect(200);

    expect(categories.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Avaliacao' })]),
    );

    const availability = await request(app.getHttpServer())
      .get('/api/v1/tenants/tenant-1/scheduling/professionals/prof-1/availability?date=2026-05-10')
      .expect(200);

    expect(availability.body.slots).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'slot-1' })]),
    );

    const reservation = await request(app.getHttpServer())
      .post('/api/v1/tenants/tenant-1/scheduling/professionals/prof-1/availability/reservations')
      .send({
        date: '2026-05-10',
        slotId: 'slot-1',
        contactId: 'contact-1',
        categoryId: 'cat-1',
      })
      .expect(201);

    expect(reservation.body).toEqual(
      expect.objectContaining({
        reservationId: 'reservation-1',
        status: 'RESERVED',
      }),
    );
  });
});
