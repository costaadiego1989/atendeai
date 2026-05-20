import { apiClient } from '@/shared/api/client';
import type {
  Automation,
  CreateAutomationInput,
  UpdateAutomationInput,
} from '../types';

export const automationService = {
  async list(tenantId: string, onlyActive?: boolean): Promise<Automation[]> {
    const query = onlyActive ? '?active=true' : '';
    return apiClient.get<Automation[]>(`/tenants/${tenantId}/automations${query}`);
  },

  async create(tenantId: string, input: CreateAutomationInput): Promise<Automation> {
    return apiClient.post<Automation>(`/tenants/${tenantId}/automations`, input);
  },

  async update(
    tenantId: string,
    automationId: string,
    input: UpdateAutomationInput,
  ): Promise<Automation> {
    return apiClient.put<Automation>(
      `/tenants/${tenantId}/automations/${automationId}`,
      input,
    );
  },

  async remove(tenantId: string, automationId: string): Promise<void> {
    return apiClient.delete<void>(`/tenants/${tenantId}/automations/${automationId}`);
  },

  async activate(tenantId: string, automationId: string): Promise<Automation> {
    return apiClient.put<Automation>(
      `/tenants/${tenantId}/automations/${automationId}/activate`,
    );
  },

  async deactivate(tenantId: string, automationId: string): Promise<Automation> {
    return apiClient.put<Automation>(
      `/tenants/${tenantId}/automations/${automationId}/deactivate`,
    );
  },
};
