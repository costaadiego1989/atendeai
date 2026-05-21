import { GetWidgetConfigUseCase } from '../application/use-cases/GetWidgetConfigUseCase';

describe('GetWidgetConfigUseCase', () => {
  let useCase: GetWidgetConfigUseCase;
  let prisma: { widgetConfig: { findFirst: jest.Mock; create: jest.Mock } };

  const existingConfig = {
    id: 'cfg-1',
    tenantId: 'tenant-1',
    enabled: true,
    publicToken: 'tok-abc',
  };

  beforeEach(() => {
    prisma = {
      widgetConfig: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    useCase = new GetWidgetConfigUseCase(prisma as any);
  });

  it('returns existing config without creating a new one', async () => {
    prisma.widgetConfig.findFirst.mockResolvedValue(existingConfig);

    const result = await useCase.execute('tenant-1');

    expect(result).toEqual(existingConfig);
    expect(prisma.widgetConfig.create).not.toHaveBeenCalled();
  });

  it('creates default config when none exists', async () => {
    prisma.widgetConfig.findFirst.mockResolvedValue(null);
    prisma.widgetConfig.create.mockResolvedValue({ ...existingConfig, id: 'cfg-new' });

    const result = await useCase.execute('tenant-1');

    expect(prisma.widgetConfig.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1' },
    });
    expect(result.id).toBe('cfg-new');
  });

  it('queries by tenantId', async () => {
    prisma.widgetConfig.findFirst.mockResolvedValue(existingConfig);

    await useCase.execute('tenant-xyz');

    expect(prisma.widgetConfig.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-xyz' },
    });
  });
});
