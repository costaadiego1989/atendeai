import { Injectable } from '@nestjs/common';
import { TenantPDFResumeRepository } from '@modules/tenant/infrastructure/persistence/repositories/TenantPDFResumeRepository';
import { ITenantPDFContextProvider } from '../../application/ports/ITenantPDFContextProvider';

@Injectable()
export class TenantPDFContextProvider implements ITenantPDFContextProvider {
  constructor(private readonly repository: TenantPDFResumeRepository) {}

  async findRelevantPDFContext(tenantId: string): Promise<string | null> {
    const summaries = await this.repository.listReadySummaries(tenantId);
    if (!summaries.length) {
      return null;
    }

    return summaries.slice(0, 8).map((summary, index) => `${index + 1}. ${summary}`).join('\n');
  }
}
