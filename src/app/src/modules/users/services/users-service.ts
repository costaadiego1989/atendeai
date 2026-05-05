import { apiClient } from '@/shared/api/client';
import type { User } from '@/shared/types';

export interface CreateTeamMemberInput {
  name: string;
  email: string;
  phone: string;
  role: 'ADMIN' | 'AGENT';
  accessibleBranchIds?: string[];
  mustChangePassword?: boolean;
}

export interface UpdateTeamMemberInput {
  name?: string;
  email?: string;
  phone?: string;
  role?: 'OWNER' | 'ADMIN' | 'AGENT';
  accessibleBranchIds?: string[];
  mustChangePassword?: boolean;
}

export const usersService = {
  async listUsers(tenantId: string): Promise<User[]> {
    return apiClient.get<User[]>(`/tenants/${tenantId}/users`);
  },

  async createUser(
    tenantId: string,
    input: CreateTeamMemberInput,
  ): Promise<{ id: string }> {
    return apiClient.post(`/tenants/${tenantId}/users`, input);
  },

  async updateUser(
    tenantId: string,
    userId: string,
    input: UpdateTeamMemberInput,
  ): Promise<void> {
    await apiClient.put(`/tenants/${tenantId}/users/${userId}`, input);
  },

  async deleteUser(tenantId: string, userId: string): Promise<void> {
    await apiClient.delete(`/tenants/${tenantId}/users/${userId}`);
  },
};
