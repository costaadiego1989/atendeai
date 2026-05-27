import { createHash } from 'crypto';
import {
  Injectable,
  Inject,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from '@shared/domain/services/FileStorageService';
import { TenantPDFResumeRepository } from '../../infrastructure/persistence/repositories/TenantPDFResumeRepository';
import { UpsertTenantPDFResumeUseCase } from './UpsertTenantPDFResumeUseCase';

const ALLOWED_MIME_TYPES = ['application/pdf', 'text/plain'];

export interface UploadDocumentInput {
  tenantId: string;
  file: Buffer;
  fileName: string;
  mimeType: string;
  title?: string;
}

export interface UploadDocumentOutput {
  id: string;
  title: string;
  status: string;
  chunksCount: number;
  fileUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UploadDocumentUseCase implements IUseCase<
  UploadDocumentInput,
  UploadDocumentOutput
> {
  constructor(
    @Inject(FILE_STORAGE_SERVICE) private readonly storage: FileStorageService,
    private readonly repository: TenantPDFResumeRepository,
    private readonly upsertUseCase: UpsertTenantPDFResumeUseCase,
  ) {}

  async execute(input: UploadDocumentInput): Promise<UploadDocumentOutput> {
    if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
      throw new UnprocessableEntityException(
        'Tipo de arquivo não suportado. Use PDF ou TXT.',
      );
    }

    const checksum = createHash('sha256').update(input.file).digest('hex');

    const existing = await this.repository.findByChecksum(
      input.tenantId,
      checksum,
    );
    if (existing) {
      return this.toDTO(existing, 0);
    }

    const displayName = input.title || input.fileName;

    const fileUrl = await this.storage.upload(
      input.file,
      input.fileName,
      input.mimeType,
      { folder: `documents/${input.tenantId}` },
    );

    const record = await this.upsertUseCase.execute({
      tenantId: input.tenantId,
      fileName: displayName,
      fileUrl,
      checksum,
    });

    return this.toDTO(record, 0);
  }

  private toDTO(record: any, chunksCount: number): UploadDocumentOutput {
    return {
      id: record.id,
      title: record.fileName,
      status: record.status,
      chunksCount,
      fileUrl: record.fileUrl ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
