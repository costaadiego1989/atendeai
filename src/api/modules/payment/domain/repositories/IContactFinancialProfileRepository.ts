export interface ContactFinancialProfileRecord {
  id: string;
  tenantId: string;
  contactId: string;
  provider: 'ASAAS';
  asaasCustomerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContactFinancialProfileRepository {
  findByTenantAndContact(
    tenantId: string,
    contactId: string,
  ): Promise<ContactFinancialProfileRecord | null>;
  save(
    record: Omit<ContactFinancialProfileRecord, 'createdAt' | 'updatedAt'>,
  ): Promise<ContactFinancialProfileRecord>;
}

export const CONTACT_FINANCIAL_PROFILE_REPOSITORY = Symbol(
  'CONTACT_FINANCIAL_PROFILE_REPOSITORY',
);
