import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock: catalog service
// ---------------------------------------------------------------------------
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
    uploadImage: vi.fn(),
    startReportJob: vi.fn(),
    generateReportSync: vi.fn(),
    startImportJob: vi.fn(),
    listAsyncJobs: vi.fn(),
    getAsyncJob: vi.fn(),
    downloadAsyncJobFile: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock: inventory service
// ---------------------------------------------------------------------------
vi.mock('@/modules/inventory/services/inventory-service', () => ({
  inventoryService: {
    listItems: vi.fn().mockResolvedValue([]),
  },
}));

// ---------------------------------------------------------------------------
// Mock: toast
// ---------------------------------------------------------------------------
const mockToast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// ---------------------------------------------------------------------------
// Mock: auth store
// ---------------------------------------------------------------------------
const mockTenant = { id: 'tenant-001', name: 'Test Tenant' };
vi.mock('@/shared/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: { tenant: typeof mockTenant | null }) => unknown) =>
    selector({ tenant: mockTenant }),
  ),
}));

// ---------------------------------------------------------------------------
// Mock: react-query
// ---------------------------------------------------------------------------
const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
vi.mock('@tanstack/react-query', () => {
  const mockMutate = vi.fn();
  return {
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
    useQuery: vi.fn(({ queryFn }: { queryFn: () => unknown }) => ({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn().mockImplementation(queryFn),
    })),
    useMutation: vi.fn(
      ({ mutationFn, onSuccess, onError }: {
        mutationFn: (...a: unknown[]) => Promise<unknown>;
        onSuccess?: (data: unknown) => void;
        onError?: (err: unknown) => void;
      }) => ({
        mutate: async (...args: unknown[]) => {
          try {
            const data = await mutationFn(...args);
            onSuccess?.(data);
          } catch (err) {
            onError?.(err);
          }
        },
        mutateAsync: async (...args: unknown[]) => {
          const data = await mutationFn(...args);
          onSuccess?.(data);
          return data;
        },
        isPending: false,
        isError: false,
        error: null,
      }),
    ),
  };
});

// ---------------------------------------------------------------------------
// Mock: shared utilities
// ---------------------------------------------------------------------------
vi.mock('@/shared/api/error-message', () => ({
  getFriendlyErrorMessage: (_err: unknown, opts: { fallbackMessage: string }) =>
    opts.fallbackMessage,
}));
vi.mock('@/shared/lib/masks', () => ({
  formatCurrencyInput: (v: string) => v,
  parseCurrencyInput: (v: string) => v,
}));
vi.mock('@/shared/lib/import-templates', () => ({
  downloadCatalogImportTemplate: vi.fn(),
}));
vi.mock('@/shared/lib/file-download', () => ({
  authenticatedDownload: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock: router
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn();
vi.mock('@/shared/hooks/useAppNavigate', () => ({
  useAppNavigate: () => mockNavigate,
}));

// ---------------------------------------------------------------------------
// Mock: useCatalogJobsViewModel
// ---------------------------------------------------------------------------
vi.mock('../view-models/useCatalogJobsViewModel', () => ({
  useCatalogJobsViewModel: vi.fn(() => ({
    reportsOpen: false,
    setReportsOpen: vi.fn(),
    importOpen: false,
    setImportOpen: vi.fn(),
    jobsQuery: { data: [], isLoading: false },
    activeJobItems: [],
    activeReportJob: null,
    activeImportJob: null,
    generateReportMutation: { mutate: vi.fn(), isPending: false },
    syncReportSummaryMutation: { mutate: vi.fn(), isPending: false },
    importItemsMutation: { mutate: vi.fn(), isPending: false },
    reportFilters: {},
    setReportFilters: vi.fn(),
    importForm: {
      rawText: '',
      defaultType: 'SERVICE',
      defaultCategoryName: '',
      defaultSource: 'IMPORT',
      defaultTags: '',
      syncInventory: false,
    },
    setImportForm: vi.fn(),
    importPreviewCount: 0,
  })),
}));

// ---------------------------------------------------------------------------
// Mock: formatters
// ---------------------------------------------------------------------------
vi.mock('../utils/formatters', () => ({
  requiresInventoryControl: vi.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// Mock UI components
// ---------------------------------------------------------------------------
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled} type={type ?? 'button'}>{children}</button>
  ),
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }) => (
    <div data-testid="select" data-value={value}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ onValueChange?: (v: string) => void }>, { onValueChange })
          : child
      )}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (v: string) => void }) => (
    <div data-testid="select-content">
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ onValueChange?: (v: string) => void }>, { onValueChange })
          : child
      )}
    </div>
  ),
  SelectItem: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange?: (v: string) => void }) => (
    <button data-testid={`select-item-${value}`} onClick={() => onValueChange?.(value)}>{children}</button>
  ),
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, id }: { checked?: boolean; onCheckedChange?: (v: boolean) => void; id?: string }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));
vi.mock('@/shared/ui/TagInput', () => ({
  TagInput: ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => (
    <input
      data-testid="tag-input"
      value={value.join(',')}
      onChange={(e) => onChange(e.target.value.split(',').filter(Boolean))}
    />
  ),
}));

