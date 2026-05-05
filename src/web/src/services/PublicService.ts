export interface PlanAPI {
  code: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  messagesQuota: number;
  aiTokensQuota: number;
  contactsQuota: number;
  features: string[];
  isStandard: boolean;
  config: any;
}

export interface NicheAPI {
  code: string;
  displayName: string;
  description: string;
  pains: string[];
  iconName: string;
  modules: string[];
}

export interface ModuleAPI {
  code: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  active: boolean;
  config: any;
}

export interface TrialSignupData {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  cpf: string;
  cnpj: string;
  nicheCode: string;
  plan: string;
  password: string;
}

const API_BASE_URL = "http://localhost:3000/api/v1";

class PublicService {
  async getPlans(): Promise<{ plans: PlanAPI[] }> {
    const response = await fetch(`${API_BASE_URL}/public/billing/plans`);
    if (!response.ok) {
      throw new Error("Erro ao carregar planos");
    }
    const result = await response.json();
    return result.data;
  }

  async getNiches(): Promise<{ niches: NicheAPI[] }> {
    const response = await fetch(`${API_BASE_URL}/public/billing/niches`);
    if (!response.ok) {
      throw new Error("Erro ao carregar nichos");
    }
    const result = await response.json();
    return result.data;
  }

  async getModules(): Promise<{ modules: ModuleAPI[] }> {
    const response = await fetch(`${API_BASE_URL}/public/billing/modules`);
    if (!response.ok) {
      throw new Error("Erro ao carregar módulos");
    }
    const result = await response.json();
    return result.data;
  }

  async initiateTrial(data: TrialSignupData): Promise<{ subscriptionId?: string; invoiceUrl?: string }> {
    const response = await fetch(`${API_BASE_URL}/public/payments/trial/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erro ao iniciar teste grátis");
    }

    const result = await response.json();
    return result.data;
  }
}

export const publicService = new PublicService();
