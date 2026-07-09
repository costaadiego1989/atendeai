import { DashboardPromptBuilder } from '../domain/dashboard-agent/DashboardPromptBuilder';
import { DashboardTenantContext } from '../domain/dashboard-agent/DashboardAgentFactory';
import { DashboardToolId } from '../domain/dashboard-agent/DashboardToolRegistry';

describe('DashboardPromptBuilder', () => {
  let builder: DashboardPromptBuilder;

  const baseContext: DashboardTenantContext = {
    tenantId: 'tenant-1',
    companyName: 'Clínica Saúde Total',
    businessType: 'CLINIC',
    services: 'Consultas, Exames, Procedimentos',
    operatingHours: { seg: '08:00-18:00', ter: '08:00-18:00' },
    description: 'Clínica multidisciplinar',
    address: 'Rua das Flores, 123 - SP',
    language: 'pt-BR',
  };

  beforeEach(() => {
    builder = new DashboardPromptBuilder();
  });

  it('should include company name in identity section', () => {
    const prompt = builder.build(baseContext, ['attendance_status', 'scheduling', 'contacts_crm']);
    expect(prompt).toContain('Clínica Saúde Total');
  });

  it('should include business context details', () => {
    const prompt = builder.build(baseContext, ['attendance_status']);
    expect(prompt).toContain('Tipo: CLINIC');
    expect(prompt).toContain('Consultas, Exames, Procedimentos');
    expect(prompt).toContain('Rua das Flores, 123 - SP');
  });

  it('should list only available tools', () => {
    const tools: DashboardToolId[] = ['attendance_status', 'scheduling', 'contacts_crm'];
    const prompt = builder.build(baseContext, tools);
    expect(prompt).toContain('attendance_status');
    expect(prompt).toContain('scheduling');
    expect(prompt).toContain('contacts_crm');
    expect(prompt).not.toContain('catalog_inventory');
    expect(prompt).not.toContain('recovery_status');
  });

  it('should include niche-specific guidance for CLINIC', () => {
    const prompt = builder.build(baseContext, ['scheduling']);
    expect(prompt).toContain('Clínica/Saúde');
    expect(prompt).toContain('paciente');
    expect(prompt).toContain('consulta');
  });

  it('should include generic guidance for unknown niche', () => {
    const ctx = { ...baseContext, businessType: 'UNKNOWN' };
    const prompt = builder.build(ctx, ['attendance_status']);
    expect(prompt).toContain('Foco do Nicho (Geral)');
  });

  it('should include isolation rules', () => {
    const prompt = builder.build(baseContext, ['attendance_status']);
    expect(prompt).toContain('NUNCA mencione ou revele informações de outros');
    expect(prompt).toContain('NUNCA invente dados');
  });

  it('should instruct pt-BR formatting', () => {
    const prompt = builder.build(baseContext, ['sales_metrics']);
    expect(prompt).toContain('português brasileiro');
    expect(prompt).toContain('R$');
  });

  it('should use ECOMMERCE niche guidance', () => {
    const ctx = { ...baseContext, businessType: 'ECOMMERCE', companyName: 'Loja X' };
    const prompt = builder.build(ctx, ['sales_metrics', 'catalog_inventory']);
    expect(prompt).toContain('E-commerce');
    expect(prompt).toContain('carrinho');
  });
});
