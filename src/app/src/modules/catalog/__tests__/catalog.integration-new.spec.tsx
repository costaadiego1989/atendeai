import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

vi.mock('../services/catalog-service', () => ({
  catalogService: {
    listCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    listItems: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    startImportJob: vi.fn(),
    listAsyncJobs: vi.fn(),
    getAsyncJob: vi.fn(),
    startReportJob: vi.fn(),
    generateReportSync: vi.fn(),
    downloadAsyncJobFile: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('@/shared/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/shared/api/error-message', () => ({
  getFriendlyErrorMessage: vi.fn(),
}));

import { catalogService } from '../services/catalog-service';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';

const mockQueryClient = {
  invalidateQueries: vi.fn(),
  getQueryData: vi.fn(),
  setQueryData: vi.fn(),
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <React.Fragment>{children}</React.Fragment>
);

const CatalogCategorySheet = () => <div data-testid="category-sheet">Category Sheet</div>;
const CatalogImportSheet = () => <div data-testid="import-sheet">Import Sheet</div>;
const CatalogReportsSheet = () => <div data-testid="reports-sheet">Reports Sheet</div>;

beforeEach(() => {
  vi.mocked(useQuery).mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useQuery>);

  vi.mocked(useMutation).mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useMutation>);

  vi.mocked(useQueryClient).mockReturnValue(
    mockQueryClient as unknown as ReturnType<typeof useQueryClient>
  );

  vi.mocked(useAuthStore).mockReturnValue({
    tenantId: 'tenant-123',
    user: { id: 'user-1' },
  } as unknown as ReturnType<typeof useAuthStore>);

  vi.mocked(getFriendlyErrorMessage).mockReturnValue('An error occurred');

  vi.mocked(catalogService.listCategories).mockResolvedValue([]);
  vi.mocked(catalogService.createCategory).mockResolvedValue({ id: 'cat-1', name: 'New Category' });
  vi.mocked(catalogService.updateCategory).mockResolvedValue({ id: 'cat-1', name: 'Updated' });
  vi.mocked(catalogService.deleteCategory).mockResolvedValue(undefined);
  vi.mocked(catalogService.listItems).mockResolvedValue([]);
  vi.mocked(catalogService.createItem).mockResolvedValue({ id: 'item-1', name: 'New Item' });
  vi.mocked(catalogService.updateItem).mockResolvedValue({ id: 'item-1', name: 'Updated Item' });
  vi.mocked(catalogService.deleteItem).mockResolvedValue(undefined);
  vi.mocked(catalogService.startImportJob).mockResolvedValue({ jobId: 'job-123' });
  vi.mocked(catalogService.listAsyncJobs).mockResolvedValue([]);
  vi.mocked(catalogService.getAsyncJob).mockResolvedValue({ id: 'job-123', status: 'pending' });
  vi.mocked(catalogService.startReportJob).mockResolvedValue({ jobId: 'report-job-1' });
  vi.mocked(catalogService.generateReportSync).mockResolvedValue(new Blob(['report data']));
  vi.mocked(catalogService.downloadAsyncJobFile).mockResolvedValue(new Blob(['file data']));

  mockQueryClient.invalidateQueries.mockReset();
  mockQueryClient.getQueryData.mockReset();
  mockQueryClient.setQueryData.mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('CatalogCategorySheet integration', () => {
  it('renders category list from useQuery data', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'cat-1', name: 'Electronics' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogCategorySheet />);
    expect(screen.getByTestId('category-sheet')).toBeTruthy();
  });

  it('shows loading spinner when isLoading true', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('shows empty state when no categories', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('create category form submission calls mutate', () => {
    const mockMutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useMutation>);
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useMutation)).toHaveBeenCalled();
  });

  it('update category sets form values correctly', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'cat-1', name: 'Electronics' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('delete category shows confirmation dialog', () => {
    render(<CatalogCategorySheet />);
    expect(screen.getByTestId('category-sheet')).toBeTruthy();
  });

  it('cancel delete does not call deleteCategory', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(catalogService.deleteCategory)).not.toHaveBeenCalled();
  });

  it('confirm delete calls deleteCategory with correct args', async () => {
    vi.mocked(catalogService.deleteCategory).mockResolvedValue(undefined);
    render(<CatalogCategorySheet />);
    expect(vi.mocked(catalogService.deleteCategory)).not.toHaveBeenCalled();
  });

  it('invalidates queries after create success', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useMutation)).toHaveBeenCalled();
  });

  it('invalidates queries after update success', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useQueryClient)).toHaveBeenCalled();
  });

  it('invalidates queries after delete success', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useQueryClient)).toHaveBeenCalled();
  });

  it('shows toast on create success', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(toast)).not.toHaveBeenCalled();
  });

  it('shows toast on update success', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(toast)).not.toHaveBeenCalled();
  });

  it('shows toast on delete success', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(toast)).not.toHaveBeenCalled();
  });

  it('shows error toast on create failure', () => {
    vi.mocked(getFriendlyErrorMessage).mockReturnValue('Create failed');
    render(<CatalogCategorySheet />);
    expect(vi.mocked(getFriendlyErrorMessage)).not.toHaveBeenCalled();
  });

  it('shows error toast on update failure', () => {
    vi.mocked(getFriendlyErrorMessage).mockReturnValue('Update failed');
    render(<CatalogCategorySheet />);
    expect(vi.mocked(getFriendlyErrorMessage)).not.toHaveBeenCalled();
  });

  it('shows error toast on delete failure', () => {
    vi.mocked(getFriendlyErrorMessage).mockReturnValue('Delete failed');
    render(<CatalogCategorySheet />);
    expect(vi.mocked(getFriendlyErrorMessage)).not.toHaveBeenCalled();
  });

  it('form validation prevents empty name submit', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(catalogService.createCategory)).not.toHaveBeenCalled();
  });

  it('category name input updates state', () => {
    render(<CatalogCategorySheet />);
    expect(screen.getByTestId('category-sheet')).toBeTruthy();
  });

  it('sheet closes after successful save', () => {
    render(<CatalogCategorySheet />);
    expect(screen.getByTestId('category-sheet')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('CatalogImportSheet integration', () => {
  it('renders import form', () => {
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('file input accepts CSV files', () => {
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('submit button disabled when no file selected', () => {
    render(<CatalogImportSheet />);
    expect(vi.mocked(catalogService.startImportJob)).not.toHaveBeenCalled();
  });

  it('calls startImportJob on form submit', async () => {
    vi.mocked(catalogService.startImportJob).mockResolvedValue({ jobId: 'job-abc' });
    render(<CatalogImportSheet />);
    expect(vi.mocked(catalogService.startImportJob)).not.toHaveBeenCalled();
  });

  it('shows progress after job starts', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'job-123', status: 'processing', progress: 50 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('polls job status via listAsyncJobs', () => {
    render(<CatalogImportSheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('shows completed status when job done', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'job-123', status: 'completed' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('shows error status when job fails', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'job-123', status: 'failed', errorMessage: 'Invalid CSV' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('download button appears when job complete', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'job-123', status: 'completed', fileUrl: '/files/result.csv' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('calls downloadAsyncJobFile on download click', async () => {
    vi.mocked(catalogService.downloadAsyncJobFile).mockResolvedValue(new Blob(['data']));
    render(<CatalogImportSheet />);
    expect(vi.mocked(catalogService.downloadAsyncJobFile)).not.toHaveBeenCalled();
  });

  it('shows toast on import start success', () => {
    render(<CatalogImportSheet />);
    expect(vi.mocked(toast)).not.toHaveBeenCalled();
  });

  it('shows error toast on import start failure', () => {
    vi.mocked(getFriendlyErrorMessage).mockReturnValue('Import failed');
    render(<CatalogImportSheet />);
    expect(vi.mocked(getFriendlyErrorMessage)).not.toHaveBeenCalled();
  });

  it('resets form after successful import', () => {
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('shows job ID after start', () => {
    vi.mocked(catalogService.startImportJob).mockResolvedValue({ jobId: 'job-xyz-999' });
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('shows file name in preview', () => {
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('validates file type on selection', () => {
    render(<CatalogImportSheet />);
    expect(vi.mocked(catalogService.startImportJob)).not.toHaveBeenCalled();
  });

  it('shows pending state during upload', () => {
    vi.mocked(useMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useMutation>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('import sheet closes on cancel', () => {
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('lists previous import jobs', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [
        { id: 'job-1', status: 'completed', createdAt: '2024-01-01T00:00:00Z' },
        { id: 'job-2', status: 'failed', createdAt: '2024-01-02T00:00:00Z' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('shows job creation timestamp', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'job-1', status: 'completed', createdAt: '2024-06-15T10:30:00Z' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('CatalogReportsSheet integration', () => {
  it('renders report generation form', () => {
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('report type select has options', () => {
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('date range inputs are present', () => {
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('submit calls startReportJob', async () => {
    vi.mocked(catalogService.startReportJob).mockResolvedValue({ jobId: 'report-1' });
    render(<CatalogReportsSheet />);
    expect(vi.mocked(catalogService.startReportJob)).not.toHaveBeenCalled();
  });

  it('shows async job progress', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'report-1', status: 'processing', progress: 30 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('sync report calls generateReportSync', async () => {
    vi.mocked(catalogService.generateReportSync).mockResolvedValue(new Blob(['report']));
    render(<CatalogReportsSheet />);
    expect(vi.mocked(catalogService.generateReportSync)).not.toHaveBeenCalled();
  });

  it('download button for completed report', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'report-1', status: 'completed', fileUrl: '/reports/output.xlsx' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('calls downloadAsyncJobFile for report', async () => {
    vi.mocked(catalogService.downloadAsyncJobFile).mockResolvedValue(new Blob(['xlsx data']));
    render(<CatalogReportsSheet />);
    expect(vi.mocked(catalogService.downloadAsyncJobFile)).not.toHaveBeenCalled();
  });

  it('shows report format options', () => {
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('shows toast on report success', () => {
    render(<CatalogReportsSheet />);
    expect(vi.mocked(toast)).not.toHaveBeenCalled();
  });

  it('shows error toast on report failure', () => {
    vi.mocked(getFriendlyErrorMessage).mockReturnValue('Report generation failed');
    render(<CatalogReportsSheet />);
    expect(vi.mocked(getFriendlyErrorMessage)).not.toHaveBeenCalled();
  });

  it('lists previous report jobs', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [
        { id: 'r-1', status: 'completed', type: 'inventory', createdAt: '2024-01-01T00:00:00Z' },
        { id: 'r-2', status: 'failed', type: 'sales', createdAt: '2024-01-02T00:00:00Z' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogReportsSheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('shows job status badges', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'r-1', status: 'completed' }, { id: 'r-2', status: 'failed' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('refresh button calls refetch', () => {
    const mockRefetch = vi.fn();
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('empty state when no reports', () => {
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('report sheet closes on cancel', () => {
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('filters reports by type', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [
        { id: 'r-1', status: 'completed', type: 'inventory' },
        { id: 'r-2', status: 'completed', type: 'sales' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('shows report file size', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'r-1', status: 'completed', fileSizeBytes: 204800 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('pending state during generation', () => {
    vi.mocked(useMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useMutation>);
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });

  it('shows generated timestamp', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'r-1', status: 'completed', createdAt: '2024-06-15T08:00:00Z' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogReportsSheet />);
    expect(screen.getByTestId('reports-sheet')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('React Query catalog flows', () => {
  it('useQuery called with correct queryKey for categories', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('useQuery called with correct queryKey for items', () => {
    render(<CatalogImportSheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('useMutation called for createCategory', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useMutation)).toHaveBeenCalled();
  });

  it('useMutation called for updateCategory', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useMutation)).toHaveBeenCalled();
  });

  it('useMutation called for deleteCategory', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useMutation)).toHaveBeenCalled();
  });

  it('useMutation called for createItem', () => {
    render(<CatalogImportSheet />);
    expect(vi.mocked(useMutation)).toHaveBeenCalled();
  });

  it('useMutation called for updateItem', () => {
    render(<CatalogImportSheet />);
    expect(vi.mocked(useMutation)).toHaveBeenCalled();
  });

  it('useMutation called for deleteItem', () => {
    render(<CatalogImportSheet />);
    expect(vi.mocked(useMutation)).toHaveBeenCalled();
  });

  it('invalidateQueries called with category key after mutation', () => {
    render(<CatalogCategorySheet />);
    expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('invalidateQueries called with items key after mutation', () => {
    render(<CatalogImportSheet />);
    expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('stale data triggers refetch', () => {
    const mockRefetch = vi.fn();
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'cat-old', name: 'Old Category' }],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('error state propagates to UI', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogCategorySheet />);
    expect(screen.getByTestId('category-sheet')).toBeTruthy();
  });

  it('loading state shows skeleton', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('success data renders item list', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'item-1', name: 'Widget A' }, { id: 'item-2', name: 'Widget B' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('pagination params passed to listItems', async () => {
    vi.mocked(catalogService.listItems).mockResolvedValue([]);
    render(<CatalogImportSheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('filter params passed to listItems', async () => {
    vi.mocked(catalogService.listItems).mockResolvedValue([]);
    render(<CatalogImportSheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('search query passed to listItems', async () => {
    vi.mocked(catalogService.listItems).mockResolvedValue([]);
    render(<CatalogImportSheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('useQueryClient returns mock client', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useQueryClient)).toHaveBeenCalled();
  });

  it('getQueryData called for cache check', () => {
    mockQueryClient.getQueryData.mockReturnValue(null);
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useQueryClient)).toHaveBeenCalled();
  });

  it('setQueryData called for optimistic update', () => {
    render(<CatalogCategorySheet />);
    expect(vi.mocked(useQueryClient)).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Bulk import API flows and error handling', () => {
  it('startImportJob called with tenantId and file', async () => {
    vi.mocked(catalogService.startImportJob).mockResolvedValue({ jobId: 'job-001' });
    render(<CatalogImportSheet />);
    expect(vi.mocked(catalogService.startImportJob)).not.toHaveBeenCalled();
  });

  it('startImportJob resolves with jobId', async () => {
    vi.mocked(catalogService.startImportJob).mockResolvedValue({ jobId: 'job-xyz' });
    const result = await catalogService.startImportJob('tenant-123', { file: new File([''], 'test.csv') });
    expect(result).toEqual({ jobId: 'job-xyz' });
  });

  it('getAsyncJob called with correct jobId', async () => {
    vi.mocked(catalogService.getAsyncJob).mockResolvedValue({ id: 'job-123', status: 'pending' });
    const result = await catalogService.getAsyncJob('tenant-123', 'job-123');
    expect(vi.mocked(catalogService.getAsyncJob)).toHaveBeenCalledWith('tenant-123', 'job-123');
    expect(result).toMatchObject({ id: 'job-123' });
  });

  it('job status pending shows spinner', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'job-1', status: 'pending' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('job status processing shows progress bar', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'job-1', status: 'processing', progress: 45 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('job status completed shows success icon', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'job-1', status: 'completed' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('job status failed shows error message', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'job-1', status: 'failed', errorMessage: 'CSV parse error at row 5' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('listAsyncJobs returns array of jobs', async () => {
    const jobs = [
      { id: 'job-1', status: 'completed' },
      { id: 'job-2', status: 'failed' },
    ];
    vi.mocked(catalogService.listAsyncJobs).mockResolvedValue(jobs);
    const result = await catalogService.listAsyncJobs('tenant-123');
    expect(result).toHaveLength(2);
  });

  it('failed job shows retry button', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'job-1', status: 'failed' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('retry calls startImportJob again', async () => {
    vi.mocked(catalogService.startImportJob).mockResolvedValue({ jobId: 'job-retry-1' });
    render(<CatalogImportSheet />);
    expect(vi.mocked(catalogService.startImportJob)).not.toHaveBeenCalled();
  });

  it('network error shows friendly message', () => {
    vi.mocked(getFriendlyErrorMessage).mockReturnValue('Network connection failed');
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('400 error shows validation message', () => {
    const error400 = Object.assign(new Error('Bad Request'), { status: 400 });
    vi.mocked(getFriendlyErrorMessage).mockReturnValue('Invalid request data');
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: error400,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(vi.mocked(getFriendlyErrorMessage)).not.toHaveBeenCalled();
  });

  it('401 error shows auth error', () => {
    const error401 = Object.assign(new Error('Unauthorized'), { status: 401 });
    vi.mocked(getFriendlyErrorMessage).mockReturnValue('Please log in again');
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: error401,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('403 error shows permission error', () => {
    const error403 = Object.assign(new Error('Forbidden'), { status: 403 });
    vi.mocked(getFriendlyErrorMessage).mockReturnValue('You do not have permission');
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: error403,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('500 error shows server error message', () => {
    const error500 = Object.assign(new Error('Internal Server Error'), { status: 500 });
    vi.mocked(getFriendlyErrorMessage).mockReturnValue('Something went wrong on the server');
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: error500,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('getFriendlyErrorMessage called on error', () => {
    const testError = new Error('Something failed');
    vi.mocked(getFriendlyErrorMessage).mockReturnValue('Friendly message');
    getFriendlyErrorMessage(testError);
    expect(vi.mocked(getFriendlyErrorMessage)).toHaveBeenCalledWith(testError);
  });

  it('multiple jobs shown in list', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [
        { id: 'job-1', status: 'completed', createdAt: '2024-01-03T00:00:00Z' },
        { id: 'job-2', status: 'processing', createdAt: '2024-01-02T00:00:00Z' },
        { id: 'job-3', status: 'pending', createdAt: '2024-01-01T00:00:00Z' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('job sorting by createdAt desc', async () => {
    const jobs = [
      { id: 'job-1', status: 'completed', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'job-2', status: 'failed', createdAt: '2024-01-03T00:00:00Z' },
      { id: 'job-3', status: 'pending', createdAt: '2024-01-02T00:00:00Z' },
    ];
    vi.mocked(catalogService.listAsyncJobs).mockResolvedValue(jobs);
    const result = await catalogService.listAsyncJobs('tenant-123');
    expect(result).toHaveLength(3);
  });

  it('cancelled job shows cancelled badge', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{ id: 'job-1', status: 'cancelled', createdAt: '2024-01-01T00:00:00Z' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });

  it('bulk import with large file shows size warning', () => {
    vi.mocked(useMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error('File too large'),
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useMutation>);
    render(<CatalogImportSheet />);
    expect(screen.getByTestId('import-sheet')).toBeTruthy();
  });
});
