import { CNPJ } from '../domain/value-objects/CNPJ';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

describe('CNPJ Value Object', () => {
  it('should create a valid CNPJ with mask', () => {
    const value = '12.345.678/0001-95';
    const cnpj = CNPJ.create(value);
    expect(cnpj.value).toBe(value);
  });

  it('should create a valid CNPJ without mask and return it formatted', () => {
    const value = '12345678000195';
    const cnpj = CNPJ.create(value);
    expect(cnpj.value).toBe('12.345.678/0001-95');
  });

  it('should throw an error if CNPJ has less than 14 digits', () => {
    expect(() => CNPJ.create('1234567800019')).toThrow(
      ValidationErrorException,
    );
    expect(() => CNPJ.create('1234567800019')).toThrow(
      'CNPJ must have 14 digits',
    );
  });

  it('should throw an error if CNPJ has more than 14 digits', () => {
    expect(() => CNPJ.create('123456780001955')).toThrow(
      ValidationErrorException,
    );
  });

  it('should throw an error if CNPJ has all digits equal', () => {
    expect(() => CNPJ.create('11.111.111/1111-11')).toThrow(
      ValidationErrorException,
    );
    expect(() => CNPJ.create('11.111.111/1111-11')).toThrow('Invalid CNPJ');
  });

  it('should throw an error if CNPJ verification digits are invalid', () => {
    expect(() => CNPJ.create('12.345.678/0001-00')).toThrow(
      ValidationErrorException,
    );
  });

  it('should clean the CNPJ value', () => {
    const cnpj = CNPJ.create('12.345.678/0001-95');
    expect(cnpj.toClean()).toBe('12345678000195');
  });
});
