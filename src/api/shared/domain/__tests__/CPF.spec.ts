import { CPF } from '../CPF';
import { ValidationErrorException } from '../exceptions/DomainExceptions';

describe('CPF', () => {
  it('should create a formatted cpf from raw digits', () => {
    const cpf = CPF.create('52998224725');

    expect(cpf.value).toBe('529.982.247-25');
    expect(cpf.toClean()).toBe('52998224725');
  });

  it('should throw for invalid cpf', () => {
    expect(() => CPF.create('11111111111')).toThrow(ValidationErrorException);
  });
});
