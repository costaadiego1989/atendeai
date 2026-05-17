import { CatalogReportCsvBuilder } from '../application/services/CatalogReportCsvBuilder';
import { GenerateCatalogReportOutput } from '../application/use-cases/GenerateCatalogReportUseCase';
import { CatalogItemRecord } from '../domain/ports/ICatalogRepository';

describe('CatalogReportCsvBuilder', () => {
  let builder: CatalogReportCsvBuilder;

  const itemRecord = (
    over?: Partial<CatalogItemRecord>,
  ): CatalogItemRecord => ({
    id: 'item-1',
    tenantId: 'tenant-1',
    categoryId: 'cat-1',
    categoryName: 'Bebidas',
    type: 'PRODUCT',
    name: 'Suco de Laranja',
    description: 'Suco natural',
    basePrice: '8.50',
    currency: 'BRL',
    tags: ['natural', 'saudável'],
    active: true,
    source: 'MANUAL',
    externalReference: 'REF-001',
    imageUrl: null,
    attributes: {},
    variants: [],
    optionGroups: [],
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-16T12:00:00Z'),
    ...over,
  });

  const buildReport = (
    items: CatalogItemRecord[],
  ): GenerateCatalogReportOutput => ({
    generatedAt: new Date('2024-01-20T10:00:00Z'),
    summary: {
      totalItems: items.length,
      activeItems: items.filter((i) => i.active).length,
      inactiveItems: items.filter((i) => !i.active).length,
      services: 0,
      products: items.length,
      rentals: 0,
      estimatedBaseValue: 0,
    },
    items,
  });

  beforeEach(() => {
    builder = new CatalogReportCsvBuilder();
  });

  it('builds CSV with correct headers', () => {
    const report = buildReport([itemRecord()]);
    const result = builder.build(report);

    expect(result.mimeType).toBe('text/csv;charset=utf-8');
    expect(result.fileName).toMatch(
      /^relatorio-catalogo-\d{4}-\d{2}-\d{2}\.csv$/,
    );

    const lines = result.content.split('\n');
    expect(lines[0]).toContain('"Nome"');
    expect(lines[0]).toContain('"Tipo"');
    expect(lines[0]).toContain('"Categoria"');
    expect(lines[0]).toContain('"Ativo"');
    expect(lines[0]).toContain('"preço base"');
    expect(lines[0]).toContain('"Moeda"');
  });

  it('formats item data correctly', () => {
    const report = buildReport([itemRecord()]);
    const result = builder.build(report);

    const lines = result.content.split('\n');
    const dataLine = lines[1];

    expect(dataLine).toContain('"Suco de Laranja"');
    expect(dataLine).toContain('"PRODUCT"');
    expect(dataLine).toContain('"Bebidas"');
    expect(dataLine).toContain('"Sim"');
    expect(dataLine).toContain('"8.50"');
    expect(dataLine).toContain('"BRL"');
    expect(dataLine).toContain('"natural, saudável"');
  });

  it('handles empty data', () => {
    const report = buildReport([]);
    const result = builder.build(report);

    const lines = result.content.split('\n');
    expect(lines).toHaveLength(1); // Only header row
  });

  it('escapes double quotes in fields', () => {
    const report = buildReport([
      itemRecord({
        name: 'Produto "Premium"',
        description: 'Desc com "aspas"',
      }),
    ]);
    const result = builder.build(report);

    const lines = result.content.split('\n');
    const dataLine = lines[1];

    expect(dataLine).toContain('"Produto ""Premium"""');
    expect(dataLine).toContain('"Desc com ""aspas"""');
  });
});
