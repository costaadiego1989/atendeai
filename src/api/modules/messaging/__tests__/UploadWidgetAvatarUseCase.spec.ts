import { UnprocessableEntityException } from '@nestjs/common';
import { UploadWidgetAvatarUseCase } from '../application/use-cases/UploadWidgetAvatarUseCase';
import { FileStorageService } from '@shared/domain/services/FileStorageService';
import { IWidgetConfigRepository } from '../domain/repositories/IWidgetConfigRepository';

describe('UploadWidgetAvatarUseCase', () => {
  let useCase: UploadWidgetAvatarUseCase;
  let storage: jest.Mocked<FileStorageService>;
  let repo: jest.Mocked<IWidgetConfigRepository>;

  const buffer = Buffer.from('fake-image');

  beforeEach(() => {
    storage = {
      upload: jest.fn(),
      delete: jest.fn(),
    };
    repo = {
      findByPublicToken: jest.fn(),
      findByTenantId: jest.fn(),
      findOrCreate: jest.fn(),
      update: jest.fn(),
      upsertByTenantId: jest.fn(),
      updateAvatar: jest.fn(),
    };
    useCase = new UploadWidgetAvatarUseCase(storage, repo);
  });

  it('rejects unsupported mime types', async () => {
    await expect(
      useCase.execute('tenant-1', buffer, 'application/pdf'),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
  ])('uploads %s with the right extension', async (mime, ext) => {
    storage.upload.mockResolvedValue(`https://cdn/avatar.${ext}`);
    repo.updateAvatar.mockResolvedValue({} as any);

    const result = await useCase.execute('tenant-1', buffer, mime);

    expect(storage.upload).toHaveBeenCalledWith(
      buffer,
      `avatar.${ext}`,
      mime,
      { folder: 'widget-avatars/tenant-1', isPublic: true },
    );
    expect(result).toEqual({ avatarUrl: `https://cdn/avatar.${ext}` });
  });

  it('persists the uploaded url against the tenant config', async () => {
    storage.upload.mockResolvedValue('https://cdn/avatar.png');
    repo.updateAvatar.mockResolvedValue({} as any);

    await useCase.execute('tenant-1', buffer, 'image/png');

    expect(repo.updateAvatar).toHaveBeenCalledWith(
      'tenant-1',
      'https://cdn/avatar.png',
    );
  });

  it('scopes the storage folder per tenant', async () => {
    storage.upload.mockResolvedValue('https://cdn/x.png');
    repo.updateAvatar.mockResolvedValue({} as any);

    await useCase.execute('tenant-XYZ', buffer, 'image/png');

    expect(storage.upload.mock.calls[0][3]).toEqual({
      folder: 'widget-avatars/tenant-XYZ',
      isPublic: true,
    });
  });
});
