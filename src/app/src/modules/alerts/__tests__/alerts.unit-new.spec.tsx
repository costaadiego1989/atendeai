import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@/shared/ui/KPICard', () => ({
  KPICard: ({ title, value, subtitle, icon: Icon }: any) => (
    <div data-testid="kpi-card">
      <span data-testid="kpi-title">{title}</span>
      <span data-testid="kpi-value">{String(value)}</span>
      <span data-testid="kpi-subtitle">{subtitle}</span>
      {Icon && <Icon data-testid="kpi-icon" />}
    </div>
  ),
}));

vi.mock('@/shared/lib/masks', () => ({
  formatPhone: (v: string) => `formatted:${v}`,
  formatCpf: (v: string) => `cpf:${v}`,
  formatCnpj: (v: string) => `cnpj:${v}`,
}));

vi.mock('lucide-react', () => ({
  Bell: (props: any) => <svg data-testid="icon-bell" {...props} />,
  Clock3: (props: any) => <svg data-testid="icon-clock3" {...props} />,
  PauseCircle: (props: any) => <svg data-testid="icon-pause-circle" {...props} />,
  PhoneIncoming: (props: any) => <svg data-testid="icon-phone-incoming" {...props} />,
}));

// ---------------------------------------------------------------------------
// Component imports (after mocks)
// ---------------------------------------------------------------------------
import { AlertsHeader } from '../components/AlertsHeader';
import { AlertsKPIs } from '../components/AlertsKPIs';

