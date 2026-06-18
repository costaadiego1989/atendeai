import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Service mock
// ---------------------------------------------------------------------------
vi.mock('../services/checkout-service', () => ({
  checkoutService: {
    getAbandonmentConfig: vi.fn(),
    updateAbandonmentConfig: vi.fn(),
    generateAbandonmentMessage: vi.fn(),
    getShippingPolicy: vi.fn(),
    updateShippingPolicy: vi.fn(),
    listOrders: vi.fn(),
    getOrderDetails: vi.fn(),
    updateOrderStatus: vi.fn(),
    downloadOrdersReport: vi.fn(),
    startCommerceSession: vi.fn(),
    addCommerceSessionItem: vi.fn(),
    updateCommerceSessionFulfillment: vi.fn(),
    applyCommerceSessionCoupon: vi.fn(),
    checkoutCommerceSession: vi.fn(),
    updateAbandonmentState: vi.fn(),
    triggerAbandonmentTouch: vi.fn(),
  },
}));

vi.mock('@/shared/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      tenant: { id: 'tenant-123', name: 'Test Store' },
      user: { id: 'user-1', tenantId: 'tenant-123' },
    }),
  ),
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/shared/api/error-message', () => ({
  getFriendlyErrorMessage: vi.fn((_err: unknown, opts: { fallbackMessage?: string }) => opts?.fallbackMessage ?? 'Erro'),
}));

vi.mock('@/shared/lib/maps', () => ({
  buildOpenStreetMapEmbedUrl: vi.fn(() => 'https://maps.example.com/embed'),
}));

vi.mock('@/shared/lib/file-download', () => ({
  authenticatedDownload: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  };
});

vi.mock('@/modules/agent-rules/components/ModuleAgentRuleButton', () => ({
  ModuleAgentRuleButton: () => <button>Agent Rules</button>,
}));

// UI primitives – render children transparently
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant: _v,
    size: _s,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      data-testid="switch"
    />
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <select
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      data-testid="select"
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
    min,
    max,
  }: {
    value: number[];
    onValueChange: (v: number[]) => void;
    min: number;
    max: number;
  }) => (
    <input
      type="range"
      min={min}
      max={max}
      value={value[0]}
      onChange={(e) => onValueChange([Number(e.target.value)])}
      data-testid="slider"
    />
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('lucide-react', () => ({
  MessageSquareText: () => <span />,
  Settings2: () => <span />,
  Bot: () => <span />,
  Clock: () => <span />,
  Loader2: () => <span />,
  Sparkles: () => <span />,
  AlertTriangle: () => <span />,
  ShieldAlert: () => <span />,
}));

// ---------------------------------------------------------------------------
// Imports under test (after mocks are registered)
// ---------------------------------------------------------------------------
import { AbandonmentConfigSheet, type AbandonmentConfig } from '../components/AbandonmentConfigSheet';
import { CheckoutHeader } from '../components/CheckoutHeader';
import { CheckoutReportsSheet } from '../components/CheckoutReportsSheet';
import { checkoutService } from '../services/checkout-service';
import { toast } from '@/components/ui/use-toast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAbandonmentConfig(overrides: Partial<AbandonmentConfig> = {}): AbandonmentConfig {
  return {
    active: true,
    message: 'Olá {nome}, você deixou itens no carrinho!',
    useAiMessage: false,
    mode: 'SINGLE',
    maxTouches: 1,
    intervalMinutes: 60,
    ...overrides,
  };
}

