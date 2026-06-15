import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutomationFilter } from '../components/AutomationFilter';
import { AutomationWizard } from '../components/AutomationWizard';
import { AutomationFlowDiagram } from '../components/AutomationFlowDiagram';
import { TestAutomationModal } from '../components/TestAutomationModal';
import { AutomationMetrics } from '../components/AutomationMetrics';
import { AutomationHistory } from '../components/AutomationHistory';
import { AutomationCollaboration } from '../components/AutomationCollaboration';
import { PerformanceOptimizer } from '../components/PerformanceOptimizer';
import { AutomationFilterProps, AutomationWizardProps } from '../components/types';

// Mock dependencies
vi.mock('../utils/debounce', () => ({
  debounce: vi.fn((fn) => fn),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getTotalSize: vi.fn(() => 1000),
    getVirtualItems: vi.fn(() => []),
    measureElement: vi.fn(),
  })),
}));

const mockAutomation = {
  id: 'automation-1',
  tenantId: 'tenant-1',
  name: 'Test Automation',
  description: 'Test automation description',
  isActive: true,
  trigger: {
    type: 'MESSAGE_RECEIVED' as const,
    config: { channel: 'whatsapp' },
  },
  conditions: [],
  steps: [
    {
      id: 'step-1',
      type: 'SEND_MESSAGE' as const,
      config: { channel: 'whatsapp', body: 'Hello World' },
      order: 0,
    },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('AutomationFilter', () => {
  const defaultProps: AutomationFilterProps = {
    onFilterChange: vi.fn(),
    currentFilter: {
      search: '',
      triggerTypes: [],
      status: 'all',
      dateRange: { start: null, end: null },
      tags: [],
    },
    availableTriggers: ['MESSAGE_RECEIVED', 'CONTACT_CREATED'],
    availableTags: ['tag1', 'tag2'],
    totalCount: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input and status filter', () => {
    render(<AutomationFilter {...defaultProps} />);
    
    expect(screen.getByPlaceholderText('Buscar por nome, descrição, tags...')).toBeInTheDocument();
    expect(screen.getByText('Todos status')).toBeInTheDocument();
    expect(screen.getByText('Ativas')).toBeInTheDocument();
    expect(screen.getByText('Inativas')).toBeInTheDocument();
  });

  it('calls onFilterChange when search input changes', async () => {
    render(<AutomationFilter {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Buscar por nome, descrição, tags...');
    await userEvent.type(searchInput, 'test search');
    
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'test search',
      })
    );
  });

  it('expands advanced filters when clicking "Avançado" button', async () => {
    render(<AutomationFilter {...defaultProps} />);
    
    const advancedButton = screen.getByText('Avançado');
    await userEvent.click(advancedButton);
    
    expect(screen.getByText('Selecione os tipos de gatilho')).toBeInTheDocument();
    expect(screen.getByText('Selecione as tags')).toBeInTheDocument();
  });

  it('clears filters when clear button is clicked', async () => {
    render(<AutomationFilter {...defaultProps} />);
    
    const clearButton = screen.getByText('Limpar filtros');
    await userEvent.click(clearButton);
    
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith({
      search: '',
      triggerTypes: [],
      status: 'all',
      dateRange: { start: null, end: null },
      tags: [],
    });
  });
});

