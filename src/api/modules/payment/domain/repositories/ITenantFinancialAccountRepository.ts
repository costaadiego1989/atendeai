export interface TenantFinancialAccountRecord {
  id: string;
  tenantId: string;
  provider: 'ASAAS';
  asaasAccountId: string;
  walletId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITenantFinancialAccountRepository {
  findByTenantId(tenantId: string): Promise<TenantFinancialAccountRecord | null>;
  save(
    record: Omit<TenantFinancialAccountRecord, 'createdAt' | 'updatedAt'>,
  ): Promise<TenantFinancialAccountRecord>;
}

export const TENANT_FINANCIAL_ACCOUNT_REPOSITORY = Symbol(
  'TENANT_FINANCIAL_ACCOUNT_REPOSITORY',
);
