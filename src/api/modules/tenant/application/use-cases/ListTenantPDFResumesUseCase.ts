import { Inject, Injectable, Optional } from '@nestjs/common';
import { TenantPDFResumeRepository, TenantPDFResumeRecord } from '../../infrastructure/persistence/repositories/TenantPDFResumeRepository';
import {
  IDocumentChunkRepository,
  DOCUMENT_CHUNK_REPOSITORY,
} from '@modules/ai/application/ports/IDocumentChunkRepository';

export interface TenantPDFResumeWithChunks extends TenantPDFResumeRecord {
  chunkCount: number;
}

@Injectable()
export class ListTenantPDFResumesUseCase {
  constructor(
    private readonly repository: TenantPDFResumeRepository,
    @Optional()
    @Inject(DOCUMENT_CHUNK_REPOSITORY)
    private readonly chunkRepository?: IDocumentChunkRepository,
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
            ? await this.chunkRepository!.countByDocument(resume.id)
            : 0;
        return { ...resume, chunkCount };
      }),
    );

    return results;
  }
}
