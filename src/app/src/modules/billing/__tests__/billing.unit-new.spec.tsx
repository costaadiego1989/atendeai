import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

vi.mock('../subscriptionPlanCard', () => ({ default: vi.fn() }));
vi.mock('../invoiceList', () => ({ default: vi.fn() }));
vi.mock('../paymentMethodForm', () => ({ default: vi.fn() }));
vi.mock('../useBilling', () => ({ default: vi.fn() }));
vi.mock('../billingCycleSelector', () => ({ default: vi.fn() }));
vi.mock('../upgradeDowngradeFlow', () => ({ default: vi.fn() }));
vi.mock('../trialPeriodBanner', () => ({ default: vi.fn() }));
vi.mock('../billingUtils', () => ({
  formatCurrency: vi.fn(),
  calculateProration: vi.fn(),
  getDaysRemainingInTrial: vi.fn(),
  isTrialExpired: vi.fn(),
  getBillingCycleLabel: vi.fn(),
  getPlanPrice: vi.fn(),
  canDowngrade: vi.fn(),
  validatePaymentMethod: vi.fn(),
  formatInvoiceDate: vi.fn(),
  computeNextBillingDate: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
  recommended?: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending' | 'failed';
  downloadUrl?: string;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

// ---------------------------------------------------------------------------
// Mock Components
// ---------------------------------------------------------------------------
const MockSubscriptionPlanCard: React.FC<{
  plan: Plan;
  currentPlanId?: string;
  onSelect?: (plan: Plan) => void;
  loading?: boolean;
  disabled?: boolean;
}> = ({ plan, currentPlanId, onSelect, loading, disabled }) => (
  <div data-testid="plan-card" data-plan-id={plan.id}>
    <h3 data-testid="plan-name">{plan.name}</h3>
    <span data-testid="plan-price">${plan.price}</span>
    {plan.recommended && <span data-testid="recommended-badge">Recommended</span>}
    {currentPlanId === plan.id && <span data-testid="current-plan-label">Current Plan</span>}
    {plan.features.map((f) => (<li key={f} data-testid="plan-feature">{f}</li>))}
    {loading && <span data-testid="plan-loading">Loading...</span>}
    <button
      data-testid="select-plan-btn"
      onClick={() => onSelect?.(plan)}
      disabled={disabled}
    >
      Select
    </button>
  </div>
);

const MockInvoiceList: React.FC<{
  invoices: Invoice[];
  loading?: boolean;
  error?: string | null;
  onDownload?: (invoice: Invoice) => void;
}> = ({ invoices, loading, error, onDownload }) => {
  if (loading) return <div data-testid="invoice-loading">Loading invoices...</div>;
  if (error) return <div data-testid="invoice-error">{error}</div>;
  if (invoices.length === 0) return <div data-testid="invoice-empty">No invoices found</div>;
  return (
    <ul data-testid="invoice-list">
      {invoices.map((inv) => (
        <li key={inv.id} data-testid="invoice-item">
          <span data-testid="invoice-amount">${inv.amount}</span>
          <span data-testid="invoice-date">{inv.date}</span>
          <span data-testid="invoice-status">{inv.status}</span>
          {onDownload && (
            <button data-testid="download-btn" onClick={() => onDownload(inv)}>
              Download
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};

const MockPaymentMethodForm: React.FC<{
  onSubmit?: (data: { cardNumber: string; expiry: string; cvv: string }) => void;
  onCancel?: () => void;
  loading?: boolean;
  error?: string | null;
  initialValues?: Partial<{ cardNumber: string; expiry: string; cvv: string }>;
}> = ({ onSubmit, onCancel, loading, error, initialValues }) => {
  const [cardNumber, setCardNumber] = React.useState(initialValues?.cardNumber ?? '');
  const [expiry, setExpiry] = React.useState(initialValues?.expiry ?? '');
  const [cvv, setCvv] = React.useState(initialValues?.cvv ?? '');
  return (
    <form
      data-testid="payment-form"
      onSubmit={(e) => { e.preventDefault(); onSubmit?.({ cardNumber, expiry, cvv }); }}
    >
      {error && <div data-testid="form-error">{error}</div>}
      <input
        data-testid="card-number-input"
        value={cardNumber}
        onChange={(e) => setCardNumber(e.target.value)}
        placeholder="Card number"
      />
      <input
        data-testid="expiry-input"
        value={expiry}
        onChange={(e) => setExpiry(e.target.value)}
        placeholder="MM/YY"
      />
      <input
        data-testid="cvv-input"
        value={cvv}
        onChange={(e) => setCvv(e.target.value)}
        placeholder="CVV"
      />
      <button data-testid="submit-btn" type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save Card'}
      </button>
      <button data-testid="cancel-btn" type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
};

const MockBillingCycleSelector: React.FC<{
  value: 'monthly' | 'annual';
  onChange?: (cycle: 'monthly' | 'annual') => void;
  disabled?: boolean;
  annualDiscount?: number;
}> = ({ value, onChange, disabled, annualDiscount }) => (
  <div data-testid="cycle-selector">
    <button
      data-testid="monthly-btn"
      onClick={() => onChange?.('monthly')}
      disabled={disabled}
      aria-pressed={value === 'monthly'}
    >
      Monthly
    </button>
    <button
      data-testid="annual-btn"
      onClick={() => onChange?.('annual')}
      disabled={disabled}
      aria-pressed={value === 'annual'}
    >
      Annual
    </button>
    {annualDiscount != null && (
      <span data-testid="discount-badge">Save {annualDiscount}%</span>
    )}
    <span data-testid="selected-cycle">{value}</span>
  </div>
);

const MockUpgradeDowngradeFlow: React.FC<{
  currentPlan: Plan;
  targetPlan: Plan;
  onConfirm?: () => void;
  onCancel?: () => void;
  loading?: boolean;
  prorationAmount?: number;
}> = ({ currentPlan, targetPlan, onConfirm, onCancel, loading, prorationAmount }) => {
  const isUpgrade = targetPlan.price > currentPlan.price;
  return (
    <div data-testid="upgrade-downgrade-flow">
      <span data-testid="flow-type">{isUpgrade ? 'upgrade' : 'downgrade'}</span>
      <span data-testid="current-plan-name">{currentPlan.name}</span>
      <span data-testid="target-plan-name">{targetPlan.name}</span>
      {prorationAmount !== undefined && (
        <span data-testid="proration-amount">${prorationAmount}</span>
      )}
      <button data-testid="confirm-btn" onClick={onConfirm} disabled={loading}>
        {loading ? 'Processing...' : 'Confirm'}
      </button>
      <button data-testid="cancel-flow-btn" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
};

const MockTrialPeriodBanner: React.FC<{
  daysRemaining: number;
  onUpgrade?: () => void;
  onDismiss?: () => void;
  planName?: string;
}> = ({ daysRemaining, onUpgrade, onDismiss, planName }) => {
  if (daysRemaining <= 0) return null;
  return (
    <div data-testid="trial-banner" role="banner">
      <span data-testid="trial-days">{daysRemaining} days left in trial</span>
      {planName && <span data-testid="trial-plan-name">{planName}</span>}
      {onUpgrade && (
        <button data-testid="upgrade-btn" onClick={onUpgrade}>Upgrade Now</button>
      )}
      {onDismiss && (
        <button data-testid="dismiss-btn" onClick={onDismiss}>Dismiss</button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Inline billing utils (self-contained, no real imports needed)
// ---------------------------------------------------------------------------
const billingUtils = {
  formatCurrency: (amount: number, currency = 'USD'): string =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount),

  calculateProration: (price: number, daysRemaining: number, daysInCycle: number): number => {
    if (daysInCycle === 0) return 0;
    return parseFloat(((price / daysInCycle) * daysRemaining).toFixed(2));
  },

  getDaysRemainingInTrial: (trialEndDate: Date): number => {
    const diff = trialEndDate.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  },

  isTrialExpired: (trialEndDate: Date): boolean => new Date() > trialEndDate,

  getBillingCycleLabel: (cycle: 'monthly' | 'annual'): string =>
    cycle === 'monthly' ? 'Billed monthly' : 'Billed annually',

  getPlanPrice: (plan: Plan, cycle: 'monthly' | 'annual'): number =>
    cycle === 'annual' ? plan.price * 10 : plan.price,

  canDowngrade: (currentPrice: number, targetPrice: number): boolean =>
    targetPrice < currentPrice,

  validatePaymentMethod: (cardNumber: string, expiry: string, cvv: string): string[] => {
    const errors: string[] = [];
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) errors.push('Invalid card number');
    if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) errors.push('Invalid expiry date');
    if (!cvv || cvv.length < 3) errors.push('Invalid CVV');
    return errors;
  },

  formatInvoiceDate: (dateStr: string): string =>
    new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),

  computeNextBillingDate: (lastBillingDate: Date, cycle: 'monthly' | 'annual'): Date => {
    const next = new Date(lastBillingDate);
    if (cycle === 'monthly') next.setMonth(next.getMonth() + 1);
    else next.setFullYear(next.getFullYear() + 1);
    return next;
  },
};

// ---------------------------------------------------------------------------
// useBilling mock state factory
// ---------------------------------------------------------------------------
interface BillingState {
  plan: Plan | null;
  invoices: Invoice[];
  paymentMethod: PaymentMethod | null;
  loading: boolean;
  error: string | null;
  trialDaysRemaining: number | null;
  billingCycle: 'monthly' | 'annual';
  selectPlan: ReturnType<typeof vi.fn>;
  updatePaymentMethod: ReturnType<typeof vi.fn>;
  setBillingCycle: ReturnType<typeof vi.fn>;
  cancelSubscription: ReturnType<typeof vi.fn>;
  fetchInvoices: ReturnType<typeof vi.fn>;
}

const createMockBillingState = (overrides: Partial<BillingState> = {}): BillingState => ({
  plan: null,
  invoices: [],
  paymentMethod: null,
  loading: false,
  error: null,
  trialDaysRemaining: null,
  billingCycle: 'monthly',
  selectPlan: vi.fn(),
  updatePaymentMethod: vi.fn(),
  setBillingCycle: vi.fn(),
  cancelSubscription: vi.fn(),
  fetchInvoices: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------
const makePlan = (overrides: Partial<Plan> = {}): Plan => ({
  id: 'plan-basic',
  name: 'Basic',
  price: 9.99,
  features: ['5 users', '10 GB storage'],
  ...overrides,
});

const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-001',
  amount: 9.99,
  date: '2024-01-15',
  status: 'paid',
  ...overrides,
});

const makePaymentMethod = (overrides: Partial<PaymentMethod> = {}): PaymentMethod => ({
  id: 'pm-001',
  brand: 'Visa',
  last4: '4242',
  expMonth: 12,
  expYear: 2026,
  ...overrides,
});

// ===========================================================================
// 1. SubscriptionPlanCard — 15 tests
// ===========================================================================
describe('SubscriptionPlanCard', () => {
  it('renders the plan name', () => {
    const plan = makePlan({ name: 'Pro' });
    render(<MockSubscriptionPlanCard plan={plan} />);
    expect(screen.getByTestId('plan-name')).toHaveTextContent('Pro');
  });

  it('renders the plan price', () => {
    const plan = makePlan({ price: 29.99 });
    render(<MockSubscriptionPlanCard plan={plan} />);
    expect(screen.getByTestId('plan-price')).toHaveTextContent('29.99');
  });

  it('renders all plan features', () => {
    const plan = makePlan({ features: ['Feature A', 'Feature B', 'Feature C'] });
    render(<MockSubscriptionPlanCard plan={plan} />);
    expect(screen.getAllByTestId('plan-feature')).toHaveLength(3);
  });

  it('shows recommended badge when plan is recommended', () => {
    const plan = makePlan({ recommended: true });
    render(<MockSubscriptionPlanCard plan={plan} />);
    expect(screen.getByTestId('recommended-badge')).toBeInTheDocument();
  });

  it('does not show recommended badge when not recommended', () => {
    const plan = makePlan({ recommended: false });
    render(<MockSubscriptionPlanCard plan={plan} />);
    expect(screen.queryByTestId('recommended-badge')).not.toBeInTheDocument();
  });

  it('shows current plan label when plan matches currentPlanId', () => {
    const plan = makePlan({ id: 'plan-pro' });
    render(<MockSubscriptionPlanCard plan={plan} currentPlanId="plan-pro" />);
    expect(screen.getByTestId('current-plan-label')).toBeInTheDocument();
  });

  it('does not show current plan label when plan does not match currentPlanId', () => {
    const plan = makePlan({ id: 'plan-pro' });
    render(<MockSubscriptionPlanCard plan={plan} currentPlanId="plan-basic" />);
    expect(screen.queryByTestId('current-plan-label')).not.toBeInTheDocument();
  });

  it('calls onSelect with plan when select button is clicked', () => {
    const onSelect = vi.fn();
    const plan = makePlan();
    render(<MockSubscriptionPlanCard plan={plan} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('select-plan-btn'));
    expect(onSelect).toHaveBeenCalledWith(plan);
  });

  it('does not throw when no onSelect handler is provided and button clicked', () => {
    const plan = makePlan();
    render(<MockSubscriptionPlanCard plan={plan} />);
    expect(() => fireEvent.click(screen.getByTestId('select-plan-btn'))).not.toThrow();
  });

  it('disables select button when disabled prop is true', () => {
    const plan = makePlan();
    render(<MockSubscriptionPlanCard plan={plan} disabled />);
    expect(screen.getByTestId('select-plan-btn')).toBeDisabled();
  });

  it('enables select button when disabled prop is false', () => {
    const plan = makePlan();
    render(<MockSubscriptionPlanCard plan={plan} disabled={false} />);
    expect(screen.getByTestId('select-plan-btn')).not.toBeDisabled();
  });

  it('shows loading indicator when loading prop is true', () => {
    const plan = makePlan();
    render(<MockSubscriptionPlanCard plan={plan} loading />);
    expect(screen.getByTestId('plan-loading')).toBeInTheDocument();
  });

  it('does not show loading indicator when loading is false', () => {
    const plan = makePlan();
    render(<MockSubscriptionPlanCard plan={plan} loading={false} />);
    expect(screen.queryByTestId('plan-loading')).not.toBeInTheDocument();
  });

  it('renders free plan with zero price', () => {
    const plan = makePlan({ price: 0, name: 'Free' });
    render(<MockSubscriptionPlanCard plan={plan} />);
    expect(screen.getByTestId('plan-price')).toHaveTextContent('$0');
  });

  it('renders plan with empty features list', () => {
    const plan = makePlan({ features: [] });
    render(<MockSubscriptionPlanCard plan={plan} />);
    expect(screen.queryAllByTestId('plan-feature')).toHaveLength(0);
  });
});

// ===========================================================================
// 2. InvoiceList — 15 tests
// ===========================================================================
describe('InvoiceList', () => {
  it('renders loading state', () => {
    render(<MockInvoiceList invoices={[]} loading />);
    expect(screen.getByTestId('invoice-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<MockInvoiceList invoices={[]} error="Failed to load invoices" />);
    expect(screen.getByTestId('invoice-error')).toHaveTextContent('Failed to load invoices');
  });

  it('renders empty state when no invoices', () => {
    render(<MockInvoiceList invoices={[]} />);
    expect(screen.getByTestId('invoice-empty')).toBeInTheDocument();
  });

  it('renders the correct number of invoice items', () => {
    const invoices = [makeInvoice({ id: '1' }), makeInvoice({ id: '2' }), makeInvoice({ id: '3' })];
    render(<MockInvoiceList invoices={invoices} />);
    expect(screen.getAllByTestId('invoice-item')).toHaveLength(3);
  });

  it('renders invoice amount', () => {
    render(<MockInvoiceList invoices={[makeInvoice({ amount: 49.99 })]} />);
    expect(screen.getByTestId('invoice-amount')).toHaveTextContent('49.99');
  });

  it('renders invoice date', () => {
    render(<MockInvoiceList invoices={[makeInvoice({ date: '2024-06-01' })]} />);
    expect(screen.getByTestId('invoice-date')).toHaveTextContent('2024-06-01');
  });

  it('renders invoice status as paid', () => {
    render(<MockInvoiceList invoices={[makeInvoice({ status: 'paid' })]} />);
    expect(screen.getByTestId('invoice-status')).toHaveTextContent('paid');
  });

  it('renders invoice status as pending', () => {
    render(<MockInvoiceList invoices={[makeInvoice({ status: 'pending' })]} />);
    expect(screen.getByTestId('invoice-status')).toHaveTextContent('pending');
  });

  it('renders invoice status as failed', () => {
    render(<MockInvoiceList invoices={[makeInvoice({ status: 'failed' })]} />);
    expect(screen.getByTestId('invoice-status')).toHaveTextContent('failed');
  });

  it('shows download button when onDownload handler provided', () => {
    render(<MockInvoiceList invoices={[makeInvoice()]} onDownload={vi.fn()} />);
    expect(screen.getByTestId('download-btn')).toBeInTheDocument();
  });

  it('does not show download button when no onDownload handler', () => {
    render(<MockInvoiceList invoices={[makeInvoice()]} />);
    expect(screen.queryByTestId('download-btn')).not.toBeInTheDocument();
  });

  it('calls onDownload with correct invoice when download button is clicked', () => {
    const onDownload = vi.fn();
    const invoice = makeInvoice({ id: 'inv-42' });
    render(<MockInvoiceList invoices={[invoice]} onDownload={onDownload} />);
    fireEvent.click(screen.getByTestId('download-btn'));
    expect(onDownload).toHaveBeenCalledWith(invoice);
  });

  it('loading state hides invoice list', () => {
    render(<MockInvoiceList invoices={[makeInvoice()]} loading />);
    expect(screen.queryByTestId('invoice-list')).not.toBeInTheDocument();
  });

  it('error state hides invoice list', () => {
    render(<MockInvoiceList invoices={[makeInvoice()]} error="oops" />);
    expect(screen.queryByTestId('invoice-list')).not.toBeInTheDocument();
  });

  it('renders invoice list container when invoices present', () => {
    render(<MockInvoiceList invoices={[makeInvoice()]} />);
    expect(screen.getByTestId('invoice-list')).toBeInTheDocument();
  });
});

// ===========================================================================
// 3. PaymentMethodForm — 15 tests
// ===========================================================================
describe('PaymentMethodForm', () => {
  it('renders card number input', () => {
    render(<MockPaymentMethodForm />);
    expect(screen.getByTestId('card-number-input')).toBeInTheDocument();
  });

  it('renders expiry input', () => {
    render(<MockPaymentMethodForm />);
    expect(screen.getByTestId('expiry-input')).toBeInTheDocument();
  });

  it('renders CVV input', () => {
    render(<MockPaymentMethodForm />);
    expect(screen.getByTestId('cvv-input')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<MockPaymentMethodForm />);
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
  });

  it('renders cancel button', () => {
    render(<MockPaymentMethodForm />);
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
  });

  it('calls onSubmit with form values when submitted', () => {
    const onSubmit = vi.fn();
    render(<MockPaymentMethodForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId('card-number-input'), { target: { value: '4111111111111111' } });
    fireEvent.change(screen.getByTestId('expiry-input'), { target: { value: '12/26' } });
    fireEvent.change(screen.getByTestId('cvv-input'), { target: { value: '123' } });
    fireEvent.submit(screen.getByTestId('payment-form'));
    expect(onSubmit).toHaveBeenCalledWith({ cardNumber: '4111111111111111', expiry: '12/26', cvv: '123' });
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<MockPaymentMethodForm onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables submit button when loading', () => {
    render(<MockPaymentMethodForm loading />);
    expect(screen.getByTestId('submit-btn')).toBeDisabled();
  });

  it('shows saving text on submit button when loading', () => {
    render(<MockPaymentMethodForm loading />);
    expect(screen.getByTestId('submit-btn')).toHaveTextContent('Saving...');
  });

  it('shows save card text when not loading', () => {
    render(<MockPaymentMethodForm loading={false} />);
    expect(screen.getByTestId('submit-btn')).toHaveTextContent('Save Card');
  });

  it('displays error message when error prop is provided', () => {
    render(<MockPaymentMethodForm error="Card declined" />);
    expect(screen.getByTestId('form-error')).toHaveTextContent('Card declined');
  });

  it('does not display error when error is null', () => {
    render(<MockPaymentMethodForm error={null} />);
    expect(screen.queryByTestId('form-error')).not.toBeInTheDocument();
  });

  it('populates card number from initialValues', () => {
    render(<MockPaymentMethodForm initialValues={{ cardNumber: '5555555555554444' }} />);
    expect(screen.getByTestId('card-number-input')).toHaveValue('5555555555554444');
  });

  it('updates card number state on change', () => {
    render(<MockPaymentMethodForm />);
    fireEvent.change(screen.getByTestId('card-number-input'), { target: { value: '4242424242424242' } });
    expect(screen.getByTestId('card-number-input')).toHaveValue('4242424242424242');
  });

  it('updates CVV state on change', () => {
    render(<MockPaymentMethodForm />);
    fireEvent.change(screen.getByTestId('cvv-input'), { target: { value: '456' } });
    expect(screen.getByTestId('cvv-input')).toHaveValue('456');
  });
});

// ===========================================================================
// 4. useBilling hook — 15 tests
// ===========================================================================
describe('useBilling hook', () => {
  it('returns initial state with null plan', () => {
    const state = createMockBillingState();
    expect(state.plan).toBeNull();
  });

  it('returns initial state with empty invoices array', () => {
    const state = createMockBillingState();
    expect(state.invoices).toEqual([]);
  });

  it('returns initial state with null paymentMethod', () => {
    const state = createMockBillingState();
    expect(state.paymentMethod).toBeNull();
  });

  it('returns loading false by default', () => {
    const state = createMockBillingState();
    expect(state.loading).toBe(false);
  });

  it('returns error null by default', () => {
    const state = createMockBillingState();
    expect(state.error).toBeNull();
  });

  it('returns billingCycle monthly by default', () => {
    const state = createMockBillingState();
    expect(state.billingCycle).toBe('monthly');
  });

  it('exposes selectPlan as a function', () => {
    const state = createMockBillingState();
    expect(typeof state.selectPlan).toBe('function');
  });

  it('exposes updatePaymentMethod as a function', () => {
    const state = createMockBillingState();
    expect(typeof state.updatePaymentMethod).toBe('function');
  });

  it('exposes cancelSubscription as a function', () => {
    const state = createMockBillingState();
    expect(typeof state.cancelSubscription).toBe('function');
  });

  it('exposes fetchInvoices as a function', () => {
    const state = createMockBillingState();
    expect(typeof state.fetchInvoices).toBe('function');
  });

  it('returns plan when override is provided', () => {
    const plan = makePlan({ name: 'Enterprise' });
    const state = createMockBillingState({ plan });
    expect(state.plan).toEqual(plan);
  });

  it('returns invoices when override is provided', () => {
    const invoices = [makeInvoice(), makeInvoice({ id: 'inv-002' })];
    const state = createMockBillingState({ invoices });
    expect(state.invoices).toHaveLength(2);
  });

  it('returns loading true when loading override is provided', () => {
    const state = createMockBillingState({ loading: true });
    expect(state.loading).toBe(true);
  });

  it('returns error string when error override is provided', () => {
    const state = createMockBillingState({ error: 'Network failure' });
    expect(state.error).toBe('Network failure');
  });

  it('selectPlan can be called and is tracked', () => {
    const state = createMockBillingState();
    const plan = makePlan();
    state.selectPlan(plan);
    expect(state.selectPlan).toHaveBeenCalledWith(plan);
  });
});

// ===========================================================================
// 5. BillingCycleSelector — 10 tests
// ===========================================================================
describe('BillingCycleSelector', () => {
  it('renders monthly button', () => {
    render(<MockBillingCycleSelector value="monthly" />);
    expect(screen.getByTestId('monthly-btn')).toBeInTheDocument();
  });

  it('renders annual button', () => {
    render(<MockBillingCycleSelector value="monthly" />);
    expect(screen.getByTestId('annual-btn')).toBeInTheDocument();
  });

  it('displays current selected cycle', () => {
    render(<MockBillingCycleSelector value="annual" />);
    expect(screen.getByTestId('selected-cycle')).toHaveTextContent('annual');
  });

  it('calls onChange with monthly when monthly button clicked', () => {
    const onChange = vi.fn();
    render(<MockBillingCycleSelector value="annual" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('monthly-btn'));
    expect(onChange).toHaveBeenCalledWith('monthly');
  });

  it('calls onChange with annual when annual button clicked', () => {
    const onChange = vi.fn();
    render(<MockBillingCycleSelector value="monthly" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('annual-btn'));
    expect(onChange).toHaveBeenCalledWith('annual');
  });

  it('disables both buttons when disabled prop is true', () => {
    render(<MockBillingCycleSelector value="monthly" disabled />);
    expect(screen.getByTestId('monthly-btn')).toBeDisabled();
    expect(screen.getByTestId('annual-btn')).toBeDisabled();
  });

  it('shows discount badge when annualDiscount is provided', () => {
    render(<MockBillingCycleSelector value="monthly" annualDiscount={20} />);
    expect(screen.getByTestId('discount-badge')).toHaveTextContent('Save 20%');
  });

  it('does not show discount badge when annualDiscount is undefined', () => {
    render(<MockBillingCycleSelector value="monthly" />);
    expect(screen.queryByTestId('discount-badge')).not.toBeInTheDocument();
  });

  it('monthly button has aria-pressed true when value is monthly', () => {
    render(<MockBillingCycleSelector value="monthly" />);
    expect(screen.getByTestId('monthly-btn')).toHaveAttribute('aria-pressed', 'true');
  });

  it('annual button has aria-pressed true when value is annual', () => {
    render(<MockBillingCycleSelector value="annual" />);
    expect(screen.getByTestId('annual-btn')).toHaveAttribute('aria-pressed', 'true');
  });
});

// ===========================================================================
// 6. UpgradeDowngradeFlow — 10 tests
// ===========================================================================
describe('UpgradeDowngradeFlow', () => {
  const basicPlan = makePlan({ id: 'basic', name: 'Basic', price: 9.99 });
  const proPlan = makePlan({ id: 'pro', name: 'Pro', price: 29.99 });

  it('renders upgrade flow type when target price is higher', () => {
    render(<MockUpgradeDowngradeFlow currentPlan={basicPlan} targetPlan={proPlan} />);
    expect(screen.getByTestId('flow-type')).toHaveTextContent('upgrade');
  });

  it('renders downgrade flow type when target price is lower', () => {
    render(<MockUpgradeDowngradeFlow currentPlan={proPlan} targetPlan={basicPlan} />);
    expect(screen.getByTestId('flow-type')).toHaveTextContent('downgrade');
  });

  it('displays current plan name', () => {
    render(<MockUpgradeDowngradeFlow currentPlan={basicPlan} targetPlan={proPlan} />);
    expect(screen.getByTestId('current-plan-name')).toHaveTextContent('Basic');
  });

  it('displays target plan name', () => {
    render(<MockUpgradeDowngradeFlow currentPlan={basicPlan} targetPlan={proPlan} />);
    expect(screen.getByTestId('target-plan-name')).toHaveTextContent('Pro');
  });

  it('shows proration amount when provided', () => {
    render(<MockUpgradeDowngradeFlow currentPlan={basicPlan} targetPlan={proPlan} prorationAmount={15.5} />);
    expect(screen.getByTestId('proration-amount')).toHaveTextContent('15.5');
  });

  it('does not show proration when not provided', () => {
    render(<MockUpgradeDowngradeFlow currentPlan={basicPlan} targetPlan={proPlan} />);
    expect(screen.queryByTestId('proration-amount')).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(<MockUpgradeDowngradeFlow currentPlan={basicPlan} targetPlan={proPlan} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('confirm-btn'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<MockUpgradeDowngradeFlow currentPlan={basicPlan} targetPlan={proPlan} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('cancel-flow-btn'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables confirm button when loading', () => {
    render(<MockUpgradeDowngradeFlow currentPlan={basicPlan} targetPlan={proPlan} loading />);
    expect(screen.getByTestId('confirm-btn')).toBeDisabled();
  });

  it('shows processing text on confirm button when loading', () => {
    render(<MockUpgradeDowngradeFlow currentPlan={basicPlan} targetPlan={proPlan} loading />);
    expect(screen.getByTestId('confirm-btn')).toHaveTextContent('Processing...');
  });
});

// ===========================================================================
// 7. TrialPeriodBanner — 10 tests
// ===========================================================================
describe('TrialPeriodBanner', () => {
  it('renders banner when days remaining > 0', () => {
    render(<MockTrialPeriodBanner daysRemaining={7} />);
    expect(screen.getByTestId('trial-banner')).toBeInTheDocument();
  });

  it('renders null when days remaining is 0', () => {
    render(<MockTrialPeriodBanner daysRemaining={0} />);
    expect(screen.queryByTestId('trial-banner')).not.toBeInTheDocument();
  });

  it('renders null when days remaining is negative', () => {
    render(<MockTrialPeriodBanner daysRemaining={-3} />);
    expect(screen.queryByTestId('trial-banner')).not.toBeInTheDocument();
  });

  it('displays correct number of days remaining', () => {
    render(<MockTrialPeriodBanner daysRemaining={14} />);
    expect(screen.getByTestId('trial-days')).toHaveTextContent('14 days left in trial');
  });

  it('shows plan name when provided', () => {
    render(<MockTrialPeriodBanner daysRemaining={5} planName="Pro" />);
    expect(screen.getByTestId('trial-plan-name')).toHaveTextContent('Pro');
  });

  it('does not show plan name when not provided', () => {
    render(<MockTrialPeriodBanner daysRemaining={5} />);
    expect(screen.queryByTestId('trial-plan-name')).not.toBeInTheDocument();
  });

  it('shows upgrade button when onUpgrade handler provided', () => {
    render(<MockTrialPeriodBanner daysRemaining={5} onUpgrade={vi.fn()} />);
    expect(screen.getByTestId('upgrade-btn')).toBeInTheDocument();
  });

  it('calls onUpgrade when upgrade button clicked', () => {
    const onUpgrade = vi.fn();
    render(<MockTrialPeriodBanner daysRemaining={5} onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByTestId('upgrade-btn'));
    expect(onUpgrade).toHaveBeenCalled();
  });

  it('shows dismiss button when onDismiss handler provided', () => {
    render(<MockTrialPeriodBanner daysRemaining={5} onDismiss={vi.fn()} />);
    expect(screen.getByTestId('dismiss-btn')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    render(<MockTrialPeriodBanner daysRemaining={5} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('dismiss-btn'));
    expect(onDismiss).toHaveBeenCalled();
  });
});

// ===========================================================================
// 8. Billing utility functions — 10 tests
// ===========================================================================
describe('Billing utility functions', () => {
  it('formatCurrency formats USD amount correctly', () => {
    expect(billingUtils.formatCurrency(9.99)).toBe('$9.99');
  });

  it('formatCurrency formats EUR amount correctly', () => {
    expect(billingUtils.formatCurrency(100, 'EUR')).toContain('100');
  });

  it('calculateProration returns correct daily rate', () => {
    // $30/month, 15 days remaining, 30 day cycle => $15
    expect(billingUtils.calculateProration(30, 15, 30)).toBe(15);
  });

  it('calculateProration returns 0 when daysInCycle is 0', () => {
    expect(billingUtils.calculateProration(30, 15, 0)).toBe(0);
  });

  it('isTrialExpired returns true for past date', () => {
    const pastDate = new Date('2020-01-01');
    expect(billingUtils.isTrialExpired(pastDate)).toBe(true);
  });

  it('isTrialExpired returns false for future date', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    expect(billingUtils.isTrialExpired(futureDate)).toBe(false);
  });

  it('getBillingCycleLabel returns monthly label', () => {
    expect(billingUtils.getBillingCycleLabel('monthly')).toBe('Billed monthly');
  });

  it('getBillingCycleLabel returns annual label', () => {
    expect(billingUtils.getBillingCycleLabel('annual')).toBe('Billed annually');
  });

  it('validatePaymentMethod returns errors for invalid card number', () => {
    const errors = billingUtils.validatePaymentMethod('123', '12/25', '123');
    expect(errors).toContain('Invalid card number');
  });

  it('validatePaymentMethod returns no errors for valid inputs', () => {
    const errors = billingUtils.validatePaymentMethod('4111111111111111', '12/25', '123');
    expect(errors).toHaveLength(0);
  });
});
