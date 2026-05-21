import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from '@shared/domain/services/FileStorageService';
import { TenantPDFResumeRepository } from '../../infrastructure/persistence/repositories/TenantPDFResumeRepository';

@Injectable()
export class DeleteDocumentUseCase {
  constructor(
    @Inject(FILE_STORAGE_SERVICE) private readonly storage: FileStorageService,
    private readonly repository: TenantPDFResumeRepository,
  ) {}

  async execute(tenantId: string, documentId: string): Promise<void> {
    const record = await this.repository.findById(documentId);

    if (!record || record.tenantId !== tenantId) {
      throw new NotFoundException('Documento não encontrado');
    }

    if (record.fileUrl) {
      try {
        await this.storage.delete(record.fileUrl);
      } catch {
        // Non-fatal: S3 delete failure should not block DB cleanup
      }
    }

    await this.repository.deleteById(documentId);
  }
}