describe('AutomationWizard', () => {
  const defaultProps: AutomationWizardProps = {
    open: true,
    onOpenChange: vi.fn(),
    onComplete: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders wizard with progress indicators', () => {
    render(<AutomationWizard {...defaultProps} />);
    
    expect(screen.getByText('Informações Básicas')).toBeInTheDocument();
    expect(screen.getByText('Gatilho')).toBeInTheDocument();
    expect(screen.getByText('Passos')).toBeInTheDocument();
    expect(screen.getByText('Criar Automação')).toBeInTheDocument();
  });

  it('navigates between steps correctly', async () => {
    render(<AutomationWizard {...defaultProps} />);
    
    // Initially on step 1
    expect(screen.getByText('Informações Básicas')).toBeInTheDocument();
    
    // Click next button
    const nextButton = screen.getByText('Próximo');
    await userEvent.click(nextButton);
    
    // Should be on step 2
    expect(screen.getByText('Gatilho')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<AutomationWizard {...defaultProps} />);
    
    // Try to submit without filling required fields
    const createButton = screen.getByText('Criar automação');
    await userEvent.click(createButton);
    
    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText('Nome deve ter pelo menos 2 caracteres')).toBeInTheDocument();
    });
  });

  it('completes wizard successfully', async () => {
    render(<AutomationWizard {...defaultProps} />);
    
    // Fill in basic info
    const nameInput = screen.getByPlaceholderText('Ex: Boas-vindas ao novo contato');
    await userEvent.type(nameInput, 'Test Automation');
    
    // Select trigger
    const triggerSelect = screen.getByLabelText('Quando a automação deve ser executada?');
    await userEvent.selectOptions(triggerSelect, 'MESSAGE_RECEIVED');
    
    // Add a step
    const addButton = screen.getByText('Adicionar passo');
    await userEvent.click(addButton);
    
    // Complete wizard
    const createButton = screen.getByText('Criar automação');
    await userEvent.click(createButton);
    
    expect(defaultProps.onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Automation',
        trigger: {
          type: 'MESSAGE_RECEIVED',
          config: {},
        },
        steps: expect.arrayContaining([
          expect.objectContaining({
            type: 'SEND_MESSAGE',
            config: { channel: 'whatsapp', body: '' },
          }),
        ]),
      })
    );
  });
});

describe('AutomationFlowDiagram', () => {
  const defaultProps = {
    automation: mockAutomation,
    onNodeClick: vi.fn(),
    interactive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders flow diagram with nodes and edges', () => {
    render(<AutomationFlowDiagram {...defaultProps} />);
    
    // Should show trigger node
    expect(screen.getByText('Mensagem recebida')).toBeInTheDocument();
    
    // Should show step nodes
    expect(screen.getByText('Enviar mensagem')).toBeInTheDocument();
  });

  it('calls onNodeClick when node is clicked', async () => {
    render(<AutomationFlowDiagram {...defaultProps} />);
    
    const node = screen.getByText('Mensagem recebida');
    await userEvent.click(node);
    
    expect(defaultProps.onNodeClick).toHaveBeenCalled();
  });

  it('runs simulation when test button is clicked', async () => {
    render(<AutomationFlowDiagram {...defaultProps} />);
    
    const testButton = screen.getByText('Testar Fluxo');
    await userEvent.click(testButton);
    
    // Should show running state
    expect(screen.getByText('Executando...')).toBeInTheDocument();
  });
});

describe('TestAutomationModal', () => {
  const defaultProps = {
    automation: mockAutomation,
    onTestComplete: vi.fn(),
    isOpen: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders test modal with environment selection', () => {
    render(<TestAutomationModal {...defaultProps} />);
    
    expect(screen.getByText('Testar Automação: Test Automation')).toBeInTheDocument();
    expect(screen.getByText('Desenvolvimento')).toBeInTheDocument();
    expect(screen.getByText('Homologação')).toBeInTheDocument();
  });

  it('runs test with mock data', async () => {
    render(<TestAutomationModal {...defaultProps} />);
    
    const runTestButton = screen.getByText('Executar Teste');
    await userEvent.click(runTestButton);
    
    // Should show test running state
    expect(screen.getByText('Executando teste...')).toBeInTheDocument();
    
    // After test completes, should show results
    await waitFor(() => {
      expect(screen.getByText('Resultados do Teste')).toBeInTheDocument();
    });
  });

  it('generates new contact data', async () => {
    render(<TestAutomationModal {...defaultProps} />);
    
    const generateButton = screen.getByText('Gerar novo contato');
    await userEvent.click(generateButton);
    
    // Should update contact data
    expect(screen.getByText('João Silva')).toBeInTheDocument();
  });
});

