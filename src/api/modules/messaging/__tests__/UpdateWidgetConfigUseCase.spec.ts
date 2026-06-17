import { UpdateWidgetConfigUseCase } from '../application/use-cases/UpdateWidgetConfigUseCase';
import { IWidgetConfigRepository } from '../domain/repositories/IWidgetConfigRepository';

describe('UpdateWidgetConfigUseCase', () => {
  let useCase: UpdateWidgetConfigUseCase;
  let repo: jest.Mocked<IWidgetConfigRepository>;

  const stored = {
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

  const baseInput = {
    collectName: true,
    collectPhone: false,
    collectEmail: false,
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
    useCase = new UpdateWidgetConfigUseCase(repo);
  });

  it('upserts the config scoped to the tenant', async () => {
    repo.upsertByTenantId.mockResolvedValue(stored);

    const result = await useCase.execute('tenant-1', {
      ...baseInput,
      name: 'New Name',
    });

    expect(repo.upsertByTenantId).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ name: 'New Name', collectName: true }),
    );
    expect(result).toBe(stored);
  });

  it('coerces null color/position to undefined so stored defaults survive', async () => {
    repo.upsertByTenantId.mockResolvedValue(stored);

    await useCase.execute('tenant-1', {
      ...baseInput,
      color: null,
      position: undefined,
    });

    const passed = repo.upsertByTenantId.mock.calls[0][1];
    expect(passed.color).toBeUndefined();
    expect(passed.position).toBeUndefined();
  });

  it('preserves a provided color', async () => {
    repo.upsertByTenantId.mockResolvedValue(stored);

    await useCase.execute('tenant-1', { ...baseInput, color: '#abcdef' });

    expect(repo.upsertByTenantId.mock.calls[0][1].color).toBe('#abcdef');
  });

  it('forwards quickReplies untouched', async () => {
    repo.upsertByTenantId.mockResolvedValue(stored);

    await useCase.execute('tenant-1', {
      ...baseInput,
      quickReplies: ['A', 'B'],
    });

    expect(repo.upsertByTenantId.mock.calls[0][1].quickReplies).toEqual([
      'A',
      'B',
    ]);
  });
});
