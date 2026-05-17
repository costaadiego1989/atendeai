import { InventoryReportCsvBuilder } from '../application/services/InventoryReportCsvBuilder';
import { GenerateInventoryReportOutput } from '../application/use-cases/GenerateInventoryReportUseCase';
import { InventoryItemRecord } from '../domain/ports/IInventoryRepository';

describe('InventoryReportCsvBuilder', () => {
  let builder: InventoryReportCsvBuilder;

  const makeItem = (
    overrides: Partial<InventoryItemRecord> = {},
  ): InventoryItemRecord => ({
    id: 'item-1',
    tenantId: 'tenant-1',
    catalogItemId: 'cat-1',
    sku: 'SKU-001',
    externalReference: 'EXT-001',
    name: 'Produto Teste',
    availableQuantity: 10,
    availabilityStatus: 'AVAILABLE',
    currentPrice: '29.90',
    currency: 'BRL',
    source: 'BLING',
    lastSyncedAt: new Date('2024-06-15T10:00:00.000Z'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  const makeReport = (
    items: InventoryItemRecord[],
  ): GenerateInventoryReportOutput => ({
    generatedAt: new Date('2024-06-15T12:00:00.000Z'),
    summary: {
      totalItems: items.length,
      totalQuantity: items.reduce((sum, i) => sum + i.availableQuantity, 0),
      availableItems: items.filter((i) => i.availabilityStatus === 'AVAILABLE')
        .length,
      lowStockItems: items.filter((i) => i.availabilityStatus === 'LOW_STOCK')
        .length,
      unavailableItems: items.filter(
        (i) => i.availabilityStatus === 'UNAVAILABLE',
      ).length,
      reservedItems: items.filter((i) => i.availabilityStatus === 'RESERVED')
        .length,
      estimatedInventoryValue: 0,
    },
    items,
  });

  beforeEach(() => {
    builder = new InventoryReportCsvBuilder();
  });

  it('should build CSV with correct headers', () => {
    const report = makeReport([makeItem()]);
    const result = builder.build(report);

    const lines = result.content.split('\n');
    const headerLine = lines[0];

    expect(headerLine).toContain('"Nome"');
    expect(headerLine).toContain('"SKU"');
    expect(headerLine).toContain('"Quantidade"');
    expect(headerLine).toContain('"Status"');
    expect(headerLine).toContain('"Ultimo sync"');
    expect(result.mimeType).toBe('text/csv;charset=utf-8');
    expect(result.fileName).toMatch(
      /^relatorio-estoque-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  it('should format item data correctly in CSV rows', () => {
    const item = makeItem({ currentPrice: '1500.50', currency: 'BRL' });
    const report = makeReport([item]);
    const result = builder.build(report);

    const lines = result.content.split('\n');
    const dataLine = lines[1];

    expect(dataLine).toContain('"Produto Teste"');
    expect(dataLine).toContain('"SKU-001"');
    expect(dataLine).toContain('"10"');
    expect(dataLine).toContain('"1500.50"');
    expect(dataLine).toContain('"BRL"');
    expect(dataLine).toContain('"BLING"');
  });

  it('should handle zero quantity items', () => {
    const item = makeItem({
      availableQuantity: 0,
      availabilityStatus: 'UNAVAILABLE',
    });
    const report = makeReport([item]);
    const result = builder.build(report);

    const lines = result.content.split('\n');
    const dataLine = lines[1];

    expect(dataLine).toContain('"0"');
    expect(dataLine).toContain('"UNAVAILABLE"');
  });

  it('should escape special characters (double quotes)', () => {
    const item = makeItem({ name: 'Produto "Especial" com;vírgula' });
    const report = makeReport([item]);
    const result = builder.build(report);

    const lines = result.content.split('\n');
    const dataLine = lines[1];

    expect(dataLine).toContain('"Produto ""Especial"" com;vírgula"');
  });

  it('should return headers only when data is empty', () => {
    const report = makeReport([]);
    const result = builder.build(report);

    const lines = result.content.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('"Nome"');
    expect(lines[0]).toContain('"SKU"');
  });
});
