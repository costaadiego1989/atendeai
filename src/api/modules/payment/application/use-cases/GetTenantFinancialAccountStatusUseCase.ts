import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantFinancialAccountRepository,
  TENANT_FINANCIAL_ACCOUNT_REPOSITORY,
} from '../../domain/repositories/ITenantFinancialAccountRepository';

@Injectable()
export class GetTenantFinancialAccountStatusUseCase {
  constructor(
    @Inject(TENANT_FINANCIAL_ACCOUNT_REPOSITORY)
    private readonly tenantFinancialAccountRepository: ITenantFinancialAccountRepository,
  ) {}

  async execute(tenantId: string) {
    const account = await this.tenantFinancialAccountRepository.findByTenantId(tenantId);

    if (!account) {
      return {
        configured: false,
        provider: 'ASAAS',
        status: 'NOT_CONFIGURED',
        walletId: null,
        accountId: null,
      };
    }

    return {
      configured: true,
      provider: account.provider,
      status: account.status,
      walletId: account.walletId,
      accountId: account.asaasAccountId,
    };
  }
}
