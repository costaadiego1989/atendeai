import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useKnowledgeBaseViewModel } from '../view-models/useKnowledgeBaseViewModel';

const mockListDocuments = vi.fn();
const mockUploadDocument = vi.fn();
const mockDeleteDocument = vi.fn();

vi.mock('../services/knowledge-base-service', () => ({
  knowledgeBaseService: {
    listDocuments: (...args: unknown[]) => mockListDocuments(...args),
    uploadDocument: (...args: unknown[]) => mockUploadDocument(...args),
    deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
  },
}));

const mockAuthState = {
  tenant: { id: 'tenant-123' },
};

vi.mock('@/shared/stores/auth-store', () => ({
  useAuthStore: (selector?: (state: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}));

const mockToast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const sampleDocs = [
  { id: 'doc-1', title: 'FAQ.pdf', status: 'PROCESSED', chunksCount: 12, sourceType: 'PDF', createdAt: '2026-01-01' },
  { id: 'doc-2', title: 'Politica.txt', status: 'PROCESSING', chunksCount: 0, sourceType: 'TXT', createdAt: '2026-01-02' },
];

describe('useKnowledgeBaseViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDocuments.mockResolvedValue(sampleDocs);
  });

  it('should load documents on mount', async () => {
    const { result } = renderHook(() => useKnowledgeBaseViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListDocuments).toHaveBeenCalledWith('tenant-123');
    expect(result.current.documents).toHaveLength(2);
  });

  it('should upload document and show toast', async () => {
    const newDoc = { id: 'doc-3', title: 'novo.pdf', status: 'PROCESSING' };
    mockUploadDocument.mockResolvedValue(newDoc);

    const { result } = renderHook(() => useKnowledgeBaseViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const file = new File(['content'], 'novo.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.upload(file, 'Novo documento');
    });

    expect(mockUploadDocument).toHaveBeenCalledWith('tenant-123', file, 'Novo documento');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('enviado') }),
    );
  });

  it('should delete document and show toast', async () => {
    mockDeleteDocument.mockResolvedValue(undefined);

    const { result } = renderHook(() => useKnowledgeBaseViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteDoc('doc-1');
    });

    expect(mockDeleteDocument).toHaveBeenCalledWith('tenant-123', 'doc-1');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('removido') }),
    );
  });
});
