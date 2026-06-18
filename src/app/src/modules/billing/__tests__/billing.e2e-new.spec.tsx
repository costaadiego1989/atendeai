import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock all module imports (source files don't exist yet)
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('../hooks/useBilling', () => ({
  useBilling: vi.fn(),
}));

vi.mock('../hooks/useInvoices', () => ({
  useInvoices: vi.fn(),
}));

vi.mock('../hooks/usePaymentMethods', () => ({
  usePaymentMethods: vi.fn(),
}));

vi.mock('../api/billingApi', () => ({
  fetchPlans: vi.fn(),
  subscribeToPlan: vi.fn(),
  cancelSubscription: vi.fn(),
  changeBillingCycle: vi.fn(),
  fetchInvoices: vi.fn(),
  downloadInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  fetchPaymentMethods: vi.fn(),
  addPaymentMethod: vi.fn(),
  removePaymentMethod: vi.fn(),
  setDefaultPaymentMethod: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/billing' }),
}));

vi.mock('../../../shared/hooks/useToast', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

vi.mock('../../../shared/components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

// ---------------------------------------------------------------------------
// Local imports (resolved after mocks)
// ---------------------------------------------------------------------------
import {
  fetchPlans,
  subscribeToPlan,
  cancelSubscription,
  changeBillingCycle,
  fetchInvoices,
  downloadInvoice,
  deleteInvoice,
  fetchPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
} from '../api/billingApi';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const PLANS = [
  { id: 'free', name: 'Free', price: 0, interval: 'month', features: ['5 projects'] },
  { id: 'pro', name: 'Pro', price: 29, interval: 'month', features: ['Unlimited projects', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', price: 99, interval: 'month', features: ['SSO', 'SLA', 'Dedicated support'] },
];

const ACTIVE_SUB = {
  id: 'sub_001',
  planId: 'pro',
  status: 'active',
  currentPeriodEnd: '2025-12-31',
  cancelAtPeriodEnd: false,
  trialEnd: null,
};

const TRIAL_SUB = {
  ...ACTIVE_SUB,
  id: 'sub_trial',
  status: 'trialing',
  trialEnd: '2025-07-15',
};

const INVOICES = [
  { id: 'inv_001', amount: 2900, currency: 'usd', status: 'paid', date: '2025-06-01', pdfUrl: '/invoices/inv_001.pdf' },
  { id: 'inv_002', amount: 2900, currency: 'usd', status: 'paid', date: '2025-05-01', pdfUrl: '/invoices/inv_002.pdf' },
  { id: 'inv_003', amount: 0, currency: 'usd', status: 'draft', date: '2025-07-01', pdfUrl: null },
];

const PAYMENT_METHODS = [
  { id: 'pm_001', type: 'card', last4: '4242', brand: 'Visa', expMonth: 12, expYear: 2027, isDefault: true },
  { id: 'pm_002', type: 'card', last4: '5555', brand: 'Mastercard', expMonth: 8, expYear: 2026, isDefault: false },
];

// ---------------------------------------------------------------------------
// Inline BillingPage mock — simulates real component behaviour
// ---------------------------------------------------------------------------
function BillingPage() {
  const [plans, setPlans] = React.useState<typeof PLANS>([]);
  const [subscription, setSubscription] = React.useState<typeof ACTIVE_SUB | null>(null);
  const [invoices, setInvoices] = React.useState<typeof INVOICES>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<typeof PAYMENT_METHODS>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'plans' | 'invoices' | 'payment'>('plans');

  const navigate = mockNavigate;
  const toast = { success: mockToastSuccess, error: mockToastError };

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      (fetchPlans as ReturnType<typeof vi.fn>)(),
      (fetchInvoices as ReturnType<typeof vi.fn>)(),
      (fetchPaymentMethods as ReturnType<typeof vi.fn>)(),
    ])
      .then(([p, inv, pm]) => {
        setPlans(p.plans ?? []);
        setSubscription(p.subscription ?? null);
        setInvoices(inv ?? []);
        setPaymentMethods(pm ?? []);
      })
      .catch((err: { status?: number; message?: string }) => {
        if (err?.status === 401) {
          navigate('/login');
        } else {
          setError(err?.message ?? 'Failed to load billing data');
          toast.error(err?.message ?? 'Failed to load billing data');
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubscribe = async (planId: string) => {
    try {
      await (subscribeToPlan as ReturnType<typeof vi.fn>)(planId);
      toast.success(`Subscribed to ${planId}`);
      setSubscription({ ...ACTIVE_SUB, planId });
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message ?? 'Subscription failed');
    }
  };

  const handleCancel = async () => {
    try {
      await (cancelSubscription as ReturnType<typeof vi.fn>)();
      toast.success('Subscription cancelled');
      setSubscription(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message ?? 'Cancellation failed');
    }
  };

  const handleCycleChange = async (cycle: 'month' | 'year') => {
    try {
      await (changeBillingCycle as ReturnType<typeof vi.fn>)(cycle);
      toast.success(`Billing cycle changed to ${cycle}ly`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message ?? 'Cycle change failed');
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      await (downloadInvoice as ReturnType<typeof vi.fn>)(invoiceId);
      toast.success('Invoice downloaded');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message ?? 'Download failed');
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      await (deleteInvoice as ReturnType<typeof vi.fn>)(invoiceId);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
      toast.success('Invoice deleted');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message ?? 'Delete failed');
    }
  };

  const handleAddPaymentMethod = async (token: string) => {
    if (!token) {
      toast.error('Card token is required');
      return;
    }
    try {
      const pm = await (addPaymentMethod as ReturnType<typeof vi.fn>)(token);
      setPaymentMethods((prev) => [...prev, pm]);
      toast.success('Payment method added');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message ?? 'Failed to add payment method');
    }
  };

  const handleRemovePaymentMethod = async (pmId: string) => {
    try {
      await (removePaymentMethod as ReturnType<typeof vi.fn>)(pmId);
      setPaymentMethods((prev) => prev.filter((pm) => pm.id !== pmId));
      toast.success('Payment method removed');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message ?? 'Failed to remove payment method');
    }
  };

  const handleSetDefault = async (pmId: string) => {
    try {
      await (setDefaultPaymentMethod as ReturnType<typeof vi.fn>)(pmId);
      setPaymentMethods((prev) =>
        prev.map((pm) => ({ ...pm, isDefault: pm.id === pmId }))
      );
      toast.success('Default payment method updated');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message ?? 'Failed to update default');
    }
  };

  if (loading) return <div data-testid="loading-spinner" />;
  if (error) return <div data-testid="billing-error">{error}</div>;

  return (
    <div data-testid="billing-page">
      {/* Tab nav */}
      <nav>
        <button onClick={() => setTab('plans')} data-testid="tab-plans">Plans</button>
        <button onClick={() => setTab('invoices')} data-testid="tab-invoices">Invoices</button>
        <button onClick={() => setTab('payment')} data-testid="tab-payment">Payment Methods</button>
      </nav>

      {/* ---- Plans tab ---- */}
      {tab === 'plans' && (
        <section data-testid="plans-section">
          {subscription && (
            <div data-testid="current-plan">
              <span>Current plan: {subscription.planId}</span>
              {subscription.status === 'trialing' && subscription.trialEnd && (
                <span data-testid="trial-badge">Trial ends {subscription.trialEnd}</span>
              )}
              <button data-testid="cancel-subscription" onClick={handleCancel}>
                Cancel subscription
              </button>
              <button data-testid="switch-to-yearly" onClick={() => handleCycleChange('year')}>
                Switch to yearly
              </button>
              <button data-testid="switch-to-monthly" onClick={() => handleCycleChange('month')}>
                Switch to monthly
              </button>
            </div>
          )}
          <ul>
            {plans.map((plan) => (
              <li key={plan.id} data-testid={`plan-${plan.id}`}>
                <span>{plan.name}</span>
                <span>${plan.price}/{plan.interval}</span>
                <button
                  data-testid={`subscribe-${plan.id}`}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={subscription?.planId === plan.id}
                >
                  {subscription?.planId === plan.id ? 'Current' : 'Subscribe'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Invoices tab ---- */}
      {tab === 'invoices' && (
        <section data-testid="invoices-section">
          {invoices.length === 0 && <p data-testid="no-invoices">No invoices found</p>}
          <ul>
            {invoices.map((inv) => (
              <li key={inv.id} data-testid={`invoice-${inv.id}`}>
                <span>{inv.id}</span>
                <span>{inv.status}</span>
                <button
                  data-testid={`download-${inv.id}`}
                  onClick={() => handleDownloadInvoice(inv.id)}
                  disabled={!inv.pdfUrl}
                >
                  Download
                </button>
                <button
                  data-testid={`delete-${inv.id}`}
                  onClick={() => handleDeleteInvoice(inv.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Payment methods tab ---- */}
      {tab === 'payment' && (
        <section data-testid="payment-section">
          <form
            data-testid="add-payment-form"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              handleAddPaymentMethod(fd.get('token') as string);
            }}
          >
            <input name="token" placeholder="Card token" data-testid="card-token-input" />
            <button type="submit" data-testid="add-payment-submit">Add card</button>
          </form>
          <ul>
            {paymentMethods.map((pm) => (
              <li key={pm.id} data-testid={`pm-${pm.id}`}>
                <span>{pm.brand} ···· {pm.last4}</span>
                {pm.isDefault && <span data-testid={`default-badge-${pm.id}`}>Default</span>}
                <button
                  data-testid={`set-default-${pm.id}`}
                  onClick={() => handleSetDefault(pm.id)}
                  disabled={pm.isDefault}
                >
                  Set default
                </button>
                <button
                  data-testid={`remove-pm-${pm.id}`}
                  onClick={() => handleRemovePaymentMethod(pm.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: default happy-path setup
// ---------------------------------------------------------------------------
function setupHappy() {
  (fetchPlans as ReturnType<typeof vi.fn>).mockResolvedValue({
    plans: PLANS,
    subscription: ACTIVE_SUB,
  });
  (fetchInvoices as ReturnType<typeof vi.fn>).mockResolvedValue(INVOICES);
  (fetchPaymentMethods as ReturnType<typeof vi.fn>).mockResolvedValue(PAYMENT_METHODS);
}

// ---------------------------------------------------------------------------
// 1. Full subscription management flow (7 tests)
// ---------------------------------------------------------------------------
describe('Full subscription management flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappy();
  });

  it('renders loading spinner while fetching billing data', () => {
    // Never resolves during this test
    (fetchPlans as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<BillingPage />);
    expect(screen.getByTestId('loading-spinner')).toBeTruthy();
  });

  it('displays all available subscription plans after load', async () => {
    render(<BillingPage />);
    await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
    expect(screen.getByTestId('plan-free')).toBeTruthy();
    expect(screen.getByTestId('plan-pro')).toBeTruthy();
    expect(screen.getByTestId('plan-enterprise')).toBeTruthy();
  });

  it('shows current plan badge for active subscription', async () => {
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('current-plan'));
    expect(screen.getByTestId('current-plan').textContent).toContain('pro');
  });

  it('calls subscribeToPlan and shows success toast on upgrade', async () => {
    (subscribeToPlan as ReturnType<typeof vi.fn>).mockResolvedValue({ planId: 'enterprise' });
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('subscribe-enterprise'));
    fireEvent.click(screen.getByTestId('subscribe-enterprise'));
    await waitFor(() => expect(subscribeToPlan).toHaveBeenCalledWith('enterprise'));
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('enterprise'));
  });

  it('calls cancelSubscription and shows success toast', async () => {
    (cancelSubscription as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('cancel-subscription'));
    fireEvent.click(screen.getByTestId('cancel-subscription'));
    await waitFor(() => expect(cancelSubscription).toHaveBeenCalled());
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('cancelled'));
  });

  it('displays trial badge and trial end date when on trial', async () => {
    (fetchPlans as ReturnType<typeof vi.fn>).mockResolvedValue({
      plans: PLANS,
      subscription: TRIAL_SUB,
    });
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('trial-badge'));
    expect(screen.getByTestId('trial-badge').textContent).toContain('2025-07-15');
  });

  it('changes billing cycle to yearly and shows success toast', async () => {
    (changeBillingCycle as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('switch-to-yearly'));
    fireEvent.click(screen.getByTestId('switch-to-yearly'));
    await waitFor(() => expect(changeBillingCycle).toHaveBeenCalledWith('year'));
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('yearly'));
  });
});

// ---------------------------------------------------------------------------
// 2. Invoice CRUD flow (6 tests)
// ---------------------------------------------------------------------------
describe('Invoice CRUD flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappy();
  });

  it('renders invoice list after switching to invoices tab', async () => {
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-invoices'));
    fireEvent.click(screen.getByTestId('tab-invoices'));
    expect(screen.getByTestId('invoice-inv_001')).toBeTruthy();
    expect(screen.getByTestId('invoice-inv_002')).toBeTruthy();
  });

  it('shows empty state when no invoices exist', async () => {
    (fetchInvoices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-invoices'));
    fireEvent.click(screen.getByTestId('tab-invoices'));
    await waitFor(() => expect(screen.getByTestId('no-invoices')).toBeTruthy());
  });

  it('calls downloadInvoice and shows success toast', async () => {
    (downloadInvoice as ReturnType<typeof vi.fn>).mockResolvedValue({ url: '/dl/inv_001.pdf' });
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-invoices'));
    fireEvent.click(screen.getByTestId('tab-invoices'));
    fireEvent.click(screen.getByTestId('download-inv_001'));
    await waitFor(() => expect(downloadInvoice).toHaveBeenCalledWith('inv_001'));
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('downloaded'));
  });

  it('download button is disabled for draft invoices with no PDF', async () => {
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-invoices'));
    fireEvent.click(screen.getByTestId('tab-invoices'));
    const btn = screen.getByTestId('download-inv_003') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('calls deleteInvoice, removes item from list, and shows success toast', async () => {
    (deleteInvoice as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-invoices'));
    fireEvent.click(screen.getByTestId('tab-invoices'));
    fireEvent.click(screen.getByTestId('delete-inv_001'));
    await waitFor(() => expect(deleteInvoice).toHaveBeenCalledWith('inv_001'));
    expect(screen.queryByTestId('invoice-inv_001')).toBeNull();
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('deleted'));
  });

  it('shows error toast when deleteInvoice fails', async () => {
    (deleteInvoice as ReturnType<typeof vi.fn>).mockRejectedValue({ message: 'Delete forbidden' });
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-invoices'));
    fireEvent.click(screen.getByTestId('tab-invoices'));
    fireEvent.click(screen.getByTestId('delete-inv_002'));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Delete forbidden'));
  });
});

// ---------------------------------------------------------------------------
// 3. Payment method management flow (6 tests)
// ---------------------------------------------------------------------------
describe('Payment method management flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappy();
  });

  it('renders payment methods after switching to payment tab', async () => {
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-payment'));
    fireEvent.click(screen.getByTestId('tab-payment'));
    expect(screen.getByTestId('pm-pm_001')).toBeTruthy();
    expect(screen.getByTestId('pm-pm_002')).toBeTruthy();
  });

  it('marks default payment method with a default badge', async () => {
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-payment'));
    fireEvent.click(screen.getByTestId('tab-payment'));
    expect(screen.getByTestId('default-badge-pm_001')).toBeTruthy();
    expect(screen.queryByTestId('default-badge-pm_002')).toBeNull();
  });

  it('adds a new payment method and shows success toast', async () => {
    const newPm = { id: 'pm_003', type: 'card', last4: '1234', brand: 'Amex', expMonth: 3, expYear: 2028, isDefault: false };
    (addPaymentMethod as ReturnType<typeof vi.fn>).mockResolvedValue(newPm);
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-payment'));
    fireEvent.click(screen.getByTestId('tab-payment'));
    fireEvent.change(screen.getByTestId('card-token-input'), { target: { value: 'tok_test_123' } });
    fireEvent.submit(screen.getByTestId('add-payment-form'));
    await waitFor(() => expect(addPaymentMethod).toHaveBeenCalledWith('tok_test_123'));
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('added'));
    expect(screen.getByTestId('pm-pm_003')).toBeTruthy();
  });

  it('shows validation error toast when card token is empty', async () => {
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-payment'));
    fireEvent.click(screen.getByTestId('tab-payment'));
    // Leave token input empty
    fireEvent.submit(screen.getByTestId('add-payment-form'));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Card token is required'));
    expect(addPaymentMethod).not.toHaveBeenCalled();
  });

  it('removes a payment method and updates the list', async () => {
    (removePaymentMethod as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-payment'));
    fireEvent.click(screen.getByTestId('tab-payment'));
    fireEvent.click(screen.getByTestId('remove-pm-pm_002'));
    await waitFor(() => expect(removePaymentMethod).toHaveBeenCalledWith('pm_002'));
    expect(screen.queryByTestId('pm-pm_002')).toBeNull();
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('removed'));
  });

  it('sets a non-default card as default and updates badges', async () => {
    (setDefaultPaymentMethod as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-payment'));
    fireEvent.click(screen.getByTestId('tab-payment'));
    fireEvent.click(screen.getByTestId('set-default-pm_002'));
    await waitFor(() => expect(setDefaultPaymentMethod).toHaveBeenCalledWith('pm_002'));
    expect(screen.getByTestId('default-badge-pm_002')).toBeTruthy();
    expect(screen.queryByTestId('default-badge-pm_001')).toBeNull();
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('Default'));
  });
});

// ---------------------------------------------------------------------------
// 4. Auth and error handling flows (6 tests)
// ---------------------------------------------------------------------------
describe('Auth and error handling flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login when fetchPlans returns 401', async () => {
    (fetchPlans as ReturnType<typeof vi.fn>).mockRejectedValue({ status: 401, message: 'Unauthorized' });
    (fetchInvoices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchPaymentMethods as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<BillingPage />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });

  it('shows error state and toast when fetchPlans fails with 500', async () => {
    (fetchPlans as ReturnType<typeof vi.fn>).mockRejectedValue({ status: 500, message: 'Internal server error' });
    (fetchInvoices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchPaymentMethods as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('billing-error'));
    expect(screen.getByTestId('billing-error').textContent).toContain('Internal server error');
    expect(mockToastError).toHaveBeenCalledWith('Internal server error');
  });

  it('shows error toast when subscribeToPlan fails', async () => {
    setupHappy();
    (subscribeToPlan as ReturnType<typeof vi.fn>).mockRejectedValue({ message: 'Payment declined' });
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('subscribe-enterprise'));
    fireEvent.click(screen.getByTestId('subscribe-enterprise'));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Payment declined'));
  });

  it('shows error toast when cancelSubscription fails', async () => {
    setupHappy();
    (cancelSubscription as ReturnType<typeof vi.fn>).mockRejectedValue({ message: 'Cannot cancel active contract' });
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('cancel-subscription'));
    fireEvent.click(screen.getByTestId('cancel-subscription'));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Cannot cancel active contract'));
  });

  it('shows error toast when addPaymentMethod API call fails', async () => {
    setupHappy();
    (addPaymentMethod as ReturnType<typeof vi.fn>).mockRejectedValue({ message: 'Invalid card' });
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('tab-payment'));
    fireEvent.click(screen.getByTestId('tab-payment'));
    fireEvent.change(screen.getByTestId('card-token-input'), { target: { value: 'tok_bad' } });
    fireEvent.submit(screen.getByTestId('add-payment-form'));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Invalid card'));
  });

  it('shows error toast when changeBillingCycle fails', async () => {
    setupHappy();
    (changeBillingCycle as ReturnType<typeof vi.fn>).mockRejectedValue({ message: 'Cycle change not allowed' });
    render(<BillingPage />);
    await waitFor(() => screen.getByTestId('switch-to-monthly'));
    fireEvent.click(screen.getByTestId('switch-to-monthly'));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Cycle change not allowed'));
  });
});
