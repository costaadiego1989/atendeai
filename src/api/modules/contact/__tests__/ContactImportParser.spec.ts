import { ContactImportParser } from '../application/services/ContactImportParser';

describe('ContactImportParser', () => {
  let parser: ContactImportParser;

  beforeEach(() => {
    parser = new ContactImportParser();
  });

  it('should parse valid CSV with headers', () => {
    const rawText = 'nome;telefone;documento;email;tags\nJohn Doe;5511999999999;12345678900;john@test.com;VIP|Premium';

    const rows = parser.parseRows(rawText, []);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('John Doe');
    expect(rows[0].phone).toBe('5511999999999');
    expect(rows[0].document).toBe('12345678900');
    expect(rows[0].email).toBe('john@test.com');
    expect(rows[0].tags).toContain('VIP');
    expect(rows[0].tags).toContain('Premium');
  });

  it('should handle missing columns gracefully', () => {
    const rawText = 'nome,telefone\nJohn Doe,5511999999999';

    const rows = parser.parseRows(rawText, []);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('John Doe');
    expect(rows[0].phone).toBe('5511999999999');
    expect(rows[0].document).toBeUndefined();
    expect(rows[0].email).toBeUndefined();
  });

  it('should handle special characters in names', () => {
    const rawText = 'nome,telefone\nJosé María,5511999999999\nO\'Brien,5511888888888';

    const rows = parser.parseRows(rawText, []);

    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('José María');
    expect(rows[1].name).toBe("O'Brien");
  });

  it('should normalize phone numbers by removing non-digit characters', () => {
    const rawText = 'nome,telefone\nJohn,(55) 11 99999-9999';

    const rows = parser.parseRows(rawText, []);

    expect(rows[0].phone).toBe('5511999999999');
  });

  it('should return array of parsed contacts with line numbers', () => {
    const rawText = 'nome,telefone\nAlice,5511111111111\nBob,5511222222222\nCharlie,5511333333333';

    const rows = parser.parseRows(rawText, []);

    expect(rows).toHaveLength(3);
    expect(rows[0].lineNumber).toBe(2);
    expect(rows[1].lineNumber).toBe(3);
    expect(rows[2].lineNumber).toBe(4);
  });

  it('should return empty array for completely empty input', () => {
    const rows = parser.parseRows('', []);
    expect(rows).toHaveLength(0);
  });

  it('should apply default tags to all parsed rows', () => {
    const rawText = 'nome,telefone\nJohn,5511999999999';

    const rows = parser.parseRows(rawText, ['imported', 'batch-1']);

    expect(rows[0].tags).toContain('imported');
    expect(rows[0].tags).toContain('batch-1');
  });

  it('should handle tab-separated values', () => {
    const rawText = 'nome\ttelefone\nJohn Doe\t5511999999999';

    const rows = parser.parseRows(rawText, []);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('John Doe');
    expect(rows[0].phone).toBe('5511999999999');
  });
});
