import { apiClient } from '@/shared/api/client';

export interface WidgetConfig {
  id: string;
  tenantId: string;
  publicToken: string;
  name: string;
  enabled: boolean;
  greeting: string | null;
  color: string | null;
  position: 'bottom-right' | 'bottom-left';
  avatarUrl: string | null;
  collectName: boolean;
  collectPhone: boolean;
  proactiveDelay: number | null;
  proactiveMsg: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWidgetConfigInput {
  name?: string;
  enabled?: boolean;
  greeting?: string | null;
  color?: string | null;
  position?: 'bottom-right' | 'bottom-left';
  avatarUrl?: string | null;
  collectName?: boolean;
  collectPhone?: boolean;
  proactiveDelay?: number | null;
  proactiveMsg?: string | null;
}

export const widgetService = {
  async getConfig(tenantId: string): Promise<WidgetConfig> {
    return apiClient.get<WidgetConfig>(`/tenants/${tenantId}/widget-config`);
  },

  async updateConfig(tenantId: string, input: UpdateWidgetConfigInput): Promise<WidgetConfig> {
    return apiClient.put<WidgetConfig>(`/tenants/${tenantId}/widget-config`, input);
  },
};
