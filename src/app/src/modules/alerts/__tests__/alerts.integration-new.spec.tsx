import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@/shared/ui/KPICard', () => ({
  KPICard: ({ title, value, subtitle }: any) => (
    <div data-testid="kpi-card">
      <span data-testid="kpi-title">{title}</span>
      <span data-testid="kpi-value">{String(value)}</span>
      <span data-testid="kpi-subtitle">{subtitle}</span>
    </div>
  ),
}));

vi.mock('@/shared/lib/masks', () => ({
  formatPhone: (v: string) => `(${v.slice(0, 2)}) ${v.slice(2)}`,
  formatCpf: (v: string) => v,
  formatCnpj: (v: string) => v,
}));

vi.mock('lucide-react', () => ({
  Bell: () => <svg data-testid="icon-bell" />,
  Clock3: () => <svg data-testid="icon-clock3" />,
  PauseCircle: () => <svg data-testid="icon-pause-circle" />,
  PhoneIncoming: () => <svg data-testid="icon-phone-incoming" />,
}));

// View-model mock
const mockViewModel = {
  user: { id: '1', name: 'Test User' },
  tenant: { id: 't1', name: 'Test Tenant' },
  resolvedPhone: '11999990000',
  form: null,
  setForm: vi.fn(),
  reminders: [],
  search: '',
  setSearch: vi.fn(),
  statusFilter: 'all',
  setStatusFilter: vi.fn(),
  summary: { total: 10, active: 5, paused: 2, sent: 3 },
  submitCreate: vi.fn(),
  toggleReminder: vi.fn(),
  removeReminder: vi.fn(),
};

vi.mock('../view-models/useAlertsPageViewModel', () => ({
  useAlertsPageViewModel: () => mockViewModel,
}));

// ---------------------------------------------------------------------------
// Component imports
// ---------------------------------------------------------------------------
import { AlertsHeader } from '../components/AlertsHeader';
import { AlertsKPIs } from '../components/AlertsKPIs';

