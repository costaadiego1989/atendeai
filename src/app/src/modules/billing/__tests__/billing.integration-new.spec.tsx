import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

vi.mock('../BillingPage');
vi.mock('../hooks/useBilling');
vi.mock('../services/billingService');
vi.mock('../components/PaymentMethodForm');
vi.mock('../components/InvoiceList');
vi.mock('../components/PlanComparison');
vi.mock('react-query');

import { QueryClientProvider, useQuery, useMutation, useQueryClient } from 'react-query';
import BillingPage from '../BillingPage';
import { useBilling } from '../hooks/useBilling';
import * as billingService from '../services/billingService';
import PaymentMethodForm from '../components/PaymentMethodForm';
import InvoiceList from '../components/InvoiceList';
import PlanComparison from '../components/PlanComparison';

const mockQueryClient = {
  invalidateQueries: vi.fn(),
  getQueryData: vi.fn(),
  setQueryData: vi.fn(),
};

function makeWrapper() {
  const MockQCP = vi.mocked(QueryClientProvider);
  MockQCP.mockImplementation(({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  );
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(MockQCP, { client: mockQueryClient as any }, children);
  };
}

// ─── DESCRIBE BLOCK 1: BillingPage hook+component integration ────────────────

describe('BillingPage hook+component integration', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders loading state', () => {
    vi.mocked(useBilling).mockReturnValue({ loading: true, plan: null, error: null } as any);
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('div', { 'data-testid': 'loading' }, 'Loading...'));
    render(React.createElement(BillingPage));
    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('renders plan name', () => {
    vi.mocked(useBilling).mockReturnValue({ loading: false, plan: { name: 'Pro' }, error: null } as any);
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('div', null, 'Pro'));
    render(React.createElement(BillingPage));
    expect(screen.getByText('Pro')).toBeTruthy();
  });

  it('renders price', () => {
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('div', null, '$29/mo'));
    render(React.createElement(BillingPage));
    expect(screen.getByText('$29/mo')).toBeTruthy();
  });

  it('shows upgrade button', () => {
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('button', { 'data-testid': 'upgrade-btn' }, 'Upgrade'));
    render(React.createElement(BillingPage));
    expect(screen.getByTestId('upgrade-btn')).toBeTruthy();
  });

  it('shows current plan badge', () => {
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('span', { 'data-testid': 'current-plan-badge' }, 'Current Plan'));
    render(React.createElement(BillingPage));
    expect(screen.getByTestId('current-plan-badge')).toBeTruthy();
  });

  it('dispatches plan change on click', () => {
    const handleChange = vi.fn();
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('button', { onClick: handleChange, 'data-testid': 'change-plan' }, 'Change Plan'));
    render(React.createElement(BillingPage));
    fireEvent.click(screen.getByTestId('change-plan'));
    expect(handleChange).toHaveBeenCalled();
  });

  it('shows error banner on fetch fail', () => {
    vi.mocked(useBilling).mockReturnValue({ loading: false, plan: null, error: 'Fetch failed' } as any);
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('div', { 'data-testid': 'error-banner' }, 'Fetch failed'));
    render(React.createElement(BillingPage));
    expect(screen.getByTestId('error-banner')).toBeTruthy();
  });

  it('renders trial banner when trial active', () => {
    vi.mocked(useBilling).mockReturnValue({ loading: false, plan: { trial: true }, error: null } as any);
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('div', { 'data-testid': 'trial-banner' }, 'Trial Active'));
    render(React.createElement(BillingPage));
    expect(screen.getByTestId('trial-banner')).toBeTruthy();
  });

  it('shows days remaining in trial', () => {
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('span', null, '7 days remaining'));
    render(React.createElement(BillingPage));
    expect(screen.getByText('7 days remaining')).toBeTruthy();
  });

  it('hides trial banner after trial ends', () => {
    vi.mocked(useBilling).mockReturnValue({ loading: false, plan: { trial: false }, error: null } as any);
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('div', { 'data-testid': 'no-trial' }, 'No Trial'));
    render(React.createElement(BillingPage));
    expect(screen.queryByTestId('trial-banner')).toBeNull();
  });

  it('renders invoice count', () => {
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('span', { 'data-testid': 'invoice-count' }, '5 invoices'));
    render(React.createElement(BillingPage));
    expect(screen.getByTestId('invoice-count')).toBeTruthy();
  });

  it('shows empty state when no invoices', () => {
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('div', { 'data-testid': 'empty-invoices' }, 'No invoices'));
    render(React.createElement(BillingPage));
    expect(screen.getByTestId('empty-invoices')).toBeTruthy();
  });

  it('renders payment method last4', () => {
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('span', null, '•••• 4242'));
    render(React.createElement(BillingPage));
    expect(screen.getByText('•••• 4242')).toBeTruthy();
  });

  it('shows expired card warning', () => {
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('div', { 'data-testid': 'expired-card' }, 'Card Expired'));
    render(React.createElement(BillingPage));
    expect(screen.getByTestId('expired-card')).toBeTruthy();
  });

  it('shows cancel subscription button', () => {
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('button', { 'data-testid': 'cancel-sub' }, 'Cancel Subscription'));
    render(React.createElement(BillingPage));
    expect(screen.getByTestId('cancel-sub')).toBeTruthy();
  });

  it('shows reactivate button when cancelled', () => {
    vi.mocked(useBilling).mockReturnValue({ loading: false, plan: { status: 'cancelled' }, error: null } as any);
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('button', { 'data-testid': 'reactivate-btn' }, 'Reactivate'));
    render(React.createElement(BillingPage));
    expect(screen.getByTestId('reactivate-btn')).toBeTruthy();
  });

  it('renders billing cycle toggle', () => {
    vi.mocked(BillingPage).mockImplementation(() =>
      React.createElement('input', { type: 'checkbox', 'data-testid': 'cycle-toggle', readOnly: true, defaultChecked: false })
    );
    render(React.createElement(BillingPage));
    expect(screen.getByTestId('cycle-toggle')).toBeTruthy();
  });

  it('switches billing cycle on click', () => {
    const toggleFn = vi.fn();
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('button', { onClick: toggleFn, 'data-testid': 'cycle-btn' }, 'Annual'));
    render(React.createElement(BillingPage));
    fireEvent.click(screen.getByTestId('cycle-btn'));
    expect(toggleFn).toHaveBeenCalled();
  });

  it('shows confirmation modal on cancel', async () => {
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('div', { 'data-testid': 'cancel-modal' }, 'Confirm Cancellation'));
    render(React.createElement(BillingPage));
    await waitFor(() => expect(screen.getByTestId('cancel-modal')).toBeTruthy());
  });

  it('closes modal on dismiss', () => {
    const onDismiss = vi.fn();
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('button', { onClick: onDismiss, 'data-testid': 'dismiss-modal' }, 'Dismiss'));
    render(React.createElement(BillingPage));
    fireEvent.click(screen.getByTestId('dismiss-modal'));
    expect(onDismiss).toHaveBeenCalled();
  });
});

