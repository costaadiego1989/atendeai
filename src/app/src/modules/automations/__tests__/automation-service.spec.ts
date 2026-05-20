import { describe, it, expect, vi, beforeEach } from 'vitest';
import { automationService } from '../services/automation-service';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

describe('automationService', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should call GET /tenants/:tenantId/automations', async () => {
      const mockData = [{ id: '1', name: 'Test' }];
      mockGet.mockResolvedValue(mockData);

      const result = await automationService.list(tenantId);

      expect(mockGet).toHaveBeenCalledWith(`/tenants/${tenantId}/automations`);
      expect(result).toEqual(mockData);
    });

    it('should pass onlyActive query param when true', async () => {
      mockGet.mockResolvedValue([]);

      await automationService.list(tenantId, true);

      expect(mockGet).toHaveBeenCalledWith(
        `/tenants/${tenantId}/automations?active=true`,
      );
    });
  });

  describe('create', () => {
    it('should call POST /tenants/:tenantId/automations with body', async () => {
      const input = {
        name: 'Nova automação',
        trigger: { type: 'message_received' as const, config: {} },
        steps: [{ type: 'send_message' as const, config: { body: 'Oi' }, order: 0 }],
      };
      const mockResponse = { id: 'auto-1', ...input };
      mockPost.mockResolvedValue(mockResponse);

      const result = await automationService.create(tenantId, input);

      expect(mockPost).toHaveBeenCalledWith(
        `/tenants/${tenantId}/automations`,
        input,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('update', () => {
    it('should call PUT /tenants/:tenantId/automations/:id with body', async () => {
      const automationId = 'auto-1';
      const input = { name: 'Atualizada' };
      mockPut.mockResolvedValue({ id: automationId, ...input });

      const result = await automationService.update(tenantId, automationId, input);

      expect(mockPut).toHaveBeenCalledWith(
        `/tenants/${tenantId}/automations/${automationId}`,
        input,
      );
      expect(result.name).toBe('Atualizada');
    });
  });

  describe('remove', () => {
    it('should call DELETE /tenants/:tenantId/automations/:id', async () => {
      const automationId = 'auto-1';
      mockDelete.mockResolvedValue(undefined);

      await automationService.remove(tenantId, automationId);

      expect(mockDelete).toHaveBeenCalledWith(
        `/tenants/${tenantId}/automations/${automationId}`,
      );
    });
  });

  describe('activate', () => {
    it('should call PUT /tenants/:tenantId/automations/:id/activate', async () => {
      const automationId = 'auto-1';
      mockPut.mockResolvedValue({ id: automationId, isActive: true });

      const result = await automationService.activate(tenantId, automationId);

      expect(mockPut).toHaveBeenCalledWith(
        `/tenants/${tenantId}/automations/${automationId}/activate`,
      );
      expect(result.isActive).toBe(true);
    });
  });

  describe('deactivate', () => {
    it('should call PUT /tenants/:tenantId/automations/:id/deactivate', async () => {
      const automationId = 'auto-1';
      mockPut.mockResolvedValue({ id: automationId, isActive: false });

      const result = await automationService.deactivate(tenantId, automationId);

      expect(mockPut).toHaveBeenCalledWith(
        `/tenants/${tenantId}/automations/${automationId}/deactivate`,
      );
      expect(result.isActive).toBe(false);
    });
  });
});
