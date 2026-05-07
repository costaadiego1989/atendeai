import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ApiKeyGuard } from '../../../shared/infrastructure/guards/ApiKeyGuard';
import { IntegrationController } from '../../tenant/presentation/controllers/IntegrationController';
import { CreateExternalTenantUseCase } from '../../tenant/application/use-cases/CreateExternalTenantUseCase';

describe('Messaging Business Info Flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [IntegrationController],
      providers: [
        {
          provide: CreateExternalTenantUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              apiKey: 'api-key-generated',
            }),
          },
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().tenant = {
            companyName: { value: 'Clinica Central' },
            businessType: 'HEALTH',
            description: 'Atendimento com especialistas e agenda online.',
            promotions: [
              {
                title: 'Consulta com desconto',
                description: '10% off para novos pacientes',
                value: '10%',
                imageUrl: null,
              },
            ],
            operatingHours: {
              monday: {
                open: '08:00',
                close: '18:00',
              },
            },
            catalogUrl: 'https://empresa.test/catalogo',
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns company info, hours, promotions and catalog for external business queries', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tenant/external/config')
      .set('x-api-key', 'valid-key')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        companyName: 'Clinica Central',
        businessType: 'HEALTH',
        description: 'Atendimento com especialistas e agenda online.',
        catalogUrl: 'https://empresa.test/catalogo',
        promotions: [
          expect.objectContaining({
            title: 'Consulta com desconto',
          }),
        ],
        operatingHours: expect.objectContaining({
          monday: expect.objectContaining({
            open: '08:00',
            close: '18:00',
          }),
        }),
      }),
    );
  });
});
