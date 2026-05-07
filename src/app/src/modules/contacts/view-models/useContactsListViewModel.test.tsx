import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useContactsListViewModel } from './useContactsListViewModel';

const createContactMock = vi.fn();
const listContactsMock = vi.fn();
const listAsyncJobsMock = vi.fn();
const toastMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/shared/stores/auth-store', () => ({
  useAuthStore: () => ({
    tenant: {
      id: 'tenant-1',
      branches: [],
    },
    activeBranchId: null,
  }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/modules/contacts/services/contacts-service', () => ({
  contactsService: {
    listContacts: (...args: unknown[]) => listContactsMock(...args),
    listAsyncJobs: (...args: unknown[]) => listAsyncJobsMock(...args),
    createContact: (...args: unknown[]) => createContactMock(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useContactsListViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listContactsMock.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
    });
    listAsyncJobsMock.mockResolvedValue([]);
    createContactMock.mockResolvedValue({
      id: 'contact-1',
      name: 'Ana',
      phone: '123',
      document: '456',
      stage: 'LEAD',
      tags: [],
      createdAt: new Date().toISOString(),
    });
  });

  it('dispara a criação sem bloquear o submit por validação rígida de tamanho', async () => {
    const { result } = renderHook(() => useContactsListViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(listContactsMock).toHaveBeenCalled();
    });

    act(() => {
      result.current.updateCreateForm('name', 'Ana');
      result.current.updateCreateForm('phone', '123');
      result.current.updateCreateForm('document', '456');
    });

    act(() => {
      result.current.submitCreate();
    });

    await waitFor(() => {
      expect(createContactMock).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          name: 'Ana',
          phone: '123',
          document: '456',
        }),
        null,
      );
    });
  });
});