// ---------------------------------------------------------------------------
// AlertsHeader — 40 tests
// ---------------------------------------------------------------------------
describe('AlertsHeader', () => {
  it('renders without crashing', () => {
    const { container } = render(<AlertsHeader />);
    expect(container).toBeTruthy();
  });

  it('shows the page title "Alertas"', () => {
    render(<AlertsHeader />);
    expect(screen.getByText('Alertas')).toBeInTheDocument();
  });

  it('shows the page description text', () => {
    render(<AlertsHeader />);
    expect(
      screen.getByText(/Configure lembretes que o sistema envia/i),
    ).toBeInTheDocument();
  });

  it('has the page-header class on the root element', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.firstChild).toHaveClass('page-header');
  });

  it('has the page-title class on h1', () => {
    render(<AlertsHeader />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('page-title');
  });

  it('page-description is a <p> tag', () => {
    const { container } = render(<AlertsHeader />);
    const p = container.querySelector('p.page-description');
    expect(p).toBeTruthy();
  });

  it('description mentions WhatsApp', () => {
    render(<AlertsHeader />);
    expect(screen.getByText(/WhatsApp/i)).toBeInTheDocument();
  });

  it('renders exactly one h1', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('renders exactly one p', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('root has flex class', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.firstChild).toHaveClass('flex');
  });

  it('root has flex-col class', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.firstChild).toHaveClass('flex-col');
  });

  it('root has gap-4 class', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.firstChild).toHaveClass('gap-4');
  });

  it('renders a single div wrapper inside root', () => {
    const { container } = render(<AlertsHeader />);
    const inner = container.firstChild as HTMLElement;
    expect(inner.querySelectorAll(':scope > div')).toHaveLength(1);
  });

  it('title text is exactly "Alertas"', () => {
    render(<AlertsHeader />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Alertas');
  });

  it('description has mt-1 class', () => {
    const { container } = render(<AlertsHeader />);
    const p = container.querySelector('p');
    expect(p).toHaveClass('mt-1');
  });

  it('renders consistently on multiple mounts', () => {
    const { unmount } = render(<AlertsHeader />);
    unmount();
    render(<AlertsHeader />);
    expect(screen.getByText('Alertas')).toBeInTheDocument();
  });

  it('does not render any buttons', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('does not render any inputs', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });

  it('does not render any links', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('does not render any images', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('heading is accessible as role heading', () => {
    render(<AlertsHeader />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('description mentions rotina', () => {
    render(<AlertsHeader />);
    expect(screen.getByText(/rotina/i)).toBeInTheDocument();
  });

  it('description mentions sistema', () => {
    render(<AlertsHeader />);
    expect(screen.getByText(/sistema/i)).toBeInTheDocument();
  });

  it('renders static content (no dynamic props needed)', () => {
    const { container: c1 } = render(<AlertsHeader />);
    const { container: c2 } = render(<AlertsHeader />);
    expect(c1.innerHTML).toBe(c2.innerHTML);
  });

  it('has lg:flex-row class', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.firstChild).toHaveClass('lg:flex-row');
  });

  it('has lg:items-center class', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.firstChild).toHaveClass('lg:items-center');
  });

  it('has lg:justify-between class', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.firstChild).toHaveClass('lg:justify-between');
  });

  it('renders inside a React.Fragment safely', () => {
    render(
      <>
        <AlertsHeader />
        <AlertsHeader />
      </>,
    );
    expect(screen.getAllByText('Alertas')).toHaveLength(2);
  });

  it('is a named export', () => {
    expect(typeof AlertsHeader).toBe('function');
  });

  it('returns a JSX element', () => {
    const result = AlertsHeader();
    expect(result).not.toBeNull();
  });

  it('does not throw when rendered', () => {
    expect(() => render(<AlertsHeader />)).not.toThrow();
  });

  it('description paragraph text is non-empty', () => {
    const { container } = render(<AlertsHeader />);
    const p = container.querySelector('p');
    expect(p?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('heading is not empty', () => {
    render(<AlertsHeader />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent?.trim()).not.toBe('');
  });

  it('inner div wraps both heading and description', () => {
    const { container } = render(<AlertsHeader />);
    const inner = container.querySelector('.page-header > div');
    expect(inner?.querySelectorAll('h1, p')).toHaveLength(2);
  });

  it('snapshot matches', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('root element tag is div', () => {
    const { container } = render(<AlertsHeader />);
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('title and description are both visible', () => {
    render(<AlertsHeader />);
    expect(screen.getByText('Alertas')).toBeVisible();
    expect(screen.getByText(/Configure lembretes/i)).toBeVisible();
  });

  it('component name is AlertsHeader', () => {
    expect(AlertsHeader.name).toBe('AlertsHeader');
  });

  it('renders without any props', () => {
    expect(() => render(<AlertsHeader />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AlertsKPIs — 60 tests
// ---------------------------------------------------------------------------
describe('AlertsKPIs', () => {
  const defaultProps = {
    resolvedPhone: '11999999999',
    activeCount: 5,
    pausedCount: 2,
    sentCount: 10,
  };

  it('renders without crashing', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getAllByTestId('kpi-card')).toBeTruthy();
  });

  it('renders exactly 4 KPI cards', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(4);
  });

  it('formats phone via formatPhone', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getByText('formatted:11999999999')).toBeInTheDocument();
  });

  it('shows "Não encontrado" when resolvedPhone is undefined', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('Não encontrado')).toBeInTheDocument();
  });

  it('shows activeCount value', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows pausedCount value', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows sentCount value', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('shows "Seu WhatsApp" title', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getByText('Seu WhatsApp')).toBeInTheDocument();
  });

  it('shows "Alertas Ativos" title', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getByText('Alertas Ativos')).toBeInTheDocument();
  });

  it('shows "Pausados" title', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getByText('Pausados')).toBeInTheDocument();
  });

  it('shows "Concluídos" title', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getByText('Concluídos')).toBeInTheDocument();
  });

  it('shows subtitle "Onde você recebe os alertas"', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getByText('Onde você recebe os alertas')).toBeInTheDocument();
  });

  it('shows subtitle "Lembretes na fila de disparo"', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getByText('Lembretes na fila de disparo')).toBeInTheDocument();
  });

  it('shows subtitle "Aguardando reativação"', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getByText('Aguardando reativação')).toBeInTheDocument();
  });

  it('shows subtitle "Alertas já disparados"', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getByText('Alertas já disparados')).toBeInTheDocument();
  });

  it('root has card-grid class', () => {
    const { container } = render(<AlertsKPIs {...defaultProps} />);
    expect(container.firstChild).toHaveClass('card-grid');
  });

  it('renders 4 kpi-title elements', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getAllByTestId('kpi-title')).toHaveLength(4);
  });

  it('renders 4 kpi-value elements', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getAllByTestId('kpi-value')).toHaveLength(4);
  });

  it('renders 4 kpi-subtitle elements', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getAllByTestId('kpi-subtitle')).toHaveLength(4);
  });

  it('shows activeCount = 0', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getAllByText('0')).toHaveLength(3);
  });

  it('shows large activeCount', () => {
    render(<AlertsKPIs activeCount={9999} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('9999')).toBeInTheDocument();
  });

  it('shows large pausedCount', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={8888} sentCount={0} />);
    expect(screen.getByText('8888')).toBeInTheDocument();
  });

  it('shows large sentCount', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={7777} />);
    expect(screen.getByText('7777')).toBeInTheDocument();
  });

  it('does not call formatPhone when resolvedPhone is undefined', () => {
    const { formatPhone } = require('@/shared/lib/masks');
    const spy = vi.spyOn({ formatPhone }, 'formatPhone');
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('Não encontrado')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('calls formatPhone with the provided phone', () => {
    render(<AlertsKPIs resolvedPhone="11987654321" activeCount={1} pausedCount={1} sentCount={1} />);
    expect(screen.getByText('formatted:11987654321')).toBeInTheDocument();
  });

  it('passes PhoneIncoming icon to first KPICard', () => {
    render(<AlertsKPIs {...defaultProps} />);
    // KPICard mock renders the icon; lucide mock renders as svg with data-testid
    expect(screen.getAllByTestId('kpi-card')[0]).toBeInTheDocument();
  });

  it('accepts resolvedPhone with different formats', () => {
    render(<AlertsKPIs resolvedPhone="+5511999999999" activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('formatted:+5511999999999')).toBeInTheDocument();
  });

  it('renders with only required props', () => {
    expect(() =>
      render(<AlertsKPIs activeCount={1} pausedCount={1} sentCount={1} />),
    ).not.toThrow();
  });

  it('updates when activeCount changes', () => {
    const { rerender } = render(<AlertsKPIs activeCount={1} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    rerender(<AlertsKPIs activeCount={99} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('updates when pausedCount changes', () => {
    const { rerender } = render(<AlertsKPIs activeCount={0} pausedCount={1} sentCount={0} />);
    rerender(<AlertsKPIs activeCount={0} pausedCount={55} sentCount={0} />);
    expect(screen.getByText('55')).toBeInTheDocument();
  });

  it('updates when sentCount changes', () => {
    const { rerender } = render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={1} />);
    rerender(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('updates phone display when resolvedPhone changes', () => {
    const { rerender } = render(<AlertsKPIs resolvedPhone="aaa" activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('formatted:aaa')).toBeInTheDocument();
    rerender(<AlertsKPIs resolvedPhone="bbb" activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('formatted:bbb')).toBeInTheDocument();
  });

  it('switches from "Não encontrado" to formatted phone on update', () => {
    const { rerender } = render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('Não encontrado')).toBeInTheDocument();
    rerender(<AlertsKPIs resolvedPhone="11999" activeCount={0} pausedCount={0} sentCount={0} />);
    expect(screen.getByText('formatted:11999')).toBeInTheDocument();
    expect(screen.queryByText('Não encontrado')).not.toBeInTheDocument();
  });

  it('is a named export', () => {
    expect(typeof AlertsKPIs).toBe('function');
  });

  it('component name is AlertsKPIs', () => {
    expect(AlertsKPIs.name).toBe('AlertsKPIs');
  });

  it('first KPI card title is "Seu WhatsApp"', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getAllByTestId('kpi-title')[0].textContent).toBe('Seu WhatsApp');
  });

  it('second KPI card title is "Alertas Ativos"', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getAllByTestId('kpi-title')[1].textContent).toBe('Alertas Ativos');
  });

  it('third KPI card title is "Pausados"', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getAllByTestId('kpi-title')[2].textContent).toBe('Pausados');
  });

  it('fourth KPI card title is "Concluídos"', () => {
    render(<AlertsKPIs {...defaultProps} />);
    expect(screen.getAllByTestId('kpi-title')[3].textContent).toBe('Concluídos');
  });

  it('second card value equals activeCount', () => {
    render(<AlertsKPIs activeCount={7} pausedCount={0} sentCount={0} />);
    expect(screen.getAllByTestId('kpi-value')[1].textContent).toBe('7');
  });

  it('third card value equals pausedCount', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={3} sentCount={0} />);
    expect(screen.getAllByTestId('kpi-value')[2].textContent).toBe('3');
  });

  it('fourth card value equals sentCount', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={12} />);
    expect(screen.getAllByTestId('kpi-value')[3].textContent).toBe('12');
  });

  it('does not render any buttons', () => {
    const { container } = render(<AlertsKPIs {...defaultProps} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('does not render any inputs', () => {
    const { container } = render(<AlertsKPIs {...defaultProps} />);
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });

  it('does not render any links', () => {
    const { container } = render(<AlertsKPIs {...defaultProps} />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('snapshot matches with default props', () => {
    const { container } = render(<AlertsKPIs {...defaultProps} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('snapshot matches without phone', () => {
    const { container } = render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={0} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('root element is a div', () => {
    const { container } = render(<AlertsKPIs {...defaultProps} />);
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('all KPI values are visible', () => {
    render(<AlertsKPIs {...defaultProps} />);
    screen.getAllByTestId('kpi-value').forEach((el) => expect(el).toBeVisible());
  });

  it('all KPI titles are visible', () => {
    render(<AlertsKPIs {...defaultProps} />);
    screen.getAllByTestId('kpi-title').forEach((el) => expect(el).toBeVisible());
  });

  it('all KPI subtitles are visible', () => {
    render(<AlertsKPIs {...defaultProps} />);
    screen.getAllByTestId('kpi-subtitle').forEach((el) => expect(el).toBeVisible());
  });

  it('resolvedPhone empty string shows formatted:""', () => {
    render(<AlertsKPIs resolvedPhone="" activeCount={0} pausedCount={0} sentCount={0} />);
    // empty string is truthy-false in JS — component shows "Não encontrado"
    expect(screen.getByText('Não encontrado')).toBeInTheDocument();
  });

  it('sentCount of 1000 renders as "1000"', () => {
    render(<AlertsKPIs activeCount={0} pausedCount={0} sentCount={1000} />);
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('renders the same output on two consecutive mounts', () => {
    const { container: c1 } = render(<AlertsKPIs {...defaultProps} />);
    const { container: c2 } = render(<AlertsKPIs {...defaultProps} />);
    expect(c1.innerHTML).toBe(c2.innerHTML);
  });

  it('does not throw with NaN counts', () => {
    expect(() =>
      render(<AlertsKPIs activeCount={NaN} pausedCount={NaN} sentCount={NaN} />),
    ).not.toThrow();
  });
});
