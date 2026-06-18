import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { GoogleAdsConnectionCard } from '../components/GoogleAdsConnectionCard';
import { ProspectingChannelSelector } from '../components/ProspectingChannelSelector';
import { ProspectingMessageSection } from '../components/ProspectingMessageSection';
import { ProspectingSearchRadarPreview } from '../components/ProspectingSearchRadarPreview';
import { ProspectingCampaignReportsSheet } from '../components/ProspectingCampaignReportsSheet';
import { ProspectingSearchReportsSheet } from '../components/ProspectingSearchReportsSheet';

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

function makeGoogleAdsVm(overrides: Record<string, unknown> = {}) {
  return {
    connection: null,
    accounts: [],
    startMutation: { isPending: false },
    selectAccountMutation: { isPending: false },
    disconnectMutation: { isPending: false },
    accountsQuery: { isLoading: false, refetch: vi.fn() },
    startConnection: vi.fn(),
    selectAccount: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
  };
}

function makeCampaignReportsVm(overrides: Record<string, unknown> = {}) {
  return {
    reportsOpen: true,
    setReportsOpen: vi.fn(),
    reportFilters: {
      query: '',
      statuses: [],
      channels: [],
      audienceTypes: [],
      dateFrom: '',
      dateTo: '',
    },
    setReportFilters: vi.fn(),
    activeReportJob: null,
    generateReportMutation: { isPending: false, mutate: vi.fn() },
    ...overrides,
  };
}

