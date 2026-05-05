import { Injectable } from '@nestjs/common';
import { TenantModuleAccessService } from './TenantModuleAccessService';
import { BILLING_MODULE_CODE_COMMERCE } from './billing-module-codes';

/**
 * ATT-SALES-010 (MVP): sem marcação manual quando o módulo de checkout/commerce está activo na subscrição.
 */
@Injectable()
export class TenantManualSaleEligibilityService {
  constructor(
    private readonly tenantModuleAccessService: TenantModuleAccessService,
  ) {}

  async supportsManualSaleAttribution(tenantId: string): Promise<boolean> {
    const summary = await this.tenantModuleAccessService.getSummary(tenantId);
    return summary.moduleAccess[BILLING_MODULE_CODE_COMMERCE] !== true;
  }
}
