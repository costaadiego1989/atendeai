import { apiClient } from '@/shared/api/client';

export interface VoicePersona {
  name: string;
  tone: 'friendly' | 'professional' | 'firm';
  speed?: number;
  voiceId?: string;
  language?: string;
}

export interface VoiceAllowedHours {
  start: string;
  end: string;
  daysOfWeek?: number[];
}

export interface VoiceRecoveryConfig {
  enabled: boolean;
  daysAfterDue: number;
  minAmount: number;
  maxAttempts: number;
  intervalHours: number;
  blacklistContactIds?: string[];
}

export interface VoiceScript {
  id?: string;
  name: string;
  type: 'recovery' | 'confirmation' | 'follow_up' | 'custom';
  template: string;
  negotiationRules?: {
    maxDiscount?: number;
    maxInstallments?: number;
  };
  escalationMessage?: string;
}

export interface VoiceConfig {
  enabled: boolean;
  persona: VoicePersona;
  allowedHours: VoiceAllowedHours;
  recovery: VoiceRecoveryConfig;
  scripts: VoiceScript[];
  twilioPhoneNumber?: string | null;
  activeScriptName?: string | null;
}

export interface VoiceCall {
  id: string;
  contactId: string;
  contactName?: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: 'INITIATED' | 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'NO_ANSWER';
  duration?: number;
  result?: 'AGREEMENT' | 'REFUSED' | 'CALLBACK' | 'NO_ANSWER' | null;
  amountRecovered?: number | null;
  scriptUsed?: string | null;
  createdAt: string;
}

export interface VoiceCallsResponse {
  items: VoiceCall[];
  total: number;
  page: number;
  totalPages?: number;
}

export interface VoiceMetrics {
  totalCalls: number;
  answeredRate: number;
  agreementRate: number;
  totalRecovered: number;
  avgDuration?: number;
  callsByResult?: Record<string, number>;
}

export interface InitiateCallInput {
  contactId: string;
  script?: string;
}

export const voiceService = {
  async getConfig(tenantId: string): Promise<VoiceConfig> {
    return apiClient.get<VoiceConfig>(`/tenants/${tenantId}/voice/config`);
  },

  async updateConfig(tenantId: string, input: Partial<VoiceConfig>): Promise<VoiceConfig> {
    return apiClient.put<VoiceConfig>(`/tenants/${tenantId}/voice/config`, input);
  },

  async listCalls(
    tenantId: string,
    params: { page?: number; limit?: number; status?: string; period?: string },
  ): Promise<VoiceCallsResponse> {
    return apiClient.get<VoiceCallsResponse>(`/tenants/${tenantId}/voice/calls`, params);
  },

  async getMetrics(tenantId: string, period?: string): Promise<VoiceMetrics> {
    return apiClient.get<VoiceMetrics>(`/tenants/${tenantId}/voice/metrics`, { period });
  },

  async initiateCall(tenantId: string, input: InitiateCallInput): Promise<{ callId: string; status: string }> {
    return apiClient.post<{ callId: string; status: string }>(`/tenants/${tenantId}/voice/calls`, input);
  },

  async suggestScript(
    tenantId: string,
    input: { name: string; type: string },
  ): Promise<{ template: string }> {
    return apiClient.post<{ template: string }>(
      `/tenants/${tenantId}/voice/suggest-script`,
      input,
    );
  },
};
