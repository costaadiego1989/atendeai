import { GetWidgetConfigUseCase } from '../application/use-cases/GetWidgetConfigUseCase';
import { IWidgetConfigRepository } from '../domain/repositories/IWidgetConfigRepository';

describe('GetWidgetConfigUseCase', () => {
  let useCase: GetWidgetConfigUseCase;
  let repo: jest.Mocked<IWidgetConfigRepository>;

  const existingConfig = {
    id: 'cfg-1',
    tenantId: 'tenant-1',
    enabled: true,
    publicToken: 'tok-abc',
    name: 'Widget',
    greeting: null,
    color: '#000',
    backgroundColor: null,
    position: 'bottom-right',
    avatarUrl: null,
    collectName: false,
    collectPhone: false,
    collectEmail: false,
    collectCpf: false,
    proactiveDelay: null,
    proactiveMsg: null,
    quickReplies: [],
    allowedOrigins: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repo = {
      findByPublicToken: jest.fn(),
      findByTenantId: jest.fn(),
      findOrCreate: jest.fn(),
      update: jest.fn(),
      upsertByTenantId: jest.fn(),
      updateAvatar: jest.fn(),
    };
    useCase = new GetWidgetConfigUseCase(repo);
  });

  it('returns existing config without creating a new one', async () => {
    repo.findOrCreate.mockResolvedValue(existingConfig);

    const result = await useCase.execute('tenant-1');

    expect(result).toEqual(existingConfig);
    expect(repo.findOrCreate).toHaveBeenCalledWith('tenant-1');
  });

  it('creates default config when none exists', async () => {
    const newConfig = { ...existingConfig, id: 'cfg-new' };
    repo.findOrCreate.mockResolvedValue(newConfig);

    const result = await useCase.execute('tenant-1');

    expect(result.id).toBe('cfg-new');
  });

  it('queries by tenantId', async () => {
    repo.findOrCreate.mockResolvedValue(existingConfig);

    await useCase.execute('tenant-xyz');

    expect(repo.findOrCreate).toHaveBeenCalledWith('tenant-xyz');
  });
});
