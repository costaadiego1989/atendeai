import { describe, it, expect, vi, beforeEach } from 'vitest';
import { knowledgeBaseService } from '../services/knowledge-base-service';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

describe('knowledgeBaseService', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listDocuments', () => {
    it('should call GET /tenants/:tenantId/documents', async () => {
      const mockData = [
        { id: 'doc-1', title: 'FAQ.pdf', status: 'PROCESSED', chunksCount: 12 },
      ];
      mockGet.mockResolvedValue(mockData);

      const result = await knowledgeBaseService.listDocuments(tenantId);

      expect(mockGet).toHaveBeenCalledWith(`/tenants/${tenantId}/documents`);
      expect(result).toEqual(mockData);
    });
  });

  describe('uploadDocument', () => {
    it('should call POST /tenants/:tenantId/documents with FormData', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const mockResponse = { id: 'doc-2', title: 'test.pdf', status: 'PROCESSING' };
      mockPost.mockResolvedValue(mockResponse);

      const result = await knowledgeBaseService.uploadDocument(tenantId, file, 'Documento teste');

      expect(mockPost).toHaveBeenCalledWith(
        `/tenants/${tenantId}/documents`,
        expect.any(FormData),
      );
      expect(result.id).toBe('doc-2');
    });
  });

  describe('deleteDocument', () => {
    it('should call DELETE /tenants/:tenantId/documents/:id', async () => {
      mockDelete.mockResolvedValue(undefined);

      await knowledgeBaseService.deleteDocument(tenantId, 'doc-1');

      expect(mockDelete).toHaveBeenCalledWith(`/tenants/${tenantId}/documents/doc-1`);
    });
  });
});