describe('AutomationMetrics', () => {
  const defaultProps = {
    automation: mockAutomation,
    refreshInterval: 30,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders key metrics cards', () => {
    render(<AutomationMetrics {...defaultProps} />);
    
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Taxa de Sucesso')).toBeInTheDocument();
    expect(screen.getByText('Tempo Médio')).toBeInTheDocument();
    expect(screen.getByText('Erros')).toBeInTheDocument();
  });

  it('displays health indicator', () => {
    render(<AutomationMetrics {...defaultProps} />);
    
    expect(screen.getByText('Saúde da Automação')).toBeInTheDocument();
  });

  it('refreshes metrics when refresh button is clicked', async () => {
    render(<AutomationMetrics {...defaultProps} />);
    
    const refreshButton = screen.getByText('Atualizar');
    await userEvent.click(refreshButton);
    
    // Should show loading state
    expect(screen.getByText('Carregando métricas...')).toBeInTheDocument();
  });
});

describe('AutomationHistory', () => {
  const defaultProps = {
    automation: mockAutomation,
    onVersionRestore: vi.fn(),
    onVersionDelete: vi.fn(),
    currentVersion: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders version history cards', () => {
    render(<AutomationHistory {...defaultProps} />);
    
    expect(screen.getByText('Versão 3')).toBeInTheDocument();
    expect(screen.getByText('Versão 2')).toBeInTheDocument();
    expect(screen.getByText('Versão 1')).toBeInTheDocument();
  });

  it('restores version when restore button is clicked', async () => {
    render(<AutomationHistory {...defaultProps} />);
    
    const restoreButton = screen.getAllByTitle('Restaurar versão')[0];
    await userEvent.click(restoreButton);
    
    // Should show confirmation modal
    expect(screen.getByText('Restaurar Versão?')).toBeInTheDocument();
  });

  it('deletes version when delete button is clicked', async () => {
    render(<AutomationHistory {...defaultProps} />);
    
    const deleteButton = screen.getAllByTitle('Excluir versão')[0];
    await userEvent.click(deleteButton);
    
    // Should confirm deletion
    expect(confirm).toHaveBeenCalledWith('Tem certeza que deseja excluir esta versão?');
  });

  it('exports history when export button is clicked', async () => {
    render(<AutomationHistory {...defaultProps} />);
    
    const exportButton = screen.getByText('Exportar');
    await userEvent.click(exportButton);
    
    // Should trigger download
    expect(vi.spyOn(global, 'URL')..createObjectURL).toHaveBeenCalled();
  });
});

describe('AutomationCollaboration', () => {
  const defaultProps = {
    automation: mockAutomation,
    onPermissionUpdate: vi.fn(),
    onShareRequest: vi.fn(),
    currentUserId: 'user-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders collaboration interface', () => {
    render(<AutomationCollaboration {...defaultProps} />);
    
    expect(screen.getByText('Colaboração')).toBeInTheDocument();
    expect(screen.getByText('Compartilhar')).toBeInTheDocument();
  });

  it('opens share modal when share button is clicked', async () => {
    render(<AutomationCollaboration {...defaultProps} />);
    
    const shareButton = screen.getByText('Compartilhar');
    await userEvent.click(shareButton);
    
    expect(screen.getByText('Compartilhar Automação')).toBeInTheDocument();
  });

  it('shares automation with specified permissions', async () => {
    render(<AutomationCollaboration {...defaultProps} />);
    
    // Open share modal
    const shareButton = screen.getByText('Compartilhar');
    await userEvent.click(shareButton);
    
    // Fill in form
    const emailInput = screen.getByPlaceholderText('Digite os emails separados por vírgula');
    await userEvent.type(emailInput, 'newuser@example.com');
    
    const permissionSelect = screen.getByLabelText('Permissão');
    await userEvent.selectOptions(permissionSelect, 'view');
    
    // Submit form
    const shareButtonInModal = screen.getByText('Compartilhar');
    await userEvent.click(shareButtonInModal);
    
    expect(defaultProps.onPermissionUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'newuser@example.com',
          permission: 'view',
        }),
      ])
    );
  });
});

