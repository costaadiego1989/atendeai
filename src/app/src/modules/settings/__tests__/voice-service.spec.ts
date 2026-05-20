import { describe, it, expect, vi, beforeEach } from 'vitest';
import { voiceService } from '../services/voice-service';

const mockGet = vi.fn();
const mockPut = vi.fn();
const mockPost = vi.fn();

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe('voiceService', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should call GET /tenants/:tenantId/voice/config', async () => {
      const mockData = {
        enabled: true,
        persona: { name: 'Ana', tone: 'professional' },
        allowedHours: { start: '08:00', end: '20:00' },
      };
      mockGet.mockResolvedValue(mockData);

      const result = await voiceService.getConfig(tenantId);

      expect(mockGet).toHaveBeenCalledWith(`/tenants/${tenantId}/voice/config`);
      expect(result).toEqual(mockData);
    });
  });

  describe('updateConfig', () => {
    it('should call PUT /tenants/:tenantId/voice/config with body', async () => {
      const input = { enabled: true, persona: { name: 'Ana', tone: 'friendly' } };
      mockPut.mockResolvedValue(input);

      const result = await voiceService.updateConfig(tenantId, input);

      expect(mockPut).toHaveBeenCalledWith(`/tenants/${tenantId}/voice/config`, input);
      expect(result).toEqual(input);
    });
  });

  describe('listCalls', () => {
    it('should call GET /tenants/:tenantId/voice/calls with params', async () => {
      const mockData = { items: [], total: 0, page: 1 };
      mockGet.mockResolvedValue(mockData);

      const result = await voiceService.listCalls(tenantId, { page: 1, limit: 20 });

      expect(mockGet).toHaveBeenCalledWith(
        `/tenants/${tenantId}/voice/calls`,
        { page: 1, limit: 20 },
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('getMetrics', () => {
    it('should call GET /tenants/:tenantId/voice/metrics', async () => {
      const mockData = {
        totalCalls: 150,
        answeredRate: 72,
        agreementRate: 45,
        totalRecovered: 12500,
      };
      mockGet.mockResolvedValue(mockData);

      const result = await voiceService.getMetrics(tenantId, '30d');

      expect(mockGet).toHaveBeenCalledWith(
        `/tenants/${tenantId}/voice/metrics`,
        { period: '30d' },
      );
      expect(result.totalCalls).toBe(150);
    });
  });

  describe('initiateCall', () => {
    it('should call POST /tenants/:tenantId/voice/calls', async () => {
      const input = { contactId: 'contact-1', script: 'recovery' };
      const mockResponse = { callId: 'call-1', status: 'INITIATED' };
      mockPost.mockResolvedValue(mockResponse);

      const result = await voiceService.initiateCall(tenantId, input);

      expect(mockPost).toHaveBeenCalledWith(`/tenants/${tenantId}/voice/calls`, input);
      expect(result.callId).toBe('call-1');
    });
  });
});
