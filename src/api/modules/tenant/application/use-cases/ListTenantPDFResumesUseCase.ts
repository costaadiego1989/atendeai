import { Inject, Injectable, Optional } from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import {
  TenantPDFResumeRepository,
  TenantPDFResumeRecord,
} from '../../infrastructure/persistence/repositories/TenantPDFResumeRepository';
import {
  IDocumentChunkWriter,
  DOCUMENT_CHUNK_WRITER,
} from '../ports/IDocumentChunkWriter';

export interface TenantPDFResumeWithChunks extends TenantPDFResumeRecord {
  chunkCount: number;
}

@Injectable()
export class ListTenantPDFResumesUseCase implements IUseCase<
  string,
  TenantPDFResumeWithChunks[]
> {
  constructor(
    private readonly repository: TenantPDFResumeRepository,
    @Optional()
    @Inject(DOCUMENT_CHUNK_WRITER)
    private readonly chunkRepository?: IDocumentChunkWriter,
  ) {}

  async execute(tenantId: string): Promise<TenantPDFResumeWithChunks[]> {
    const resumes = await this.repository.listByTenant(tenantId);

    if (!this.chunkRepository) {
      return resumes.map((r) => ({ ...r, chunkCount: 0 }));
    }

    const results = await Promise.all(
      resumes.map(async (resume) => {
        const chunkCount =
          resume.status === 'READY'
            ? await this.chunkRepository!.countByDocument(tenantId, resume.id)
            : 0;
        return { ...resume, chunkCount };
      }),
    );

    return results;
  }
}
