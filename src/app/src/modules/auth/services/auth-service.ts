import { apiClient } from '@/shared/api/client';
import type { AuthSession, Tenant, User } from '@/shared/types';

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
}

interface BackendTenant {
  id: string;
  name: string;
  plan?: string | null;
  cnpj?: string;
  businessType?: string;
  planStatus?: string;
  billingAccess?: Tenant['billingAccess'];
  createdAt: string;
  branches?: Array<{
    id: string;
    name: string;
    isHeadquarters: boolean;
    active: boolean;
  }>;
}

interface BackendUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  accessibleBranchIds?: string[];
  phone?: string;
  cpf?: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT';
  mustChangePassword?: boolean;
}

interface LoginResponse {
  user: BackendUser;
  tenant: BackendTenant;
}

interface CurrentSessionResponse {
  user: BackendUser;
  tenant: BackendTenant;
}

interface CreateTenantResponse {
  id: string;
  companyName: string;
  cnpj: string;
  plan: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  companyName: string;
  cnpj: string;
  businessType: string;
  ownerName: string;
  ownerCpf: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerPassword: string;
  plan?: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface ChangeFirstAccessPasswordInput {
  password: string;
}

function unwrapResponse<T>(payload: T | ApiEnvelope<T>): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    payload.data !== undefined
  ) {
    return payload.data;
  }

  return payload as T;
}

function mapTenant(tenant: BackendTenant): Tenant {
  if (!tenant) {
    throw new Error('Tenant data is missing in the session response');
  }
  const branches = tenant.branches?.map((branch) => ({
    id: branch.id,
    name: branch.name,
    isHeadquarters: branch.isHeadquarters,
    active: branch.active,
    createdAt: '',
    updatedAt: '',
  })) ?? [];

  return {
    id: tenant.id,
    name: tenant.name,
    plan: tenant.plan ?? undefined,
    cnpj: tenant.cnpj,
    businessType: tenant.businessType,
    planStatus: tenant.planStatus,
    billingAccess: tenant.billingAccess,
    createdAt: tenant.createdAt,
    branches,
    defaultBranchId:
      branches?.find((branch) => branch.isHeadquarters && branch.active)?.id ??
      branches?.find((branch) => branch.active)?.id ??
      null,
  };
}

function mapUser(user: BackendUser): User {
  if (!user) {
    throw new Error('User data is missing in the session response');
  }

  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    cpf: user.cpf,
    accessibleBranchIds: user.accessibleBranchIds,
    role: user.role,
    mustChangePassword: user.mustChangePassword ?? false,
  };
}

function mapSession(input: LoginResponse | CurrentSessionResponse): AuthSession {
  if (!input || !input.user || !input.tenant) {
    console.error('[mapSession] Missing data:', { input });
    throw new Error('Incomplete session data received from server');
  }

  return {
    user: mapUser(input.user),
    tenant: mapTenant(input.tenant),
  };
}

export const authService = {
  async login(input: LoginInput): Promise<AuthSession> {
    const response = await apiClient.post<LoginResponse | ApiEnvelope<LoginResponse>>(
      '/auth/login',
      input,
    );
    return mapSession(unwrapResponse(response));
  },

  async getCurrentSession(): Promise<AuthSession> {
    const response = await apiClient.get<
      CurrentSessionResponse | ApiEnvelope<CurrentSessionResponse>
    >('/auth/me');
    return mapSession(unwrapResponse(response));
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async register(input: RegisterInput): Promise<AuthSession> {
    await apiClient.post<CreateTenantResponse | ApiEnvelope<CreateTenantResponse>>(
      '/tenants',
      input,
    );
    return this.login({
      email: input.ownerEmail,
      password: input.ownerPassword,
    });
  },

  async requestPasswordReset(input: ForgotPasswordInput): Promise<{ message: string }> {
    const response = await apiClient.post<
      { message: string } | ApiEnvelope<{ message: string }>
    >('/auth/forgot-password', input);
    return unwrapResponse(response);
  },

  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    const response = await apiClient.post<
      { message: string } | ApiEnvelope<{ message: string }>
    >('/auth/reset-password', input);
    return unwrapResponse(response);
  },

  async changeFirstAccessPassword(
    input: ChangeFirstAccessPasswordInput,
  ): Promise<{ message: string }> {
    const response = await apiClient.post<
      { message: string } | ApiEnvelope<{ message: string }>
    >('/auth/first-access-password', input);
    return unwrapResponse(response);
  },
};
