import { describe, it, expect, vi, beforeEach } from 'vitest';
import { widgetService } from '../services/widget-service';

const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

describe('widgetService', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should call GET /tenants/:tenantId/widget-config', async () => {
      const mockData = {
        id: 'wc-1',
        name: 'Meu Widget',
        enabled: true,
        publicToken: 'abc-123',
        color: '#3b82f6',
        position: 'bottom-right',
        greeting: 'Olá!',
      };
      mockGet.mockResolvedValue(mockData);

      const result = await widgetService.getConfig(tenantId);

      expect(mockGet).toHaveBeenCalledWith(`/tenants/${tenantId}/widget-config`);
      expect(result).toEqual(mockData);
    });
  });

  describe('updateConfig', () => {
    it('should call PUT /tenants/:tenantId/widget-config with body', async () => {
      const input = {
        name: 'Widget Atualizado',
        color: '#10b981',
        greeting: 'Oi, como posso ajudar?',
        position: 'bottom-left' as const,
        enabled: true,
      };
      const mockResponse = { id: 'wc-1', publicToken: 'abc-123', ...input };
      mockPut.mockResolvedValue(mockResponse);

      const result = await widgetService.updateConfig(tenantId, input);

      expect(mockPut).toHaveBeenCalledWith(
        `/tenants/${tenantId}/widget-config`,
        input,
      );
      expect(result.name).toBe('Widget Atualizado');
    });
  });
});
