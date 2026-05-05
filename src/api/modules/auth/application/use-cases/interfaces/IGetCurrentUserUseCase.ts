import { IUseCase } from '@shared/application/IUseCase';

export interface GetCurrentUserOutput {
  user: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    accessibleBranchIds?: string[];
    phone?: string;
    cpf?: string;
    role: 'OWNER' | 'ADMIN' | 'AGENT';
    mustChangePassword: boolean;
  };
  tenant: {
    id: string;
    name: string;
    plan?: string | null;
    cnpj?: string;
    businessType?: string;
    planStatus?: string;
    billingAccess?: {
      subscriptionId?: string | null;
      plan?: string | null;
      status?: string | null;
      pricing: {
        baseMonthlyPrice: number;
        addonsMonthlyPrice: number;
        totalMonthlyPrice: number;
        pricingVersion?: string | null;
      };
      includedModules: string[];
      addonModules: string[];
      enabledModules: string[];
      moduleAccess: Record<string, boolean>;
    };
    branches?: Array<{
      id: string;
      name: string;
      isHeadquarters: boolean;
      active: boolean;
    }>;
    createdAt: string;
  };
}

export interface IGetCurrentUserUseCase extends IUseCase<
  string,
  GetCurrentUserOutput
> {}
export const IGetCurrentUserUseCase = Symbol('IGetCurrentUserUseCase');
