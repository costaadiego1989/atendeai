import {
  Injectable,
  Inject,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from '@shared/domain/services/FileStorageService';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

@Injectable()
export class UploadWidgetAvatarUseCase {
  constructor(
    @Inject(FILE_STORAGE_SERVICE) private readonly storage: FileStorageService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    tenantId: string,
    file: Buffer,
    mimeType: string,
  ): Promise<{ avatarUrl: string }> {
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      throw new UnprocessableEntityException(
        'Tipo de imagem não suportado. Use JPG, PNG, GIF ou WebP.',
      );
    }

    const ext = MIME_TO_EXT[mimeType];
    const avatarUrl = await this.storage.upload(
      file,
      `avatar.${ext}`,
      mimeType,
      { folder: `widget-avatars/${tenantId}`, isPublic: true },
    );

    const existing = await this.prisma.widgetConfig.findFirst({
      where: { tenantId },
    });

    if (existing) {
      await this.prisma.widgetConfig.update({
        where: { id: existing.id },
        data: { avatarUrl },
      });
    } else {
      await this.prisma.widgetConfig.create({
        data: { tenantId, avatarUrl },
      });
    }

    return { avatarUrl };
  }
}
