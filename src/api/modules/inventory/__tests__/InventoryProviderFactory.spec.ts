import { InventoryProviderFactory } from '../application/providers/InventoryProviderFactory';

describe('InventoryProviderFactory', () => {
  const factory = new InventoryProviderFactory();

  it('INV-FAC-001: sourceType desconhecido lança erro explícito', () => {
    expect(() => factory.getProvider('UNKNOWN_INTEGRATION')).toThrow(
      /Nenhum provedor implementado/,
    );
  });

  it('INV-FAC-002: aliases ERP_SYNC e BLING devolvem instância funcional', () => {
    const a = factory.getProvider('ERP_SYNC');
    const b = factory.getProvider('BLING');
    expect(a.constructor.name).toBe('BlingProvider');
    expect(b.constructor.name).toBe('BlingProvider');
  });
});
