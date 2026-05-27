import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from '@shared/domain/services/FileStorageService';
import {
  ITenantPDFResumeRepository,
  TENANT_PDF_RESUME_REPOSITORY,
} from '../../domain/repositories/ITenantPDFResumeRepository';

export interface DeleteDocumentInput {
  tenantId: string;
  documentId: string;
}

@Injectable()
export class DeleteDocumentUseCase implements IUseCase<
  DeleteDocumentInput,
  void
> {
  constructor(
    @Inject(FILE_STORAGE_SERVICE) private readonly storage: FileStorageService,
    @Inject(TENANT_PDF_RESUME_REPOSITORY)
    private readonly repository: ITenantPDFResumeRepository,
  ) {}

  async execute(input: DeleteDocumentInput): Promise<void> {
    const record = await this.repository.findById(
      input.documentId,
      input.tenantId,
    );

    if (!record) {
      throw new NotFoundException('Documento não encontrado');
    }

    if (record.fileUrl) {
      try {
        await this.storage.delete(record.fileUrl);
      } catch {
        // Non-fatal: S3 delete failure should not block DB cleanup
      }
    }

    await this.repository.deleteById(input.documentId, input.tenantId);
  }
}