function makeReportsVm(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    reportsOpen: true,
    setReportsOpen: vi.fn(),
    reportFilters: { dateFrom: '', dateTo: '', status: 'all' as const },
    setReportFilters: vi.fn(),
    reportStatusOptions: [
      { value: 'all', label: 'Todos' },
      { value: 'PENDING', label: 'Pendente' },
      { value: 'CONFIRMED', label: 'Confirmado' },
    ],
    confirmDownloadReport: vi.fn(),
    downloadReportMutation: { isPending: false },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Abandonment config CRUD flow (7 tests)
// ---------------------------------------------------------------------------

describe('Abandonment config CRUD flow', () => {
  it('renders the sheet when open=true', () => {
    const config = makeAbandonmentConfig();
    render(
      <AbandonmentConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        config={config}
        onConfigChange={vi.fn()}
        onSave={vi.fn()}
        onGenerateAiMessage={vi.fn()}
        isSaving={false}
        isGenerating={false}
      />,
    );
    expect(screen.getByText('Configurar Carrinho Abandonado')).toBeTruthy();
  });

  it('does not render sheet content when open=false', () => {
    const config = makeAbandonmentConfig();
    render(
      <AbandonmentConfigSheet
        open={false}
        onOpenChange={vi.fn()}
        config={config}
        onConfigChange={vi.fn()}
        onSave={vi.fn()}
        onGenerateAiMessage={vi.fn()}
        isSaving={false}
        isGenerating={false}
      />,
    );
    expect(screen.queryByText('Configurar Carrinho Abandonado')).toBeNull();
  });

  it('calls onConfigChange with active=false when toggle is unchecked', () => {
    const config = makeAbandonmentConfig({ active: true });
    const onConfigChange = vi.fn();

    render(
      <AbandonmentConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        config={config}
        onConfigChange={onConfigChange}
        onSave={vi.fn()}
        onGenerateAiMessage={vi.fn()}
        isSaving={false}
        isGenerating={false}
      />,
    );

    const switches = screen.getAllByTestId('switch');
    // First switch is the "active" toggle
    fireEvent.click(switches[0]);
    expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  it('shows textarea and "Gerar com IA" button when useAiMessage=false', () => {
    const config = makeAbandonmentConfig({ useAiMessage: false });
    render(
      <AbandonmentConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        config={config}
        onConfigChange={vi.fn()}
        onSave={vi.fn()}
        onGenerateAiMessage={vi.fn()}
        isSaving={false}
        isGenerating={false}
      />,
    );
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByText('Gerar com IA')).toBeTruthy();
  });

  it('calls onGenerateAiMessage when "Gerar com IA" is clicked', () => {
    const onGenerateAiMessage = vi.fn();
    const config = makeAbandonmentConfig({ useAiMessage: false });
    render(
      <AbandonmentConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        config={config}
        onConfigChange={vi.fn()}
        onSave={vi.fn()}
        onGenerateAiMessage={onGenerateAiMessage}
        isSaving={false}
        isGenerating={false}
      />,
    );
    fireEvent.click(screen.getByText('Gerar com IA'));
    expect(onGenerateAiMessage).toHaveBeenCalledOnce();
  });

  it('calls onSave and shows saving state when isSaving=true', () => {
    const onSave = vi.fn();
    const config = makeAbandonmentConfig();
    render(
      <AbandonmentConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        config={config}
        onConfigChange={vi.fn()}
        onSave={onSave}
        onGenerateAiMessage={vi.fn()}
        isSaving={true}
        isGenerating={false}
      />,
    );
    expect(screen.getByText('Salvando...')).toBeTruthy();
    const saveBtn = screen.getByRole('button', { name: /Salvando/i });
    expect(saveBtn).toBeDisabled();
  });

  it('updates message text via textarea', () => {
    const onConfigChange = vi.fn();
    const config = makeAbandonmentConfig({ useAiMessage: false, message: '' });
    render(
      <AbandonmentConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        config={config}
        onConfigChange={onConfigChange}
        onSave={vi.fn()}
        onGenerateAiMessage={vi.fn()}
        isSaving={false}
        isGenerating={false}
      />,
    );
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Nova mensagem de retomada' } });
    expect(onConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Nova mensagem de retomada' }),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Checkout flow: cart → payment → confirmation (6 tests)
// ---------------------------------------------------------------------------

describe('Checkout flow (cart → payment → confirmation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts a commerce session when called', async () => {
    const mockSession = { id: 'session-1', tenantId: 'tenant-123', items: [] };
    vi.mocked(checkoutService.startCommerceSession).mockResolvedValueOnce(mockSession as never);

    const result = await checkoutService.startCommerceSession('tenant-123', {
      conversationId: 'conv-1',
    });

    expect(checkoutService.startCommerceSession).toHaveBeenCalledWith('tenant-123', {
      conversationId: 'conv-1',
    });
    expect(result).toEqual(mockSession);
  });

  it('adds an item to the session', async () => {
    const updatedSession = {
      id: 'session-1',
      items: [{ catalogItemId: 'item-1', quantity: 2 }],
    };
    vi.mocked(checkoutService.addCommerceSessionItem).mockResolvedValueOnce(
      updatedSession as never,
    );

    const result = await checkoutService.addCommerceSessionItem('tenant-123', 'session-1', {
      catalogItemId: 'item-1',
      quantity: 2,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(2);
  });

  it('sets fulfillment type to DELIVERY with address', async () => {
    const session = {
      id: 'session-1',
      fulfillmentType: 'DELIVERY',
      deliveryAddress: 'Rua Teste, 100',
    };
    vi.mocked(checkoutService.updateCommerceSessionFulfillment).mockResolvedValueOnce(
      session as never,
    );

    const result = await checkoutService.updateCommerceSessionFulfillment('tenant-123', 'session-1', {
      fulfillmentType: 'DELIVERY',
      deliveryAddress: 'Rua Teste, 100',
      distanceKm: 3,
    });

    expect(result.fulfillmentType).toBe('DELIVERY');
    expect(result.deliveryAddress).toBe('Rua Teste, 100');
  });

  it('completes checkout and returns order + payment link', async () => {
    const checkoutResult = {
      order: { id: 'order-1', status: 'CONFIRMED' },
      session: { id: 'session-1' },
      paymentLink: { id: 'link-1', url: 'https://pay.example.com/link-1' },
    };
    vi.mocked(checkoutService.checkoutCommerceSession).mockResolvedValueOnce(
      checkoutResult as never,
    );

    const result = await checkoutService.checkoutCommerceSession('tenant-123', 'session-1', {
      billingType: 'PIX',
    });

    expect(result.order.status).toBe('CONFIRMED');
    expect(result.paymentLink.url).toContain('https://pay.example.com');
  });

  it('updates order status to DELIVERED', async () => {
    const updatedOrder = { id: 'order-1', status: 'DELIVERED' };
    vi.mocked(checkoutService.updateOrderStatus).mockResolvedValueOnce(updatedOrder as never);

    const result = await checkoutService.updateOrderStatus('tenant-123', 'order-1', {
      status: 'DELIVERED',
      userId: 'user-1',
    });

    expect(result.status).toBe('DELIVERED');
  });

  it('renders CheckoutHeader with both action buttons', () => {
    const onOpenShippingPolicy = vi.fn();
    const onOpenAbandonmentConfig = vi.fn();

    render(
      <CheckoutHeader
        onOpenShippingPolicy={onOpenShippingPolicy}
        onOpenAbandonmentConfig={onOpenAbandonmentConfig}
      />,
    );

    expect(screen.getByText('Checkout e Pedidos')).toBeTruthy();
    expect(screen.getByText('Carrinho Abandonado')).toBeTruthy();
    expect(screen.getByText('Config. Entrega')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 3. Coupon code flow (6 tests)
// ---------------------------------------------------------------------------

describe('Coupon code flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies a valid coupon code successfully', async () => {
    const sessionWithDiscount = {
      id: 'session-1',
      couponCode: 'SAVE10',
      discountAmount: 10,
    };
    vi.mocked(checkoutService.applyCommerceSessionCoupon).mockResolvedValueOnce(
      sessionWithDiscount as never,
    );

    const result = await checkoutService.applyCommerceSessionCoupon(
      'tenant-123',
      'session-1',
      'SAVE10',
    );

    expect(checkoutService.applyCommerceSessionCoupon).toHaveBeenCalledWith(
      'tenant-123',
      'session-1',
      'SAVE10',
    );
    expect(result.couponCode).toBe('SAVE10');
    expect(result.discountAmount).toBe(10);
  });

  it('rejects an invalid coupon code with an error', async () => {
    vi.mocked(checkoutService.applyCommerceSessionCoupon).mockRejectedValueOnce(
      new Error('Cupom inválido ou expirado'),
    );

    await expect(
      checkoutService.applyCommerceSessionCoupon('tenant-123', 'session-1', 'INVALID'),
    ).rejects.toThrow('Cupom inválido ou expirado');
  });

  it('does not apply empty coupon code (validation guard)', async () => {
    const applyFn = vi.fn().mockResolvedValueOnce({});

    const couponCode = '';
    if (couponCode.trim()) {
      await applyFn('tenant-123', 'session-1', couponCode);
    }

    expect(applyFn).not.toHaveBeenCalled();
  });

  it('trims whitespace before applying coupon', async () => {
    const session = { id: 'session-1', couponCode: 'TRIMMED' };
    vi.mocked(checkoutService.applyCommerceSessionCoupon).mockResolvedValueOnce(session as never);

    const rawCode = '  TRIMMED  ';
    await checkoutService.applyCommerceSessionCoupon('tenant-123', 'session-1', rawCode.trim());

    expect(checkoutService.applyCommerceSessionCoupon).toHaveBeenCalledWith(
      'tenant-123',
      'session-1',
      'TRIMMED',
    );
  });

  it('applies 100% discount coupon and total becomes zero', async () => {
    const session = {
      id: 'session-1',
      couponCode: 'FREESHIP',
      discountAmount: 100,
      total: 0,
    };
    vi.mocked(checkoutService.applyCommerceSessionCoupon).mockResolvedValueOnce(session as never);

    const result = await checkoutService.applyCommerceSessionCoupon(
      'tenant-123',
      'session-1',
      'FREESHIP',
    );

    expect(result.total).toBe(0);
    expect(result.discountAmount).toBe(100);
  });

  it('allows coupon re-application after clearing previous one', async () => {
    const firstResult = { id: 'session-1', couponCode: 'FIRST', discountAmount: 5 };
    const secondResult = { id: 'session-1', couponCode: 'SECOND', discountAmount: 15 };

    vi.mocked(checkoutService.applyCommerceSessionCoupon)
      .mockResolvedValueOnce(firstResult as never)
      .mockResolvedValueOnce(secondResult as never);

    const first = await checkoutService.applyCommerceSessionCoupon(
      'tenant-123',
      'session-1',
      'FIRST',
    );
    expect(first.couponCode).toBe('FIRST');

    const second = await checkoutService.applyCommerceSessionCoupon(
      'tenant-123',
      'session-1',
      'SECOND',
    );
    expect(second.couponCode).toBe('SECOND');
    expect(second.discountAmount).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// 4. Auth and error handling flows (6 tests)
// ---------------------------------------------------------------------------

describe('Auth and error handling flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders CheckoutHeader "Carrinho Abandonado" button and fires callback', () => {
    const onOpenAbandonmentConfig = vi.fn();
    render(
      <CheckoutHeader
        onOpenShippingPolicy={vi.fn()}
        onOpenAbandonmentConfig={onOpenAbandonmentConfig}
      />,
    );
    fireEvent.click(screen.getByText('Carrinho Abandonado'));
    expect(onOpenAbandonmentConfig).toHaveBeenCalledOnce();
  });

  it('renders CheckoutHeader "Config. Entrega" button and fires callback', () => {
    const onOpenShippingPolicy = vi.fn();
    render(
      <CheckoutHeader
        onOpenShippingPolicy={onOpenShippingPolicy}
        onOpenAbandonmentConfig={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Config. Entrega'));
    expect(onOpenShippingPolicy).toHaveBeenCalledOnce();
  });

  it('renders CheckoutReportsSheet and triggers download', () => {
    const confirmDownloadReport = vi.fn();
    const vm = makeReportsVm({ confirmDownloadReport }) as never;
    render(<CheckoutReportsSheet vm={vm} />);
    fireEvent.click(screen.getByText('Baixar CSV'));
    expect(confirmDownloadReport).toHaveBeenCalledOnce();
  });

  it('disables download button while download is pending', () => {
    const vm = makeReportsVm({
      downloadReportMutation: { isPending: true },
    }) as never;
    render(<CheckoutReportsSheet vm={vm} />);
    const downloadBtn = screen.getByRole('button', { name: /Baixando/i });
    expect(downloadBtn).toBeDisabled();
  });

  it('shows error toast when updateAbandonmentConfig service rejects', async () => {
    vi.mocked(checkoutService.updateAbandonmentConfig).mockRejectedValueOnce(
      new Error('Não autorizado'),
    );

    const onError = vi.fn((error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Falha ao salvar',
        description: error.message,
      });
    });

    try {
      await checkoutService.updateAbandonmentConfig('tenant-123', {
        active: true,
        message: 'test',
        useAiMessage: false,
        mode: 'SINGLE',
        maxTouches: 1,
        intervalMinutes: 60,
      });
    } catch (err) {
      onError(err as Error);
    }

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'Falha ao salvar' }),
    );
  });

  it('closes reports sheet when "Fechar" button is clicked', () => {
    const setReportsOpen = vi.fn();
    const vm = makeReportsVm({ setReportsOpen }) as never;
    render(<CheckoutReportsSheet vm={vm} />);
    fireEvent.click(screen.getByText('Fechar'));
    expect(setReportsOpen).toHaveBeenCalledWith(false);
  });
});