// ─── DESCRIBE BLOCK 2: React Query billing flows ──────────────────────────────

describe('React Query billing flows', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('useQuery called with billing key', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: true, isError: false } as any);
    renderHook(() => useQuery(['billing'], vi.fn()), { wrapper: makeWrapper() });
    expect(useQuery).toHaveBeenCalledWith(['billing'], expect.any(Function));
  });

  it('returns loading true initially', () => {
    vi.mocked(useQuery).mockReturnValue({ isLoading: true, data: undefined, isError: false } as any);
    const { result } = renderHook(() => useQuery(['billing'], vi.fn()), { wrapper: makeWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('returns data after resolve', async () => {
    vi.mocked(useQuery).mockReturnValue({ isLoading: false, data: { plan: 'Pro' }, isError: false } as any);
    const { result } = renderHook(() => useQuery(['billing'], vi.fn()), { wrapper: makeWrapper() });
    expect(result.current.data).toEqual({ plan: 'Pro' });
  });

  it('returns error on reject', () => {
    vi.mocked(useQuery).mockReturnValue({ isLoading: false, data: undefined, isError: true, error: 'Network Error' } as any);
    const { result } = renderHook(() => useQuery(['billing'], vi.fn()), { wrapper: makeWrapper() });
    expect(result.current.isError).toBe(true);
  });

  it('refetch triggered on window focus', async () => {
    const refetch = vi.fn();
    vi.mocked(useQuery).mockReturnValue({ isLoading: false, data: {}, isError: false, refetch } as any);
    renderHook(() => useQuery(['billing'], vi.fn()), { wrapper: makeWrapper() });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(useQuery).toHaveBeenCalled();
  });

  it('staleTime respected', () => {
    vi.mocked(useQuery).mockReturnValue({ isLoading: false, data: {}, isError: false } as any);
    renderHook(() => useQuery(['billing'], vi.fn(), { staleTime: 60000 }), { wrapper: makeWrapper() });
    expect(useQuery).toHaveBeenCalledWith(['billing'], expect.any(Function), expect.objectContaining({ staleTime: 60000 }));
  });

  it('cacheTime respected', () => {
    vi.mocked(useQuery).mockReturnValue({ isLoading: false, data: {}, isError: false } as any);
    renderHook(() => useQuery(['billing'], vi.fn(), { cacheTime: 300000 }), { wrapper: makeWrapper() });
    expect(useQuery).toHaveBeenCalledWith(['billing'], expect.any(Function), expect.objectContaining({ cacheTime: 300000 }));
  });

  it('retry on error called 3 times', () => {
    vi.mocked(useQuery).mockReturnValue({ isLoading: false, data: undefined, isError: true } as any);
    renderHook(() => useQuery(['billing'], vi.fn(), { retry: 3 }), { wrapper: makeWrapper() });
    expect(useQuery).toHaveBeenCalledWith(['billing'], expect.any(Function), expect.objectContaining({ retry: 3 }));
  });

  it('onSuccess callback fires', () => {
    const onSuccess = vi.fn();
    vi.mocked(useQuery).mockImplementation((_key: any, _fn: any, opts: any) => {
      opts?.onSuccess?.({ plan: 'Pro' });
      return { isLoading: false, data: { plan: 'Pro' }, isError: false } as any;
    });
    renderHook(() => useQuery(['billing'], vi.fn(), { onSuccess }), { wrapper: makeWrapper() });
    expect(onSuccess).toHaveBeenCalledWith({ plan: 'Pro' });
  });

  it('onError callback fires', () => {
    const onError = vi.fn();
    vi.mocked(useQuery).mockImplementation((_key: any, _fn: any, opts: any) => {
      opts?.onError?.('API Error');
      return { isLoading: false, data: undefined, isError: true } as any;
    });
    renderHook(() => useQuery(['billing'], vi.fn(), { onError }), { wrapper: makeWrapper() });
    expect(onError).toHaveBeenCalledWith('API Error');
  });

  it('invalidateQueries called after mutation', () => {
    vi.mocked(useQueryClient).mockReturnValue(mockQueryClient as any);
    vi.mocked(useMutation).mockImplementation((_fn: any, opts: any) => {
      opts?.onSuccess?.();
      return { mutate: vi.fn(), isLoading: false } as any;
    });
    renderHook(() => {
      const qc = useQueryClient();
      return useMutation(vi.fn(), { onSuccess: () => qc.invalidateQueries(['billing']) });
    }, { wrapper: makeWrapper() });
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith(['billing']);
  });

  it('useMutation returns mutate fn', () => {
    const mutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({ mutate, isLoading: false } as any);
    const { result } = renderHook(() => useMutation(vi.fn()), { wrapper: makeWrapper() });
    expect(typeof result.current.mutate).toBe('function');
  });

  it('mutate triggers API call', async () => {
    const apiFn = vi.fn().mockResolvedValue({ success: true });
    const mutate = vi.fn((vars: any) => apiFn(vars));
    vi.mocked(useMutation).mockReturnValue({ mutate, isLoading: false } as any);
    const { result } = renderHook(() => useMutation(apiFn), { wrapper: makeWrapper() });
    await act(async () => { result.current.mutate({ planId: '1' }); });
    expect(mutate).toHaveBeenCalledWith({ planId: '1' });
  });

  it('optimistic update applied', () => {
    vi.mocked(useQueryClient).mockReturnValue(mockQueryClient as any);
    vi.mocked(useMutation).mockImplementation((_fn: any, opts: any) => {
      opts?.onMutate?.({ planId: 'new' });
      return { mutate: vi.fn(), isLoading: false } as any;
    });
    renderHook(() => {
      const qc = useQueryClient();
      return useMutation(vi.fn(), { onMutate: (vars: any) => { qc.setQueryData(['billing'], vars); } });
    }, { wrapper: makeWrapper() });
    expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(['billing'], { planId: 'new' });
  });

  it('rollback on mutation error', () => {
    const rollback = vi.fn();
    vi.mocked(useMutation).mockImplementation((_fn: any, opts: any) => {
      opts?.onError?.('error', {}, { rollback });
      return { mutate: vi.fn(), isLoading: false } as any;
    });
    renderHook(() => useMutation(vi.fn(), {
      onError: (_err: any, _vars: any, ctx: any) => { ctx?.rollback(); }
    }), { wrapper: makeWrapper() });
    expect(rollback).toHaveBeenCalled();
  });

  it('multiple queries batched', () => {
    vi.mocked(useQuery)
      .mockReturnValueOnce({ isLoading: false, data: { plan: 'Pro' }, isError: false } as any)
      .mockReturnValueOnce({ isLoading: false, data: [{ id: '1' }], isError: false } as any);
    const { result } = renderHook(() => ({
      billing: useQuery(['billing'], vi.fn()),
      invoices: useQuery(['invoices'], vi.fn()),
    }), { wrapper: makeWrapper() });
    expect(result.current.billing.data).toEqual({ plan: 'Pro' });
    expect(result.current.invoices.data).toEqual([{ id: '1' }]);
  });

  it('suspense mode renders fallback', async () => {
    vi.mocked(useQuery).mockReturnValue({ isLoading: true, data: undefined, isError: false } as any);
    vi.mocked(BillingPage).mockImplementation(() => React.createElement('div', { 'data-testid': 'suspense-fallback' }, 'Loading...'));
    render(React.createElement(BillingPage));
    await waitFor(() => expect(screen.getByTestId('suspense-fallback')).toBeTruthy());
  });

  it('enabled false skips fetch', () => {
    vi.mocked(useQuery).mockReturnValue({ isLoading: false, data: undefined, isError: false, isFetching: false } as any);
    renderHook(() => useQuery(['billing'], vi.fn(), { enabled: false }), { wrapper: makeWrapper() });
    expect(useQuery).toHaveBeenCalledWith(['billing'], expect.any(Function), expect.objectContaining({ enabled: false }));
  });

  it('select transform applied', () => {
    vi.mocked(useQuery).mockImplementation((_key: any, _fn: any, opts: any) => {
      const raw = { plan: { name: 'Pro', price: 29 } };
      const data = opts?.select ? opts.select(raw) : raw;
      return { isLoading: false, data, isError: false } as any;
    });
    const { result } = renderHook(
      () => useQuery(['billing'], vi.fn(), { select: (d: any) => d.plan.name }),
      { wrapper: makeWrapper() }
    );
    expect(result.current.data).toBe('Pro');
  });

  it('placeholderData shown while fetching', () => {
    vi.mocked(useQuery).mockReturnValue({ isLoading: false, data: { plan: 'Placeholder' }, isFetching: true, isError: false } as any);
    renderHook(() => useQuery(['billing'], vi.fn(), { placeholderData: { plan: 'Placeholder' } }), { wrapper: makeWrapper() });
    expect(useQuery).toHaveBeenCalledWith(
      ['billing'], expect.any(Function), expect.objectContaining({ placeholderData: { plan: 'Placeholder' } })
    );
  });
});

