import { IUseCase } from '@shared/application/IUseCase';

export interface CreateTenantInput {
  companyName: string;
  cnpj: string;
  ownerName: string;
  ownerCpf?: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerPassword: string;
  plan?: string;
  businessType?: string;
  isTrial?: boolean;
}

export interface CreateTenantOutput {
  id: string;
  companyName: string;
  cnpj: string;
  plan: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: Date;
}

export interface ICreateTenantUseCase extends IUseCase<
  CreateTenantInput,
  CreateTenantOutput
> {}
export const ICreateTenantUseCase = Symbol('ICreateTenantUseCase');
