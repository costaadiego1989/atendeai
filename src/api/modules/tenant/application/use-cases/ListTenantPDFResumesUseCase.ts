import { Injectable } from '@nestjs/common';
import { TenantPDFResumeRepository } from '../../infrastructure/persistence/repositories/TenantPDFResumeRepository';

@Injectable()
export class ListTenantPDFResumesUseCase {
  constructor(private readonly repository: TenantPDFResumeRepository) {}

  async execute(tenantId: string) {
    return this.repository.listByTenant(tenantId);
  }
}
