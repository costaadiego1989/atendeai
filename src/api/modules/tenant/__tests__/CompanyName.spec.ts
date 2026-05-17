import { CompanyName } from '../domain/value-objects/CompanyName';

describe('CompanyName Value Object', () => {
  it('should create a valid company name', () => {
    const name = 'Acme Corp';
    const companyName = CompanyName.create(name);
    expect(companyName.value).toBe(name);
  });

  it('should trim the company name', () => {
    const companyName = CompanyName.create('  Acme Corp  ');
    expect(companyName.value).toBe('Acme Corp');
  });

  it('should throw an error if company name is too short', () => {
    expect(() => CompanyName.create('A')).toThrow(
      'Company name must have at least 2 characters',
    );
  });

  it('should throw an error if company name is empty', () => {
    expect(() => CompanyName.create('')).toThrow(
      'Company name must have at least 2 characters',
    );
  });

  it('should throw an error if company name is just whitespace', () => {
    expect(() => CompanyName.create('   ')).toThrow(
      'Company name must have at least 2 characters',
    );
  });

  it('should throw an error if company name is too long', () => {
    const longName = 'a'.repeat(256);
    expect(() => CompanyName.create(longName)).toThrow(
      'Company name must have at most 255 characters',
    );
  });
});