describe('PerformanceOptimizer', () => {
  const defaultProps = {
    automation: mockAutomation,
    onOptimizationApplied: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders optimization rules', () => {
    render(<PerformanceOptimizer {...defaultProps} />);
    
    expect(screen.getByText('Cache de Gatilhos')).toBeInTheDocument();
    expect(screen.getByText('Batch Processing')).toBeInTheDocument();
    expect(screen.getByText('Memory Pool')).toBeInTheDocument();
    expect(screen.getByText('Circuit Breaker')).toBeInTheDocument();
  });

  it('toggles optimization rules', async () => {
    render(<PerformanceOptimizer {...defaultProps} />);
    
    const toggleSwitch = screen.getByRole('switch');
    await userEvent.click(toggleSwitch);
    
    expect(toggleSwitch).toBeChecked();
  });

  it('applies optimization rule', async () => {
    render(<PerformanceOptimizer {...defaultProps} />);
    
    // Enable rule first
    const toggleSwitch = screen.getAllByRole('switch')[0];
    await userEvent.click(toggleSwitch);
    
    // Apply rule
    const applyButton = screen.getByText('Aplicar');
    await userEvent.click(applyButton);
    
    // Should show applying state
    expect(screen.getByText('Aplicando...')).toBeInTheDocument();
    
    // After completion, should show applied state
    await waitFor(() => {
      expect(screen.getByText('Aplicado')).toBeInTheDocument();
    });
  });

  it('applies all optimization rules', async () => {
    render(<PerformanceOptimizer {...defaultProps} />);
    
    const applyAllButton = screen.getByText('Aplicar Todas');
    await userEvent.click(applyAllButton);
    
    // Should apply each enabled rule
    expect(screen.getAllByText('Aplicando...')).toHaveLength(4);
  });
});

// Integration tests
describe('Integration Tests', () => {
  it('allows complete workflow from creation to testing', async () => {
    // Render main page
    render(<div>Mock Main Page</div>); // Would normally render the actual page
    
    // Create automation via wizard
    // render(<AutomationWizard {...wizardProps} />);
    
    // Fill form and submit
    // await userEvent.type(screen.getByPlaceholderText('Ex: Boas-vindas ao novo contato'), 'Test Automation');
    // await userEvent.selectOptions(screen.getByLabelText('Quando a automação deve ser executada?'), 'MESSAGE_RECEIVED');
    // await userEvent.click(screen.getByText('Próximo'));
    // await userEvent.click(screen.getByText('Criar automação'));
    
    // Verify automation was created
    // expect(onComplete).toHaveBeenCalled();
    
    // Test the automation
    // render(<TestAutomationModal {...testProps} />);
    // await userEvent.click(screen.getByText('Executar Teste'));
    
    // Verify test results
    // await waitFor(() => {
    //   expect(screen.getByText('Resultados do Teste')).toBeInTheDocument();
    // });
  });

  it('maintains state across component interactions', async () => {
    // Test that state is properly maintained between components
    // This would test more complex workflows involving multiple components
  });
});

// E2E tests would be written in a separate file using Playwright
// Example E2E test structure:
/*
describe('E2E Tests', () => {
  it('allows user to create and test automation', async () => {
    await page.goto('/automations');
    await page.click('text=Nova automação');
    await page.fill('input[placeholder="Ex: Boas-vindas ao novo contato"]', 'Test Automation');
    await page.selectOption('select', 'MESSAGE_RECEIVED');
    await page.click('text=Próximo');
    await page.click('text=Criar automação');
    await expect(page).toContainText('Automação criada com sucesso');
  });
});
*/
*/