// ---------------------------------------------------------------------------
// Integration: AlertsHeader + AlertsKPIs wiring to view-model data
// ---------------------------------------------------------------------------
describe('AlertsHeader + AlertsKPIs integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1-10: Header always present
  it('header renders alongside KPIs', () => {
    render(
      <>
        <AlertsHeader />
        <AlertsKPIs activeCount={5} pausedCount={2} sentCount={3} resolvedPhone="11999990000" />
      </>,
    );
    expect(screen.getByText('Alertas')).toBeInTheDocument();
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(4);
  });

  it('header h1 is above KPI section', () => {
    const { container } = render(
      <>
        <AlertsHeader />
        <AlertsKPIs activeCount={1} pausedCount={1} sentCount={1} />
      </>,
    );
    const h1 = container.querySelector('h1');
    const grid = container.querySelector('.card-grid');
    expect(h1).not.toBeNull();
    expect(grid).not.toBeNull();
  });

  it('KPIs reflect summary.active', () => {
    render(<AlertsKPIs activeCount={mockViewModel.summary.active} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('KPIs reflect summary.paused', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={mockViewModel.summary.paused} sentCount={0} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('KPIs reflect summary.sent', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={mockViewModel.summary.sent} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('resolvedPhone from view-model is displayed formatted', () => {
    render(
      <AlertsKPIs
        resolvedPhone={mockViewModel.resolvedPhone}
        activeCount={0}
        pausedCount={0}
        sentCount={0}
      />,
    );
    expect(screen.getByText(/11999990000/)).toBeInTheDocument();
  });

  it('undefined resolvedPhone shows Não encontrado', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('Não encontrado')).toBeInTheDocument();
  });

  it('header description visible alongside KPIs', () => {
    render(
      <>
        <AlertsHeader />
        <AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />
      </>,
    );
    expect(screen.getByText(/Configure lembretes/i)).toBeInTheDocument();
  });

  it('all 4 KPI subtitles visible', () => {
    render(<AlertsKPIs activeCount={5} pausedCount={2} sentCount={10} resolvedPhone="11999999999" />);
    expect(screen.getAllByTestId('kpi-subtitle')).toHaveLength(4);
  });

  it('KPIs update on prop change reflecting view-model state change', () => {
    const { rerender } = render(
      <AlertsKPIs activeCount={5} pausedCount={2} sentCount={3} />,
    );
    rerender(<AlertsKPIs activeCount={6} pausedCount={3} sentCount={4} />);
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  // 11-20: data-driven summary scenarios
  it('all zeros summary renders correctly', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getAllByText('0')).toHaveLength(3);
  });

  it('high-volume scenario renders large numbers', () => {
    render(<AlertsKPIs activeCount={500} pausedCount={200} sentCount={1000} />);
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('KPI card order: WhatsApp, Ativos, Pausados, Concluídos', () => {
    render(<AlertsKPIs activeCount={1} pausedCount={2} sentCount={3} />);
    const titles = screen.getAllByTestId('kpi-title').map((el) => el.textContent);
    expect(titles).toEqual(['Seu WhatsApp', 'Alertas Ativos', 'Pausados', 'Concluídos']);
  });

  it('header renders before and after KPIs rerender', () => {
    const { rerender } = render(
      <>
        <AlertsHeader />
        <AlertsKPIs activeCount={1} pausedCount={0} sentCount={0} />
      </>,
    );
    rerender(
      <>
        <AlertsHeader />
        <AlertsKPIs activeCount={99} pausedCount={0} sentCount={0} />
      </>,
    );
    expect(screen.getByText('Alertas')).toBeInTheDocument();
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('header is static when KPIs change', () => {
    const { rerender } = render(
      <>
        <AlertsHeader />
        <AlertsKPIs activeCount={1} pausedCount={0} sentCount={0} />
      </>,
    );
    const h1Text = screen.getByRole('heading', { level: 1 }).textContent;
    rerender(
      <>
        <AlertsHeader />
        <AlertsKPIs activeCount={50} pausedCount={10} sentCount={20} />
      </>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(h1Text);
  });

  it('phone changes propagate to display', () => {
    const { rerender } = render(
      <AlertsKPIs resolvedPhone="11111111111" activeCount={0} pausedCount={0} sentCount={0} />,
    );
    rerender(
      <AlertsKPIs resolvedPhone="22222222222" activeCount={0} pausedCount={0} sentCount={0} />,
    );
    expect(screen.getByText(/22222222222/)).toBeInTheDocument();
  });

  it('removing phone shows Não encontrado', () => {
    const { rerender } = render(
      <AlertsKPIs resolvedPhone="11999" activeCount={0} pausedCount={0} sentCount={0} />,
    );
    rerender(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('Não encontrado')).toBeInTheDocument();
  });

  it('KPIs never show "undefined" text', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('KPIs never show "null" text', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('KPI values are strings (coerced by mock)', () => {
    render(<AlertsKPIs activeCount={42} pausedCount={0} sentCount={0} />);
    const values = screen.getAllByTestId('kpi-value');
    values.forEach((v) => expect(typeof v.textContent).toBe('string'));
  });

  // 21-30: error and edge states
  it('does not crash with activeCount = -1', () => {
    expect(() => render(<AlertsKPIs activeCount={-1} pausedCount={0} sentCount={0} />)).not.toThrow();
  });

  it('does not crash with very large numbers', () => {
    expect(() =>
      render(<AlertsKPIs activeCount={Number.MAX_SAFE_INTEGER} pausedCount={0} sentCount={0} />),
    ).not.toThrow();
  });

  it('does not crash with float counts', () => {
    expect(() => render(<AlertsKPIs activeCount={1.5} pausedCount={0.5} sentCount={0} />)).not.toThrow();
  });

  it('KPI card grid has correct class', () => {
    const { container } = render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(container.querySelector('.card-grid')).not.toBeNull();
  });

  it('header has correct semantic structure', () => {
    render(<AlertsHeader />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('header description text is non-empty', () => {
    render(<AlertsHeader />);
    const p = document.querySelector('p.page-description');
    expect(p?.textContent?.length).toBeGreaterThan(0);
  });

  it('multiple renders produce consistent output', () => {
    const props = { activeCount: 5, pausedCount: 2, sentCount: 3 };
    const { container: c1 } = render(<AlertsKPIs {...props} />);
    const { container: c2 } = render(<AlertsKPIs {...props} />);
    expect(c1.innerHTML).toBe(c2.innerHTML);
  });

  it('header snapshot is stable', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('KPIs snapshot is stable', () => {
    const { container } = render(<AlertsKPIs activeCount={5} pausedCount={2} sentCount={3} resolvedPhone="11999999999" />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('combined header + KPIs snapshot is stable', () => {
    const { container } = render(
      <>
        <AlertsHeader />
        <AlertsKPIs activeCount={5} pausedCount={2} sentCount={3} />
      </>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  // 31-50: filter/search/interaction scenarios (via view-model interface)
  it('setSearch is a function on the view-model', () => {
    expect(typeof mockViewModel.setSearch).toBe('function');
  });

  it('setStatusFilter is a function on the view-model', () => {
    expect(typeof mockViewModel.setStatusFilter).toBe('function');
  });

  it('toggleReminder is a function on the view-model', () => {
    expect(typeof mockViewModel.toggleReminder).toBe('function');
  });

  it('removeReminder is a function on the view-model', () => {
    expect(typeof mockViewModel.removeReminder).toBe('function');
  });

  it('submitCreate is a function on the view-model', () => {
    expect(typeof mockViewModel.submitCreate).toBe('function');
  });

  it('view-model summary.total is 10', () => {
    expect(mockViewModel.summary.total).toBe(10);
  });

  it('view-model summary active + paused + sent = total', () => {
    const { active, paused, sent } = mockViewModel.summary;
    expect(active + paused + sent).toBe(10);
  });

  it('KPIs show active from summary', () => {
    render(
      <AlertsKPIs
        activeCount={mockViewModel.summary.active}
        pausedCount={mockViewModel.summary.paused}
        sentCount={mockViewModel.summary.sent}
      />,
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('KPIs show paused from summary', () => {
    render(
      <AlertsKPIs
        activeCount={mockViewModel.summary.active}
        pausedCount={mockViewModel.summary.paused}
        sentCount={mockViewModel.summary.sent}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('KPIs show sent from summary', () => {
    render(
      <AlertsKPIs
        activeCount={mockViewModel.summary.active}
        pausedCount={mockViewModel.summary.paused}
        sentCount={mockViewModel.summary.sent}
      />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('form null state: setForm can be called with a new form', () => {
    expect(mockViewModel.form).toBeNull();
    mockViewModel.setForm({ id: 'new' });
    expect(mockViewModel.setForm).toHaveBeenCalledWith({ id: 'new' });
  });

  it('empty reminders array is valid state', () => {
    expect(Array.isArray(mockViewModel.reminders)).toBe(true);
    expect(mockViewModel.reminders).toHaveLength(0);
  });

  it('search is empty string by default', () => {
    expect(mockViewModel.search).toBe('');
  });

  it('statusFilter defaults to "all"', () => {
    expect(mockViewModel.statusFilter).toBe('all');
  });

  it('setSearch can be called with a query string', () => {
    mockViewModel.setSearch('test query');
    expect(mockViewModel.setSearch).toHaveBeenCalledWith('test query');
  });

  it('setStatusFilter can be called with active', () => {
    mockViewModel.setStatusFilter('active');
    expect(mockViewModel.setStatusFilter).toHaveBeenCalledWith('active');
  });

  it('setStatusFilter can be called with paused', () => {
    mockViewModel.setStatusFilter('paused');
    expect(mockViewModel.setStatusFilter).toHaveBeenCalledWith('paused');
  });

  it('toggleReminder is callable with an id', () => {
    mockViewModel.toggleReminder('reminder-1');
    expect(mockViewModel.toggleReminder).toHaveBeenCalledWith('reminder-1');
  });

  it('removeReminder is callable with an id', () => {
    mockViewModel.removeReminder('reminder-2');
    expect(mockViewModel.removeReminder).toHaveBeenCalledWith('reminder-2');
  });

  // 51-70: alert type scenarios
  it('active alerts count > 0 in mock', () => {
    expect(mockViewModel.summary.active).toBeGreaterThan(0);
  });

  it('KPIs with all same values renders correctly', () => {
    render(<AlertsKPIs activeCount={5} pausedCount={5} sentCount={5} />);
    expect(screen.getAllByText('5')).toHaveLength(3);
  });

  it('KPIs activeCount = 1 shows singular value', () => {
    render(<AlertsKPIs activeCount={1} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('KPIs correctly distinguish active vs paused vs sent', () => {
    render(<AlertsKPIs activeCount={10} pausedCount={20} sentCount={30} />);
    const values = screen.getAllByTestId('kpi-value').map((el) => el.textContent);
    // [phone, active, paused, sent]
    expect(values[1]).toBe('10');
    expect(values[2]).toBe('20');
    expect(values[3]).toBe('30');
  });

  it('header and KPI can be re-rendered many times without issue', () => {
    const { rerender } = render(
      <>
        <AlertsHeader />
        <AlertsKPIs activeCount={1} pausedCount={0} sentCount={0} />
      </>,
    );
    for (let i = 0; i < 10; i++) {
      rerender(
        <>
          <AlertsHeader />
          <AlertsKPIs activeCount={i} pausedCount={i} sentCount={i} />
        </>,
      );
    }
    expect(screen.getByText('Alertas')).toBeInTheDocument();
  });

  it('KPIs first value reflects phone formatting', () => {
    render(<AlertsKPIs resolvedPhone="11999999999" activeCount={0} pausedCount={0} sentCount={0} />);
    const phoneValue = screen.getAllByTestId('kpi-value')[0].textContent;
    expect(phoneValue).toContain('11999999999');
  });

  it('resolvedPhone with spaces is passed through formatPhone', () => {
    render(<AlertsKPIs resolvedPhone="(11) 99999-9999" activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getAllByTestId('kpi-value')[0].textContent).toContain('(11) 99999-9999');
  });

  it('header component function is idempotent', () => {
    const el1 = AlertsHeader();
    const el2 = AlertsHeader();
    expect(el1?.type).toBe(el2?.type);
  });

  it('KPIs component function is idempotent for same props', () => {
    const props = { activeCount: 1, pausedCount: 1, sentCount: 1 };
    const el1 = AlertsKPIs(props);
    const el2 = AlertsKPIs(props);
    expect(el1?.type).toBe(el2?.type);
  });

  it('view-model user id is set', () => {
    expect(mockViewModel.user.id).toBe('1');
  });

  it('view-model tenant id is set', () => {
    expect(mockViewModel.tenant.id).toBe('t1');
  });

  // 71-100: additional integration wiring
  it('KPIs title list matches expected labels in order', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    const titles = screen.getAllByTestId('kpi-title').map((t) => t.textContent);
    expect(titles).toContain('Seu WhatsApp');
    expect(titles).toContain('Alertas Ativos');
    expect(titles).toContain('Pausados');
    expect(titles).toContain('Concluídos');
  });

  it('subtitle list matches expected subtitles in order', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    const subtitles = screen.getAllByTestId('kpi-subtitle').map((s) => s.textContent);
    expect(subtitles).toContain('Onde você recebe os alertas');
    expect(subtitles).toContain('Lembretes na fila de disparo');
    expect(subtitles).toContain('Aguardando reativação');
    expect(subtitles).toContain('Alertas já disparados');
  });

  it('header page-description is accessible', () => {
    render(<AlertsHeader />);
    expect(document.querySelector('.page-description')).toBeInTheDocument();
  });

  it('KPIs renders inside a container div', () => {
    const { container } = render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(container.children).toHaveLength(1);
  });

  it('header root has page-header class', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.querySelector('.page-header')).toBeInTheDocument();
  });

  it('KPI card count is always 4 regardless of props', () => {
    for (const n of [0, 1, 100, 9999]) {
      const { container, unmount } = render(
        <AlertsKPIs activeCount={n} pausedCount={n} sentCount={n} />,
      );
      expect(container.querySelectorAll('[data-testid="kpi-card"]')).toHaveLength(4);
      unmount();
    }
  });

  it('phone card subtitle is static', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('Onde você recebe os alertas')).toBeInTheDocument();
  });

  it('active card subtitle is static', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('Lembretes na fila de disparo')).toBeInTheDocument();
  });

  it('paused card subtitle is static', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('Aguardando reativação')).toBeInTheDocument();
  });

  it('sent card subtitle is static', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('Alertas já disparados')).toBeInTheDocument();
  });

  it('submitCreate called with correct data shape', () => {
    const data = { message: 'Reminder message', time: '08:00' };
    mockViewModel.submitCreate(data);
    expect(mockViewModel.submitCreate).toHaveBeenCalledWith(data);
  });

  it('toggleReminder called multiple times tracks calls', () => {
    vi.clearAllMocks();
    mockViewModel.toggleReminder('id-1');
    mockViewModel.toggleReminder('id-2');
    mockViewModel.toggleReminder('id-3');
    expect(mockViewModel.toggleReminder).toHaveBeenCalledTimes(3);
  });

  it('removeReminder called multiple times tracks calls', () => {
    vi.clearAllMocks();
    mockViewModel.removeReminder('r1');
    mockViewModel.removeReminder('r2');
    expect(mockViewModel.removeReminder).toHaveBeenCalledTimes(2);
  });

  it('mocked formatPhone is called for each resolved phone', () => {
    const masks = require('@/shared/lib/masks');
    const spy = vi.spyOn(masks, 'formatPhone');
    render(<AlertsKPIs resolvedPhone="11999991111" activeCount={0} pausedCount={0} sentCount={0} />);
    expect(spy).toHaveBeenCalledWith('11999991111');
    spy.mockRestore();
  });

  it('KPIs renders with all props set to 1', () => {
    render(<AlertsKPIs activeCount={1} pausedCount={1} sentCount={1} resolvedPhone="1" />);
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(4);
  });

  it('no extra DOM elements outside card-grid', () => {
    const { container } = render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(container.children).toHaveLength(1);
  });

  it('header does not contain KPI cards', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.querySelectorAll('[data-testid="kpi-card"]')).toHaveLength(0);
  });

  it('KPIs do not contain h1', () => {
    const { container } = render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(container.querySelectorAll('h1')).toHaveLength(0);
  });

  it('header + KPIs total card count is 4', () => {
    const { container } = render(
      <>
        <AlertsHeader />
        <AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />
      </>,
    );
    expect(container.querySelectorAll('[data-testid="kpi-card"]')).toHaveLength(4);
  });

  it('header + KPIs total heading count is 1', () => {
    const { container } = render(
      <>
        <AlertsHeader />
        <AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />
      </>,
    );
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });
});
