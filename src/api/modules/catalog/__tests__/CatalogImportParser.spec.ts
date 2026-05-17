import { CatalogImportParser } from '../application/services/CatalogImportParser';

describe('CatalogImportParser', () => {
  let parser: CatalogImportParser;

  beforeEach(() => {
    parser = new CatalogImportParser();
  });

  it('parses valid CSV with headers', () => {
    const csv = [
      'nome;tipo;preço;categoria;tags',
      'Camisa;PRODUCT;29.90;Roupas;verão|casual',
      'Corte;SERVICE;50.00;Serviços;cabelo',
    ].join('\n');

    const result = parser.parseRows(csv);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Camisa');
    expect(result[0].type).toBe('PRODUCT');
    expect(result[0].basePrice).toBe('29.90');
    expect(result[0].categoryName).toBe('Roupas');
    expect(result[0].tags).toEqual(expect.arrayContaining(['verão', 'casual']));
    expect(result[1].name).toBe('Corte');
    expect(result[1].type).toBe('SERVICE');
  });

  it('handles missing columns gracefully', () => {
    const csv = ['nome;preço', 'Produto A;15.00'].join('\n');

    const result = parser.parseRows(csv);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Produto A');
    expect(result[0].basePrice).toBe('15.00');
    expect(result[0].type).toBeUndefined();
    expect(result[0].categoryName).toBeUndefined();
  });

  it('handles invalid price values', () => {
    const csv = ['nome;preço', 'Produto A;abc', 'Produto B;19.90'].join('\n');

    const result = parser.parseRows(csv);

    expect(result).toHaveLength(2);
    // "abc" sanitizes to empty numeric → normalizeMoney returns "0.00"
    expect(result[0].basePrice).toBe('0.00');
    expect(result[1].basePrice).toBe('19.90');
  });

  it('handles empty rows by filtering them out', () => {
    const csv = [
      'nome;preço',
      'Produto A;10.00',
      '',
      '   ',
      'Produto B;20.00',
    ].join('\n');

    const result = parser.parseRows(csv);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Produto A');
    expect(result[1].name).toBe('Produto B');
  });

  it('handles special characters in quoted fields', () => {
    const csv = [
      'nome;descrição;preço',
      '"Produto ""Especial""";Descrição com; acentuação;25.00',
    ].join('\n');

    const result = parser.parseRows(csv);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Produto "Especial"');
  });

  it('returns empty array for empty input', () => {
    const result = parser.parseRows('');

    expect(result).toEqual([]);
  });

  it('applies defaults when provided', () => {
    const csv = ['nome;preço', 'Produto A;10.00'].join('\n');

    const result = parser.parseRows(csv, {
      defaultType: 'PRODUCT',
      defaultCategoryName: 'Geral',
      defaultSource: 'IMPORT',
      defaultTags: ['importado'],
    });

    expect(result[0].type).toBe('PRODUCT');
    expect(result[0].categoryName).toBe('Geral');
    expect(result[0].source).toBe('IMPORT');
    expect(result[0].tags).toContain('importado');
  });
});