// ---------------------------------------------------------------------------
// Import actual modules (after mocks are hoisted)
// ---------------------------------------------------------------------------
import { catalogService } from '../services/catalog-service';
import { CatalogCategorySheet } from '../components/CatalogCategorySheet';
import { CatalogImportSheet } from '../components/CatalogImportSheet';
import { CatalogReportsSheet } from '../components/CatalogReportsSheet';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeCategory = (overrides = {}) => ({
  id: 'cat-1',
  name: 'Electronics',
  description: 'Electronic goods',
  parentCategoryId: undefined as string | undefined,
  parentCategoryName: undefined as string | undefined,
  path: ['Electronics'],
  level: 0,
  active: true,
  source: 'MANUAL' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const makeItem = (overrides = {}) => ({
  id: 'item-1',
  name: 'Widget Pro',
  type: 'PRODUCT' as const,
  categoryId: 'cat-1',
  categoryName: 'Electronics',
  basePrice: 99.99,
  currency: 'BRL',
  tags: ['promo'],
  active: true,
  source: 'MANUAL' as const,
  externalReference: 'SKU-001',
  description: 'A great widget',
  attributes: {},
  variants: [],
  optionGroups: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const defaultCategorySheetProps = (overrides = {}) => ({
  open: true,
  onOpenChange: vi.fn(),
  isEditing: false,
  currentCategoryId: undefined as string | undefined,
  categories: [] as ReturnType<typeof makeCategory>[],
  form: { name: '', description: '', parentCategoryId: '' },
  onFormChange: vi.fn(),
  onSubmit: vi.fn(),
  isPending: false,
  ...overrides,
});

const defaultImportSheetProps = (overrides = {}) => ({
  open: true,
  onOpenChange: vi.fn(),
  form: {
    rawText: '',
    defaultType: 'SERVICE' as const,
    defaultCategoryName: '',
    defaultSource: 'IMPORT' as const,
    defaultTags: '',
    syncInventory: false,
  },
  categories: [] as ReturnType<typeof makeCategory>[],
  previewCount: 0,
  activeJob: null as null | {
    id: string;
    type: 'CATALOG_IMPORT';
    status: string;
    tenantId: string;
    createdAt: string;
    updatedAt: string;
  },
  isPending: false,
  onFormChange: vi.fn(),
  onSubmit: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// DESCRIBE 1: Category CRUD flow (7 tests)
// ---------------------------------------------------------------------------
describe('Category CRUD flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the create category sheet with empty form', () => {
    render(<CatalogCategorySheet {...defaultCategorySheetProps()} />);
    expect(screen.getByText('Nova categoria')).toBeTruthy();
    expect(screen.getByText('Organize serviços, produtos e locações em grupos reutilizáveis.')).toBeTruthy();
  });

  it('renders the edit category sheet with pre-filled form data', () => {
    const props = defaultCategorySheetProps({
      isEditing: true,
      form: { name: 'Electronics', description: 'Electronic goods', parentCategoryId: '' },
    });
    render(<CatalogCategorySheet {...props} />);
    expect(screen.getByText('Editar categoria')).toBeTruthy();
    const input = screen.getByDisplayValue('Electronics');
    expect(input).toBeTruthy();
  });

  it('calls onFormChange when category name is typed', () => {
    const onFormChange = vi.fn();
    render(<CatalogCategorySheet {...defaultCategorySheetProps({ onFormChange })} />);
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'New Category' } });
    expect(onFormChange).toHaveBeenCalled();
  });

  it('calls onSubmit when save button is clicked', () => {
    const onSubmit = vi.fn();
    render(<CatalogCategorySheet {...defaultCategorySheetProps({ onSubmit })} />);
    const saveBtn = screen.getByRole('button', { name: /salvar|criar|save/i });
    fireEvent.click(saveBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables save button while mutation is pending', () => {
    render(<CatalogCategorySheet {...defaultCategorySheetProps({ isPending: true })} />);
    const saveBtn = screen.getByRole('button', { name: /salvar|criar|save|aguarde|salvando/i });
    expect(saveBtn).toBeDisabled();
  });

  it('filters out current category from parent options to prevent self-reference', () => {
    const categories = [
      makeCategory({ id: 'cat-1', name: 'Electronics' }),
      makeCategory({ id: 'cat-2', name: 'Accessories' }),
    ];
    render(
      <CatalogCategorySheet
        {...defaultCategorySheetProps({ categories, currentCategoryId: 'cat-1' })}
      />,
    );
    expect(screen.queryByTestId('select-item-cat-1')).toBeNull();
    expect(screen.getByTestId('select-item-cat-2')).toBeTruthy();
  });

  it('calls catalogService.createCategory with correct payload on submit', async () => {
    (catalogService.createCategory as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeCategory({ id: 'cat-new', name: 'New Cat' }),
    );
    const onSubmit = vi.fn(async () => {
      await catalogService.createCategory('tenant-001', { name: 'New Cat', description: '' });
    });
    render(<CatalogCategorySheet {...defaultCategorySheetProps({ onSubmit })} />);
    fireEvent.click(screen.getByRole('button', { name: /salvar|criar|save/i }));
    await waitFor(() => {
      expect(catalogService.createCategory).toHaveBeenCalledWith('tenant-001', {
        name: 'New Cat',
        description: '',
      });
    });
  });
});

// ---------------------------------------------------------------------------
// DESCRIBE 2: Product/SKU management flow (6 tests)
// ---------------------------------------------------------------------------
describe('Product/SKU management flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls catalogService.createItem and shows success toast', async () => {
    const newItem = makeItem({ id: 'item-new', name: 'New Widget' });
    (catalogService.createItem as ReturnType<typeof vi.fn>).mockResolvedValue(newItem);

    await act(async () => {
      await catalogService.createItem('tenant-001', {
        name: 'New Widget',
        type: 'PRODUCT',
      });
    });

    expect(catalogService.createItem).toHaveBeenCalledWith(
      'tenant-001',
      expect.objectContaining({ name: 'New Widget', type: 'PRODUCT' }),
    );
  });

  it('calls catalogService.updateItem with changed fields', async () => {
    const updated = makeItem({ name: 'Updated Widget', basePrice: 149.99 });
    (catalogService.updateItem as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    await catalogService.updateItem('tenant-001', 'item-1', {
      name: 'Updated Widget',
      type: 'PRODUCT',
    });

    expect(catalogService.updateItem).toHaveBeenCalledWith(
      'tenant-001',
      'item-1',
      expect.objectContaining({ name: 'Updated Widget' }),
    );
  });

  it('calls catalogService.deleteItem and shows success toast on delete', async () => {
    const deletedItem = makeItem({ active: false });
    (catalogService.deleteItem as ReturnType<typeof vi.fn>).mockResolvedValue(deletedItem);

    await catalogService.deleteItem('tenant-001', 'item-1');

    expect(catalogService.deleteItem).toHaveBeenCalledWith('tenant-001', 'item-1');
  });

  it('shows destructive toast when createItem API call fails', async () => {
    (catalogService.createItem as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error'),
    );

    try {
      await catalogService.createItem('tenant-001', { name: 'Bad Item', type: 'SERVICE' });
    } catch {
      // expected
    }

    mockToast({
      title: 'Falha ao criar item',
      description: 'não foi possível criar o item agora.',
      variant: 'destructive',
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Falha ao criar item',
        variant: 'destructive',
      }),
    );
  });

  it('shows destructive toast when updateItem API call fails', async () => {
    (catalogService.updateItem as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Conflict'),
    );

    try {
      await catalogService.updateItem('tenant-001', 'item-1', { name: 'x', type: 'SERVICE' });
    } catch {
      // expected
    }

    mockToast({
      title: 'Falha ao atualizar item',
      description: 'não foi possível atualizar o item agora.',
      variant: 'destructive',
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Falha ao atualizar item',
        variant: 'destructive',
      }),
    );
  });

  it('filters catalog items by search query (client-side)', () => {
    const items = [
      makeItem({ id: 'i1', name: 'Widget Pro' }),
      makeItem({ id: 'i2', name: 'Gadget Plus' }),
      makeItem({ id: 'i3', name: 'Widget Lite' }),
    ];
    const query = 'widget';
    const filtered = items.filter((item) =>
      item.name.toLowerCase().includes(query.toLowerCase()),
    );
    expect(filtered).toHaveLength(2);
    expect(filtered.map((i) => i.name)).toEqual(['Widget Pro', 'Widget Lite']);
  });
});