function makeSearchReportsVm(overrides: Record<string, unknown> = {}) {
  return {
    reportsOpen: true,
    setReportsOpen: vi.fn(),
    reportFilters: {
      query: '',
      statuses: [],
      sources: [],
      dateFrom: '',
      dateTo: '',
    },
    setReportFilters: vi.fn(),
    activeReportJob: null,
    generateReportMutation: { isPending: false, mutate: vi.fn() },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GoogleAdsConnectionCard
// ---------------------------------------------------------------------------

describe('GoogleAdsConnectionCard', () => {
  it('renders "não conectado" badge when connection is null', () => {
    render(<GoogleAdsConnectionCard vm={makeGoogleAdsVm()} />);
    expect(screen.getByText('não conectado')).toBeTruthy();
  });

  it('renders "Conectado" badge when status is CONNECTED', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'CONNECTED', connected: true, accountSelected: true, customerId: '123', customerName: 'Acme', googleEmail: 'a@b.com' },
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    expect(screen.getByText('Conectado')).toBeTruthy();
  });

  it('renders "Escolha a conta" badge when status is PENDING_ACCOUNT_SELECTION', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'PENDING_ACCOUNT_SELECTION', connected: false, accountSelected: false },
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    expect(screen.getByText('Escolha a conta')).toBeTruthy();
  });

  it('shows "Conectar Google Ads" button when not connected', () => {
    render(<GoogleAdsConnectionCard vm={makeGoogleAdsVm()} />);
    expect(screen.getByText('Conectar Google Ads')).toBeTruthy();
  });

  it('calls startConnection when connect button is clicked', () => {
    const vm = makeGoogleAdsVm();
    render(<GoogleAdsConnectionCard vm={vm} />);
    fireEvent.click(screen.getByText('Conectar Google Ads'));
    expect(vm.startConnection).toHaveBeenCalledOnce();
  });

  it('disables connect button when startMutation isPending', () => {
    const vm = makeGoogleAdsVm({ startMutation: { isPending: true } });
    render(<GoogleAdsConnectionCard vm={vm} />);
    const button = screen.getByRole('button', { name: /Abrindo Google/i });
    expect(button).toBeDisabled();
  });

  it('shows google email when connected', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'CONNECTED', connected: true, accountSelected: true, googleEmail: 'user@google.com', customerId: '123' },
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    expect(screen.getByText('user@google.com')).toBeTruthy();
  });

  it('shows "Conta Google autorizada" when connected but no googleEmail', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'CONNECTED', connected: true, accountSelected: true, googleEmail: null, customerId: '123' },
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    expect(screen.getByText('Conta Google autorizada')).toBeTruthy();
  });

  it('shows disconnect button when connected', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'CONNECTED', connected: true, accountSelected: true, customerId: '123' },
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    expect(screen.getByText('Desconectar')).toBeTruthy();
  });

  it('calls disconnect when disconnect button is clicked', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'CONNECTED', connected: true, accountSelected: true, customerId: '123' },
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    fireEvent.click(screen.getByText('Desconectar'));
    expect(vm.disconnect).toHaveBeenCalledOnce();
  });

  it('disables disconnect button when disconnectMutation isPending', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'CONNECTED', connected: true, accountSelected: true, customerId: '123' },
      disconnectMutation: { isPending: true },
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    expect(screen.getByRole('button', { name: /Desconectar/i })).toBeDisabled();
  });

  it('renders account selection panel when connected but account not selected', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'PENDING_ACCOUNT_SELECTION', connected: true, accountSelected: false },
      accounts: [{ customerId: 'cid-1', descriptiveName: 'Conta Teste', isManager: false }],
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    expect(screen.getByText('Conta Teste')).toBeTruthy();
  });

  it('renders "Usar esta conta" button for each account', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'PENDING_ACCOUNT_SELECTION', connected: true, accountSelected: false },
      accounts: [
        { customerId: 'cid-1', descriptiveName: 'Conta 1', isManager: false },
        { customerId: 'cid-2', descriptiveName: 'Conta 2', isManager: true },
      ],
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    expect(screen.getAllByText('Usar esta conta')).toHaveLength(2);
  });

  it('calls selectAccount with customerId when account selected', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'PENDING_ACCOUNT_SELECTION', connected: true, accountSelected: false },
      accounts: [{ customerId: 'cid-1', descriptiveName: 'Conta 1', isManager: false }],
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    fireEvent.click(screen.getByText('Usar esta conta'));
    expect(vm.selectAccount).toHaveBeenCalledWith('cid-1');
  });

  it('shows manager label for manager accounts', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'PENDING_ACCOUNT_SELECTION', connected: true, accountSelected: false },
      accounts: [{ customerId: 'cid-1', descriptiveName: 'Manager', isManager: true }],
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    expect(screen.getByText(/conta manager/i)).toBeTruthy();
  });

  it('shows empty message when accounts list is empty and not loading', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'PENDING_ACCOUNT_SELECTION', connected: true, accountSelected: false },
      accounts: [],
      accountsQuery: { isLoading: false, refetch: vi.fn() },
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    expect(screen.getByText(/Nenhuma conta/i)).toBeTruthy();
  });

  it('calls accountsQuery.refetch when refresh button clicked', () => {
    const refetch = vi.fn();
    const vm = makeGoogleAdsVm({
      connection: { status: 'PENDING_ACCOUNT_SELECTION', connected: true, accountSelected: false },
      accounts: [],
      accountsQuery: { isLoading: false, refetch },
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    fireEvent.click(screen.getByText('Atualizar'));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows selected customer name when account is selected', () => {
    const vm = makeGoogleAdsVm({
      connection: { status: 'CONNECTED', connected: true, accountSelected: true, customerId: 'cid-1', customerName: 'Minha Empresa' },
    });
    render(<GoogleAdsConnectionCard vm={vm} />);
    expect(screen.getByText(/Minha Empresa/i)).toBeTruthy();
  });

  it('renders "conexão Google Ads" heading', () => {
    render(<GoogleAdsConnectionCard vm={makeGoogleAdsVm()} />);
    expect(screen.getByText('conexão Google Ads')).toBeTruthy();
  });

  it('does not show disconnect button when not connected', () => {
    render(<GoogleAdsConnectionCard vm={makeGoogleAdsVm()} />);
    expect(screen.queryByText('Desconectar')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ProspectingChannelSelector
// ---------------------------------------------------------------------------

describe('ProspectingChannelSelector', () => {
  it('renders WhatsApp option', () => {
    render(<ProspectingChannelSelector mode="single" value="WHATSAPP" onChange={vi.fn()} />);
    expect(screen.getByText('WhatsApp')).toBeTruthy();
  });

  it('renders Instagram option', () => {
    render(<ProspectingChannelSelector mode="single" value="WHATSAPP" onChange={vi.fn()} />);
    expect(screen.getByText('Instagram')).toBeTruthy();
  });

  it('renders LinkedIn as disabled', () => {
    render(<ProspectingChannelSelector mode="single" value="WHATSAPP" onChange={vi.fn()} />);
    const linkedInBtn = screen.getByRole('button', { name: /LinkedIn/i });
    expect(linkedInBtn).toBeDisabled();
  });

  it('renders "Em breve" badge for LinkedIn', () => {
    render(<ProspectingChannelSelector mode="single" value="WHATSAPP" onChange={vi.fn()} />);
    expect(screen.getByText('Em breve')).toBeTruthy();
  });

  it('calls onChange with WHATSAPP in single mode', () => {
    const onChange = vi.fn();
    render(<ProspectingChannelSelector mode="single" value="INSTAGRAM" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /WhatsApp/i }));
    expect(onChange).toHaveBeenCalledWith('WHATSAPP');
  });

  it('calls onChange with INSTAGRAM in single mode', () => {
    const onChange = vi.fn();
    render(<ProspectingChannelSelector mode="single" value="WHATSAPP" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Instagram/i }));
    expect(onChange).toHaveBeenCalledWith('INSTAGRAM');
  });

  it('does not call onChange when LinkedIn is clicked', () => {
    const onChange = vi.fn();
    render(<ProspectingChannelSelector mode="single" value="WHATSAPP" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /LinkedIn/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders checkboxes in multiple mode', () => {
    render(<ProspectingChannelSelector mode="multiple" value={['WHATSAPP']} onChange={vi.fn()} />);
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  it('no checkboxes in single mode', () => {
    render(<ProspectingChannelSelector mode="single" value="WHATSAPP" onChange={vi.fn()} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('active channel has primary styling in single mode', () => {
    render(<ProspectingChannelSelector mode="single" value="WHATSAPP" onChange={vi.fn()} />);
    const whatsappBtn = screen.getByRole('button', { name: /WhatsApp/i });
    expect(whatsappBtn.className).toContain('text-primary');
  });

  it('calls onChange in multiple mode when INSTAGRAM clicked', () => {
    const onChange = vi.fn();
    render(<ProspectingChannelSelector mode="multiple" value={['WHATSAPP']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Instagram/i }));
    expect(onChange).toHaveBeenCalledWith('INSTAGRAM');
  });

  it('renders 3 channel options total', () => {
    render(<ProspectingChannelSelector mode="single" value="WHATSAPP" onChange={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// ProspectingMessageSection
// ---------------------------------------------------------------------------

describe('ProspectingMessageSection', () => {
  const defaultProps = {
    id: 'msg-1',
    description: 'Mensagem de prospecção',
    value: '',
    placeholder: 'Digite aqui...',
    onChange: vi.fn(),
    onSuggest: vi.fn(),
  };

  it('renders label', () => {
    render(<ProspectingMessageSection {...defaultProps} />);
    expect(screen.getByText('Mensagem base')).toBeTruthy();
  });

  it('renders custom label', () => {
    render(<ProspectingMessageSection {...defaultProps} label="Minha label" />);
    expect(screen.getByText('Minha label')).toBeTruthy();
  });

  it('renders description', () => {
    render(<ProspectingMessageSection {...defaultProps} />);
    expect(screen.getByText('Mensagem de prospecção')).toBeTruthy();
  });

  it('renders "Gerar com IA" button', () => {
    render(<ProspectingMessageSection {...defaultProps} />);
    expect(screen.getByText('Gerar com IA')).toBeTruthy();
  });

  it('renders "Gerando..." when isSuggesting', () => {
    render(<ProspectingMessageSection {...defaultProps} isSuggesting={true} />);
    expect(screen.getByText('Gerando...')).toBeTruthy();
  });

  it('disables suggest button when isSuggesting', () => {
    render(<ProspectingMessageSection {...defaultProps} isSuggesting={true} />);
    expect(screen.getByRole('button', { name: /Gerando/i })).toBeDisabled();
  });

  it('calls onSuggest when button clicked', () => {
    const onSuggest = vi.fn();
    render(<ProspectingMessageSection {...defaultProps} onSuggest={onSuggest} />);
    fireEvent.click(screen.getByText('Gerar com IA'));
    expect(onSuggest).toHaveBeenCalledOnce();
  });

  it('calls onChange when textarea value changes', () => {
    const onChange = vi.fn();
    render(<ProspectingMessageSection {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'novo texto' } });
    expect(onChange).toHaveBeenCalledWith('novo texto');
  });

  it('renders textarea with placeholder', () => {
    render(<ProspectingMessageSection {...defaultProps} placeholder="Escreva aqui" />);
    expect(screen.getByPlaceholderText('Escreva aqui')).toBeTruthy();
  });

  it('renders textarea with provided value', () => {
    render(<ProspectingMessageSection {...defaultProps} value="texto inicial" />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('texto inicial');
  });
});

// ---------------------------------------------------------------------------
// ProspectingSearchRadarPreview
// ---------------------------------------------------------------------------

describe('ProspectingSearchRadarPreview', () => {
  it('renders fallback when no location provided', () => {
    render(<ProspectingSearchRadarPreview />);
    expect(screen.getByText('Defina a localidade da busca')).toBeTruthy();
  });

  it('renders map iframe when city is provided', () => {
    render(<ProspectingSearchRadarPreview city="São Paulo" businessTypeQuery="academia" />);
    expect(screen.getByTitle(/Mapa da região/i)).toBeTruthy();
  });

  it('renders business type query', () => {
    render(<ProspectingSearchRadarPreview businessTypeQuery="academia" city="SP" />);
    expect(screen.getByText('academia')).toBeTruthy();
  });

  it('shows fallback business type text when not provided', () => {
    render(<ProspectingSearchRadarPreview />);
    expect(screen.getByText('Defina o tipo de negócio')).toBeTruthy();
  });

  it('builds territory from neighborhood, city and state', () => {
    render(
      <ProspectingSearchRadarPreview city="Campinas" neighborhood="Cambuí" state="SP" />,
    );
    expect(screen.getByText('Cambuí, Campinas, SP')).toBeTruthy();
  });

  it('shows only city when neighborhood and state are missing', () => {
    render(<ProspectingSearchRadarPreview city="Recife" />);
    expect(screen.getByText('Recife')).toBeTruthy();
  });

  it('renders default maxResults of 20', () => {
    render(<ProspectingSearchRadarPreview />);
    expect(screen.getByText('Até 20 empresas')).toBeTruthy();
  });

  it('renders custom maxResults', () => {
    render(<ProspectingSearchRadarPreview maxResults="50" />);
    expect(screen.getByText('Até 50 empresas')).toBeTruthy();
  });

  it('renders "Região alvo" label on map', () => {
    render(<ProspectingSearchRadarPreview city="BH" businessTypeQuery="academia" />);
    expect(screen.getByText('Região alvo')).toBeTruthy();
  });

  it('does not render iframe when no location', () => {
    render(<ProspectingSearchRadarPreview businessTypeQuery="academia" />);
    expect(screen.queryByTitle(/Mapa da região/i)).toBeNull();
  });

  it('renders localidade card', () => {
    render(<ProspectingSearchRadarPreview />);
    expect(screen.getByText(/Localidade/i)).toBeTruthy();
  });

  it('renders captação card with empresa count', () => {
    render(<ProspectingSearchRadarPreview maxResults="30" />);
    expect(screen.getByText('Até 30 empresas')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ProspectingCampaignReportsSheet
// ---------------------------------------------------------------------------

describe('ProspectingCampaignReportsSheet', () => {
  it('renders sheet title', () => {
    render(<ProspectingCampaignReportsSheet vm={makeCampaignReportsVm()} />);
    expect(screen.getByText('relatórios de campanhas')).toBeTruthy();
  });

  it('renders Baixar CSV button', () => {
    render(<ProspectingCampaignReportsSheet vm={makeCampaignReportsVm()} />);
    expect(screen.getByText('Baixar CSV')).toBeTruthy();
  });

  it('calls generateReportMutation.mutate when button clicked', () => {
    const vm = makeCampaignReportsVm();
    render(<ProspectingCampaignReportsSheet vm={vm} />);
    fireEvent.click(screen.getByText('Baixar CSV'));
    expect(vm.generateReportMutation.mutate).toHaveBeenCalledOnce();
  });

  it('shows "Enfileirando..." when mutation is pending', () => {
    const vm = makeCampaignReportsVm({
      generateReportMutation: { isPending: true, mutate: vi.fn() },
    });
    render(<ProspectingCampaignReportsSheet vm={vm} />);
    expect(screen.getByText('Enfileirando...')).toBeTruthy();
  });

  it('calls setReportsOpen(false) when Fechar clicked', () => {
    const vm = makeCampaignReportsVm();
    render(<ProspectingCampaignReportsSheet vm={vm} />);
    fireEvent.click(screen.getByText('Fechar'));
    expect(vm.setReportsOpen).toHaveBeenCalledWith(false);
  });

  it('renders query input', () => {
    render(<ProspectingCampaignReportsSheet vm={makeCampaignReportsVm()} />);
    expect(screen.getByPlaceholderText(/Nome ou objetivo/i)).toBeTruthy();
  });

  it('calls setReportFilters on query input change', () => {
    const vm = makeCampaignReportsVm();
    render(<ProspectingCampaignReportsSheet vm={vm} />);
    fireEvent.change(screen.getByPlaceholderText(/Nome ou objetivo/i), {
      target: { value: 'test' },
    });
    expect(vm.setReportFilters).toHaveBeenCalled();
  });

  it('shows active job status badge when activeReportJob exists', () => {
    const vm = makeCampaignReportsVm({
      activeReportJob: {
        status: 'PROCESSING',
        progress: 50,
        totalItems: 100,
        processedItems: 50,
        fileName: null,
        errorMessage: null,
      },
    });
    render(<ProspectingCampaignReportsSheet vm={vm} />);
    expect(screen.getByText('PROCESSING')).toBeTruthy();
  });

  it('shows progress percentage badge', () => {
    const vm = makeCampaignReportsVm({
      activeReportJob: {
        status: 'QUEUED',
        progress: 0,
        totalItems: 0,
        processedItems: 0,
        fileName: null,
        errorMessage: null,
      },
    });
    render(<ProspectingCampaignReportsSheet vm={vm} />);
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('shows queued message', () => {
    const vm = makeCampaignReportsVm({
      activeReportJob: {
        status: 'QUEUED',
        progress: 0,
        totalItems: 0,
        processedItems: 0,
        fileName: null,
        errorMessage: null,
      },
    });
    render(<ProspectingCampaignReportsSheet vm={vm} />);
    expect(screen.getByText(/entrou na fila/i)).toBeTruthy();
  });

  it('shows completed message with fileName', () => {
    const vm = makeCampaignReportsVm({
      activeReportJob: {
        status: 'COMPLETED',
        progress: 100,
        totalItems: 10,
        processedItems: 10,
        fileName: 'export.csv',
        errorMessage: null,
      },
    });
    render(<ProspectingCampaignReportsSheet vm={vm} />);
    expect(screen.getByText(/export\.csv/i)).toBeTruthy();
  });

  it('shows failed error message', () => {
    const vm = makeCampaignReportsVm({
      activeReportJob: {
        status: 'FAILED',
        progress: 0,
        totalItems: 0,
        processedItems: 0,
        fileName: null,
        errorMessage: 'Erro de processamento',
      },
    });
    render(<ProspectingCampaignReportsSheet vm={vm} />);
    expect(screen.getByText('Erro de processamento')).toBeTruthy();
  });

  it('renders date range inputs', () => {
    render(<ProspectingCampaignReportsSheet vm={makeCampaignReportsVm()} />);
    expect(screen.getByText('Data inicial')).toBeTruthy();
    expect(screen.getByText('Data final')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ProspectingSearchReportsSheet
// ---------------------------------------------------------------------------

describe('ProspectingSearchReportsSheet', () => {
  it('renders sheet title', () => {
    render(<ProspectingSearchReportsSheet vm={makeSearchReportsVm()} />);
    expect(screen.getByText('relatórios de prospeccao local')).toBeTruthy();
  });

  it('renders Baixar CSV button', () => {
    render(<ProspectingSearchReportsSheet vm={makeSearchReportsVm()} />);
    expect(screen.getByText('Baixar CSV')).toBeTruthy();
  });

  it('calls generateReportMutation.mutate when button clicked', () => {
    const vm = makeSearchReportsVm();
    render(<ProspectingSearchReportsSheet vm={vm} />);
    fireEvent.click(screen.getByText('Baixar CSV'));
    expect(vm.generateReportMutation.mutate).toHaveBeenCalledOnce();
  });

  it('shows "Enfileirando..." when mutation is pending', () => {
    const vm = makeSearchReportsVm({
      generateReportMutation: { isPending: true, mutate: vi.fn() },
    });
    render(<ProspectingSearchReportsSheet vm={vm} />);
    expect(screen.getByText('Enfileirando...')).toBeTruthy();
  });

  it('calls setReportsOpen(false) when Fechar clicked', () => {
    const vm = makeSearchReportsVm();
    render(<ProspectingSearchReportsSheet vm={vm} />);
    fireEvent.click(screen.getByText('Fechar'));
    expect(vm.setReportsOpen).toHaveBeenCalledWith(false);
  });

  it('renders query input', () => {
    render(<ProspectingSearchReportsSheet vm={makeSearchReportsVm()} />);
    expect(screen.getByPlaceholderText(/Segmento/i)).toBeTruthy();
  });

  it('calls setReportFilters on query input change', () => {
    const vm = makeSearchReportsVm();
    render(<ProspectingSearchReportsSheet vm={vm} />);
    fireEvent.change(screen.getByPlaceholderText(/Segmento/i), {
      target: { value: 'academia' },
    });
    expect(vm.setReportFilters).toHaveBeenCalled();
  });

  it('shows PROCESSING badge when job is processing', () => {
    const vm = makeSearchReportsVm({
      activeReportJob: {
        status: 'PROCESSING',
        progress: 30,
        totalItems: 100,
        processedItems: 30,
        fileName: null,
        errorMessage: null,
      },
    });
    render(<ProspectingSearchReportsSheet vm={vm} />);
    expect(screen.getByText('PROCESSING')).toBeTruthy();
  });

  it('renders date range inputs', () => {
    render(<ProspectingSearchReportsSheet vm={makeSearchReportsVm()} />);
    expect(screen.getByText('Data inicial')).toBeTruthy();
    expect(screen.getByText('Data final')).toBeTruthy();
  });

  it('shows no job section when activeReportJob is null', () => {
    render(<ProspectingSearchReportsSheet vm={makeSearchReportsVm()} />);
    expect(screen.queryByText(/entrou na fila/i)).toBeNull();
  });

  it('renders sheet description', () => {
    render(<ProspectingSearchReportsSheet vm={makeSearchReportsVm()} />);
    expect(screen.getByText(/Exporte um CSV/i)).toBeTruthy();
  });
});
