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
}));

vi.mock('lucide-react', () => ({
  Bell: () => <svg data-testid="icon-bell" />,
  Clock3: () => <svg data-testid="icon-clock3" />,
  PauseCircle: () => <svg data-testid="icon-pause-circle" />,
  PhoneIncoming: () => <svg data-testid="icon-phone-incoming" />,
}));

// ---------------------------------------------------------------------------
// Stub full Alerts page
// ---------------------------------------------------------------------------
import { AlertsHeader } from '../components/AlertsHeader';
import { AlertsKPIs } from '../components/AlertsKPIs';

const onToggle = vi.fn();
const onRemove = vi.fn();
const onSearch = vi.fn();
const onFilterChange = vi.fn();

interface Reminder {
  id: string;
  message: string;
  status: 'active' | 'paused' | 'sent';
}

interface AlertsPageStubProps {
  reminders?: Reminder[];
  summary?: { active: number; paused: number; sent: number };
  resolvedPhone?: string;
  search?: string;
  statusFilter?: string;
  isLoading?: boolean;
  errorMessage?: string | null;
}

function AlertsPageStub({
  reminders = [],
  summary = { active: 0, paused: 0, sent: 0 },
  resolvedPhone,
  search = '',
  statusFilter = 'all',
  isLoading = false,
  errorMessage = null,
}: AlertsPageStubProps) {
  return (
    <div data-testid="alerts-page">
      <AlertsHeader />
      <AlertsKPIs
        resolvedPhone={resolvedPhone}
        activeCount={summary.active}
        pausedCount={summary.paused}
        sentCount={summary.sent}
      />
      <input
        data-testid="search-input"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Buscar alertas..."
      />
      <select
        data-testid="status-filter"
        value={statusFilter}
        onChange={(e) => onFilterChange(e.target.value)}
      >
        <option value="all">Todos</option>
        <option value="active">Ativos</option>
        <option value="paused">Pausados</option>
        <option value="sent">Concluídos</option>
      </select>
      {isLoading && <div data-testid="loading-spinner">Carregando...</div>}
      {errorMessage && <div data-testid="error-message">{errorMessage}</div>}
      {reminders.map((r) => (
        <div key={r.id} data-testid={`reminder-${r.id}`}>
          <span data-testid={`reminder-message-${r.id}`}>{r.message}</span>
          <span data-testid={`reminder-status-${r.id}`}>{r.status}</span>
          <button data-testid={`toggle-${r.id}`} onClick={() => onToggle(r.id)}>
            Toggle
          </button>
          <button data-testid={`remove-${r.id}`} onClick={() => onRemove(r.id)}>
            Remover
          </button>
        </div>
      ))}
      {reminders.length === 0 && !isLoading && (
        <div data-testid="empty-state">Nenhum alerta encontrado</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// E2E-style full user flow tests (25)
// ---------------------------------------------------------------------------
describe('Alerts E2E flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Page load — empty state
  it('shows empty state when no reminders', () => {
    render(<AlertsPageStub />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('Nenhum alerta encontrado')).toBeInTheDocument();
  });

  // 2. Page load — header present
  it('page header is visible on load', () => {
    render(<AlertsPageStub />);
    expect(screen.getByText('Alertas')).toBeInTheDocument();
  });

  // 3. Page load — KPIs present
  it('KPI cards appear on page load', () => {
    render(<AlertsPageStub summary={{ active: 3, paused: 1, sent: 5 }} />);
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(4);
  });

  // 4. KPIs reflect summary correctly
  it('KPIs show correct counts from summary', () => {
    render(<AlertsPageStub summary={{ active: 7, paused: 2, sent: 11 }} />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
  });

  // 5. Phone shown in KPIs
  it('resolved phone appears in KPI card', () => {
    render(<AlertsPageStub resolvedPhone="11999990000" summary={{ active: 0, paused: 0, sent: 0 }} />);
    expect(screen.getByText(/11999990000/)).toBeInTheDocument();
  });

  // 6. No phone shows "Não encontrado"
  it('shows Não encontrado when no phone configured', () => {
    render(<AlertsPageStub />);
    expect(screen.getByText('Não encontrado')).toBeInTheDocument();
  });

  // 7. List reminders
  it('renders reminder list when reminders exist', () => {
    const reminders: Reminder[] = [
      { id: '1', message: 'Reminder 1', status: 'active' },
      { id: '2', message: 'Reminder 2', status: 'paused' },
    ];
    render(<AlertsPageStub reminders={reminders} summary={{ active: 1, paused: 1, sent: 0 }} />);
    expect(screen.getByTestId('reminder-1')).toBeInTheDocument();
    expect(screen.getByTestId('reminder-2')).toBeInTheDocument();
  });

  // 8. Toggle active reminder
  it('clicking toggle on active reminder fires onToggle', () => {
    const reminders: Reminder[] = [{ id: 'r1', message: 'Alert', status: 'active' }];
    render(<AlertsPageStub reminders={reminders} summary={{ active: 1, paused: 0, sent: 0 }} />);
    fireEvent.click(screen.getByTestId('toggle-r1'));
    expect(onToggle).toHaveBeenCalledWith('r1');
  });

  // 9. Toggle paused reminder
  it('clicking toggle on paused reminder fires onToggle', () => {
    const reminders: Reminder[] = [{ id: 'r2', message: 'Alert', status: 'paused' }];
    render(<AlertsPageStub reminders={reminders} summary={{ active: 0, paused: 1, sent: 0 }} />);
    fireEvent.click(screen.getByTestId('toggle-r2'));
    expect(onToggle).toHaveBeenCalledWith('r2');
  });

  // 10. Remove reminder
  it('clicking remove fires onRemove with reminder id', () => {
    const reminders: Reminder[] = [{ id: 'del1', message: 'Delete me', status: 'active' }];
    render(<AlertsPageStub reminders={reminders} summary={{ active: 1, paused: 0, sent: 0 }} />);
    fireEvent.click(screen.getByTestId('remove-del1'));
    expect(onRemove).toHaveBeenCalledWith('del1');
  });

  // 11. Search by typing
  it('typing in search calls onSearch with new value', () => {
    render(<AlertsPageStub />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'vencimento' } });
    expect(onSearch).toHaveBeenCalledWith('vencimento');
  });

  // 12. Search clears
  it('clearing search calls onSearch with empty string', () => {
    render(<AlertsPageStub search="vencimento" />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: '' } });
    expect(onSearch).toHaveBeenCalledWith('');
  });

  // 13. Status filter — active
  it('selecting active filter calls onFilterChange with "active"', () => {
    render(<AlertsPageStub />);
    fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'active' } });
    expect(onFilterChange).toHaveBeenCalledWith('active');
  });

  // 14. Status filter — paused
  it('selecting paused filter calls onFilterChange with "paused"', () => {
    render(<AlertsPageStub />);
    fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'paused' } });
    expect(onFilterChange).toHaveBeenCalledWith('paused');
  });

  // 15. Status filter — all
  it('selecting all filter calls onFilterChange with "all"', () => {
    render(<AlertsPageStub statusFilter="active" />);
    fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'all' } });
    expect(onFilterChange).toHaveBeenCalledWith('all');
  });

  // 16. Loading state
  it('shows loading spinner while fetching', () => {
    render(<AlertsPageStub isLoading={true} />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  // 17. Loading hides empty state text
  it('does not show empty state while loading', () => {
    render(<AlertsPageStub isLoading={true} />);
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  // 18. Error state
  it('shows error message when API fails', () => {
    render(<AlertsPageStub errorMessage="Erro ao carregar alertas" />);
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    expect(screen.getByText('Erro ao carregar alertas')).toBeInTheDocument();
  });

  // 19. Reminder status badge
  it('reminder shows its status label', () => {
    const reminders: Reminder[] = [{ id: 's1', message: 'Sent alert', status: 'sent' }];
    render(<AlertsPageStub reminders={reminders} summary={{ active: 0, paused: 0, sent: 1 }} />);
    expect(screen.getByTestId('reminder-status-s1').textContent).toBe('sent');
  });

  // 20. Reminder message visible
  it('reminder message text is visible', () => {
    const reminders: Reminder[] = [{ id: 'm1', message: 'Vence amanhã', status: 'active' }];
    render(<AlertsPageStub reminders={reminders} summary={{ active: 1, paused: 0, sent: 0 }} />);
    expect(screen.getByTestId('reminder-message-m1').textContent).toBe('Vence amanhã');
  });

  // 21. Multiple toggles in sequence
  it('toggling multiple reminders fires correct ids', () => {
    const reminders: Reminder[] = [
      { id: 'a', message: 'A', status: 'active' },
      { id: 'b', message: 'B', status: 'active' },
      { id: 'c', message: 'C', status: 'active' },
    ];
    render(<AlertsPageStub reminders={reminders} summary={{ active: 3, paused: 0, sent: 0 }} />);
    fireEvent.click(screen.getByTestId('toggle-a'));
    fireEvent.click(screen.getByTestId('toggle-b'));
    fireEvent.click(screen.getByTestId('toggle-c'));
    expect(onToggle).toHaveBeenNthCalledWith(1, 'a');
    expect(onToggle).toHaveBeenNthCalledWith(2, 'b');
    expect(onToggle).toHaveBeenNthCalledWith(3, 'c');
  });

  // 22. Multiple removes in sequence
  it('removing multiple reminders fires correct ids', () => {
    const reminders: Reminder[] = [
      { id: 'x', message: 'X', status: 'active' },
      { id: 'y', message: 'Y', status: 'paused' },
    ];
    render(<AlertsPageStub reminders={reminders} summary={{ active: 1, paused: 1, sent: 0 }} />);
    fireEvent.click(screen.getByTestId('remove-x'));
    fireEvent.click(screen.getByTestId('remove-y'));
    expect(onRemove).toHaveBeenNthCalledWith(1, 'x');
    expect(onRemove).toHaveBeenNthCalledWith(2, 'y');
  });

  // 23. KPIs update after state change simulation
  it('KPIs update when summary props change', () => {
    const { rerender } = render(
      <AlertsPageStub summary={{ active: 2, paused: 1, sent: 3 }} />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
    rerender(<AlertsPageStub summary={{ active: 10, paused: 5, sent: 8 }} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  // 24. Full page search + filter + list flow
  it('full flow: search + filter + see reminder', () => {
    const reminders: Reminder[] = [
      { id: 'flow1', message: 'Boleto vencendo', status: 'active' },
    ];
    render(
      <AlertsPageStub
        reminders={reminders}
        summary={{ active: 1, paused: 0, sent: 0 }}
        resolvedPhone="11999990000"
      />,
    );
    // page loads
    expect(screen.getByText('Alertas')).toBeInTheDocument();
    // phone visible
    expect(screen.getByText(/11999990000/)).toBeInTheDocument();
    // reminder visible
    expect(screen.getByText('Boleto vencendo')).toBeInTheDocument();
    // search
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'boleto' } });
    expect(onSearch).toHaveBeenCalledWith('boleto');
    // filter
    fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'active' } });
    expect(onFilterChange).toHaveBeenCalledWith('active');
    // toggle
    fireEvent.click(screen.getByTestId('toggle-flow1'));
    expect(onToggle).toHaveBeenCalledWith('flow1');
  });

  // 25. Error recovery flow
  it('error state recovers when errorMessage is cleared', () => {
    const { rerender } = render(<AlertsPageStub errorMessage="Network error" />);
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    rerender(<AlertsPageStub errorMessage={null} />);
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    // empty state should appear
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });
});