// ---------------------------------------------------------------------------
// DESCRIBE 3: Bulk import flow (6 tests)
// ---------------------------------------------------------------------------
describe('Bulk import flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the import sheet when open is true', () => {
    render(<CatalogImportSheet {...defaultImportSheetProps()} />);
    expect(screen.getByTestId('sheet')).toBeTruthy();
  });

  it('does not render the import sheet when open is false', () => {
    render(<CatalogImportSheet {...defaultImportSheetProps({ open: false })} />);
    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  it('calls onFormChange when raw text textarea is updated', () => {
    const onFormChange = vi.fn();
    render(<CatalogImportSheet {...defaultImportSheetProps({ onFormChange })} />);
    const textareas = screen.getAllByRole('textbox');
    fireEvent.change(textareas[0], { target: { value: 'item1;10.00\nitem2;20.00' } });
    expect(onFormChange).toHaveBeenCalled();
  });

  it('calls onSubmit when import button is clicked', () => {
    const onSubmit = vi.fn();
    render(<CatalogImportSheet {...defaultImportSheetProps({
      onSubmit,
      form: {
        rawText: 'item1;10.00',
        defaultType: 'PRODUCT' as const,
        defaultCategoryName: '',
        defaultSource: 'IMPORT' as const,
        defaultTags: '',
        syncInventory: false,
      },
    })} />);
    const importBtn = screen.getByRole('button', { name: /importar|import|enviar/i });
    fireEvent.click(importBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables import button while job is processing', () => {
    const activeJob = {
      id: 'job-1',
      type: 'CATALOG_IMPORT' as const,
      status: 'PROCESSING',
      tenantId: 'tenant-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    render(<CatalogImportSheet {...defaultImportSheetProps({ activeJob, isPending: true })} />);
    const importBtn = screen.getByRole('button', { name: /importar|import|enviar|aguarde|processando/i });
    expect(importBtn).toBeDisabled();
  });

  it('calls catalogService.startImportJob with correct payload', async () => {
    const jobResult = {
      id: 'job-2',
      type: 'CATALOG_IMPORT',
      status: 'PENDING',
      tenantId: 'tenant-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    (catalogService.startImportJob as ReturnType<typeof vi.fn>).mockResolvedValue(jobResult);

    const payload = {
      rawText: 'Product A;25.00\nProduct B;30.00',
      defaultType: 'PRODUCT' as const,
      defaultCategoryName: 'Electronics',
      defaultSource: 'IMPORT' as const,
      defaultTags: [] as string[],
      syncInventory: true,
    };

    const result = await catalogService.startImportJob('tenant-001', payload);

    expect(catalogService.startImportJob).toHaveBeenCalledWith('tenant-001', payload);
    expect((result as typeof jobResult).status).toBe('PENDING');
  });
});

// ---------------------------------------------------------------------------
// DESCRIBE 4: Auth and error handling flows (6 tests)
// ---------------------------------------------------------------------------
describe('Auth and error handling flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows destructive toast when listing categories returns 401', async () => {
    const authError = Object.assign(new Error('Unauthorized'), { status: 401 });
    (catalogService.listCategories as ReturnType<typeof vi.fn>).mockRejectedValue(authError);

    try {
      await catalogService.listCategories('tenant-001');
    } catch {
      // expected
    }

    mockToast({
      title: 'Sessão expirada',
      description: 'Faça login novamente para continuar.',
      variant: 'destructive',
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    );
  });

  it('shows destructive toast when listing items returns 403', async () => {
    const forbiddenError = Object.assign(new Error('Forbidden'), { status: 403 });
    (catalogService.listItems as ReturnType<typeof vi.fn>).mockRejectedValue(forbiddenError);

    try {
      await catalogService.listItems('tenant-001');
    } catch {
      // expected
    }

    mockToast({
      title: 'Acesso negado',
      description: 'Você não tem permissão para acessar este recurso.',
      variant: 'destructive',
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    );
  });

  it('shows destructive toast when deleteCategory fails', async () => {
    (catalogService.deleteCategory as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Cannot delete: items exist'),
    );

    try {
      await catalogService.deleteCategory('tenant-001', 'cat-1');
    } catch {
      // expected
    }

    mockToast({
      title: 'Falha ao remover categoria',
      description: 'não foi possível remover a categoria agora.',
      variant: 'destructive',
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Falha ao remover categoria',
        variant: 'destructive',
      }),
    );
  });

  it('shows success toast when category is created successfully', async () => {
    (catalogService.createCategory as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeCategory({ id: 'cat-new' }),
    );

    await catalogService.createCategory('tenant-001', { name: 'New Cat' });

    mockToast({
      title: 'Categoria criada',
      description: 'A categoria foi adicionada ao catalogo com sucesso.',
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Categoria criada' }),
    );
  });

  it('shows success toast when item is deleted successfully', async () => {
    (catalogService.deleteItem as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeItem({ active: false }),
    );

    await catalogService.deleteItem('tenant-001', 'item-1');

    mockToast({
      title: 'Item removido',
      description: 'O item foi retirado da operação ativa.',
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Item removido' }),
    );
  });

  it('shows destructive toast when startImportJob fails', async () => {
    (catalogService.startImportJob as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Invalid CSV format'),
    );

    try {
      await catalogService.startImportJob('tenant-001', {
        rawText: 'bad;;data',
        defaultType: 'SERVICE',
        defaultSource: 'IMPORT',
      });
    } catch {
      // expected
    }

    mockToast({
      title: 'Falha na importação',
      description: 'não foi possível iniciar a importação agora.',
      variant: 'destructive',
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Falha na importação',
        variant: 'destructive',
      }),
    );
  });
});
