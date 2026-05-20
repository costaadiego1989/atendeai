import { apiClient } from '@/shared/api/client';

export interface TenantDocument {
  id: string;
  tenantId: string;
  title: string;
  sourceType: 'PDF' | 'TXT' | 'URL' | 'MANUAL';
  status: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  chunksCount: number;
  fileUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const knowledgeBaseService = {
  async listDocuments(tenantId: string): Promise<TenantDocument[]> {
    return apiClient.get<TenantDocument[]>(`/tenants/${tenantId}/documents`);
  },

  async uploadDocument(
    tenantId: string,
    file: File,
    title?: string,
  ): Promise<TenantDocument> {
    const formData = new FormData();
    formData.append('file', file);
    if (title) {
      formData.append('title', title);
    }
    return apiClient.post<TenantDocument>(`/tenants/${tenantId}/documents`, formData);
  },

  async deleteDocument(tenantId: string, documentId: string): Promise<void> {
    return apiClient.delete<void>(`/tenants/${tenantId}/documents/${documentId}`);
  },
};
