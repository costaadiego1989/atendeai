import { DashboardToolRegistry } from '../domain/dashboard-agent/DashboardToolRegistry';

describe('DashboardToolRegistry', () => {
  let registry: DashboardToolRegistry;

  beforeEach(() => {
    registry = new DashboardToolRegistry();
  });

  it('should return correct tools for ECOMMERCE', () => {
    const tools = registry.getToolIdsForNiche('ECOMMERCE');
    expect(tools).toEqual([
      'sales_metrics', 'attendance_status', 'catalog_inventory', 'recovery_status', 'contacts_crm',
    ]);
  });

  it('should return correct tools for CLINIC (scheduling niche)', () => {
    const tools = registry.getToolIdsForNiche('CLINIC');
    expect(tools).toContain('scheduling');
    expect(tools).not.toContain('catalog_inventory');
    expect(tools).not.toContain('recovery_status');
  });

  it('should return correct tools for LEGAL (no sales)', () => {
    const tools = registry.getToolIdsForNiche('LEGAL');
    expect(tools).not.toContain('sales_metrics');
    expect(tools).toContain('attendance_status');
    expect(tools).toContain('scheduling');
    expect(tools).toContain('contacts_crm');
  });

  it('should fallback to GENERIC for unknown niche', () => {
    const tools = registry.getToolIdsForNiche('UNKNOWN_NICHE');
    expect(tools).toEqual(['sales_metrics', 'attendance_status', 'contacts_crm']);
  });

  it('should fallback to GENERIC for null/undefined', () => {
    expect(registry.getToolIdsForNiche(null)).toEqual(['sales_metrics', 'attendance_status', 'contacts_crm']);
    expect(registry.getToolIdsForNiche(undefined)).toEqual(['sales_metrics', 'attendance_status', 'contacts_crm']);
  });

  it('should be case-insensitive', () => {
    expect(registry.getToolIdsForNiche('ecommerce')).toEqual(registry.getToolIdsForNiche('ECOMMERCE'));
  });

  it('getAllToolIds returns all 6 tools', () => {
    expect(registry.getAllToolIds()).toHaveLength(6);
  });

  it('isToolAvailableForNiche works correctly', () => {
    expect(registry.isToolAvailableForNiche('scheduling', 'CLINIC')).toBe(true);
    expect(registry.isToolAvailableForNiche('scheduling', 'ECOMMERCE')).toBe(false);
  });
});
