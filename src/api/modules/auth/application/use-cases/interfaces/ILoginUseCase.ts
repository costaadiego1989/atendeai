import { IUseCase } from '@shared/application/IUseCase';
import { AuthRequestContext } from '../../types/AuthRequestContext';

export interface LoginInput {
  email: string;
  password: string;
  context?: AuthRequestContext;
}

export interface LoginOutput {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    accessibleBranchIds?: string[];
    phone?: string;
    cpf?: string;
    role: string;
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

export interface ILoginUseCase extends IUseCase<LoginInput, LoginOutput> {}
export const ILoginUseCase = Symbol('ILoginUseCase');
