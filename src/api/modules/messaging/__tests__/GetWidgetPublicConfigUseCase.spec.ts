import { NotFoundException } from '@nestjs/common';
import { GetWidgetPublicConfigUseCase } from '../application/use-cases/GetWidgetPublicConfigUseCase';
import { IWidgetConfigRepository } from '../domain/repositories/IWidgetConfigRepository';

describe('GetWidgetPublicConfigUseCase', () => {
  let useCase: GetWidgetPublicConfigUseCase;
  let repo: jest.Mocked<IWidgetConfigRepository>;

  const config = {
    id: 'cfg-1',
    tenantId: 'tenant-1',
    enabled: true,
    publicToken: 'tok-abc',
    name: 'Support',
    greeting: 'Olá!',
    color: '#007bff',
    backgroundColor: '#fff',
    position: 'bottom-left',
    avatarUrl: 'https://cdn/avatar.png',
    collectName: true,
    collectPhone: true,
    collectEmail: false,
    collectCpf: false,
    proactiveDelay: 5000,
    proactiveMsg: 'Precisa de ajuda?',
    quickReplies: ['Agendar', 'Preços'],
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
    useCase = new GetWidgetPublicConfigUseCase(repo);
  });

  it('throws NotFoundException when the token resolves to nothing', async () => {
    repo.findByPublicToken.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the widget is disabled', async () => {
    repo.findByPublicToken.mockResolvedValue({ ...config, enabled: false });

    await expect(useCase.execute('tok-abc')).rejects.toThrow(NotFoundException);
  });

  it('returns the public-facing presentation fields', async () => {
    repo.findByPublicToken.mockResolvedValue(config);

    const result = await useCase.execute('tok-abc');

    expect(result).toEqual({
      id: 'cfg-1',
      tenantId: 'tenant-1',
      name: 'Support',
      greeting: 'Olá!',
      color: '#007bff',
      position: 'bottom-left',
      avatarUrl: 'https://cdn/avatar.png',
      collectName: true,
      collectPhone: true,
      collectEmail: false,
      collectCpf: false,
      proactiveDelay: 5000,
      proactiveMsg: 'Precisa de ajuda?',
      quickReplies: ['Agendar', 'Preços'],
    });
  });

  it('does not leak internal-only fields (publicToken, allowedOrigins, enabled)', async () => {
    repo.findByPublicToken.mockResolvedValue(config);

    const result = await useCase.execute('tok-abc');

    expect(result).not.toHaveProperty('publicToken');
    expect(result).not.toHaveProperty('allowedOrigins');
    expect(result).not.toHaveProperty('enabled');
  });

  it('looks the config up by the supplied public token', async () => {
    repo.findByPublicToken.mockResolvedValue(config);

    await useCase.execute('tok-abc');

    expect(repo.findByPublicToken).toHaveBeenCalledWith('tok-abc');
  });
});
