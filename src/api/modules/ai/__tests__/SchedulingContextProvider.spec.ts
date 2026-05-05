import { SchedulingContextProvider } from '../infrastructure/adapters/SchedulingContextProvider';
import { ISchedulingFacade } from '@modules/scheduling/application/facades/SchedulingFacade';

describe('SchedulingContextProvider', () => {
  let facade: jest.Mocked<ISchedulingFacade>;
  let provider: SchedulingContextProvider;

  beforeEach(() => {
    facade = {
      listCategories: jest.fn(),
      listProfessionals: jest.fn(),
      getCategoryAvailability: jest.fn(),
    };

    provider = new SchedulingContextProvider(facade);
  });

  it('should include base price and custom slot price in scheduling context', async () => {
    facade.listCategories.mockResolvedValue([
      {
        id: 'cat-1',
        tenantId: 'tenant-1',
        name: 'Clareamento',
        unit: 'PER_SESSION',
        basePrice: 180,
        active: true,
        createdAt: '2030-06-15T00:00:00.000Z',
      },
    ]);

    facade.getCategoryAvailability.mockResolvedValueOnce([
      {
        professionalId: 'prof-1',
        professionalName: 'Dra. Ana',
        slots: [
          {
            id: 'slot-1',
            startsAt: '14:00',
            endsAt: '15:00',
            status: 'AVAILABLE',
            customPrice: 220,
          },
          {
            id: 'slot-2',
            startsAt: '16:00',
            endsAt: '17:00',
            status: 'RESERVED',
          },
        ],
      },
    ]);
    facade.getCategoryAvailability.mockResolvedValue([]);

    const result = await provider.findRelevantAvailability(
      'tenant-1',
      'Tem clareamento amanha? Qual o preço?',
    );

    expect(result).toContain('Scheduling context:');
    expect(result).toContain('- Base price: BRL 180.00 (per session)');
    expect(result).toContain('- Summary: 1 open, 1 reserved, 0 blocked');
    expect(result).toContain('14:00-15:00 (price BRL 220.00)');
    expect(result).toContain('[SCHEDULE_SLOT: professionalId=<professionalId>');
    expect(result).toContain('professionalId=prof-1');
    expect(result).toContain('categoryId=cat-1');
  });

  it('should build a broader monthly window when the message asks about the month', async () => {
    facade.listCategories.mockResolvedValue([
      {
        id: 'cat-1',
        tenantId: 'tenant-1',
        name: 'Consulta',
        unit: 'PER_CONSULTATION',
        basePrice: 350,
        active: true,
        createdAt: '2030-06-15T00:00:00.000Z',
      },
    ]);

    facade.getCategoryAvailability.mockResolvedValue([]);

    const result = await provider.findRelevantAvailability(
      'tenant-1',
      'Quais consultas voces tem este mes?',
    );

    expect(result).toContain('- Window: next 30 days');
    expect(facade.getCategoryAvailability).toHaveBeenCalledTimes(30);
    expect(result).toContain('- Availability: no scheduling records found in the selected window');
  });

  it('should expose services and professionals when the customer asks for appointments without naming a service', async () => {
    facade.listCategories.mockResolvedValue([
      {
        id: 'cat-1',
        tenantId: 'tenant-1',
        name: 'Consulta inicial',
        unit: 'PER_CONSULTATION',
        basePrice: 250,
        active: true,
        createdAt: '2030-06-15T00:00:00.000Z',
      },
    ]);
    facade.listProfessionals.mockResolvedValue([
      {
        id: 'prof-1',
        tenantId: 'tenant-1',
        name: 'Dra. Ana',
        role: 'dentista',
        active: true,
        createdAt: '2030-06-15T00:00:00.000Z',
      },
    ]);

    const result = await provider.findRelevantAvailability(
      'tenant-1',
      'Quero marcar um horario',
    );

    expect(result).toContain('Services available');
    expect(result).toContain('Service: Consulta inicial | categoryId=cat-1');
    expect(result).toContain('Professional: Dra. Ana | professionalId=prof-1');
    expect(facade.getCategoryAvailability).not.toHaveBeenCalled();
  });
});
