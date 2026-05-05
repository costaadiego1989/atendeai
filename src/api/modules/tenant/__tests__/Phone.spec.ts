import { Phone } from '../domain/value-objects/Phone';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

describe('Phone Value Object', () => {
  it('should create a valid phone number from raw digits', () => {
    const phone = Phone.create('11999998888');
    expect(phone.value).toBe('+5511999998888');
  });

  it('should add +55 automatically if missing', () => {
    const phone = Phone.create('11999998888');
    expect(phone.value).toBe('+5511999998888');
  });

  it('should keep +55 if already present', () => {
    const phone = Phone.create('+5511999998888');
    expect(phone.value).toBe('+5511999998888');
  });

  it('should remove non-numeric characters before processing', () => {
    const phone = Phone.create('(11) 99999-8888');
    expect(phone.value).toBe('+5511999998888');
  });

  it('should throw an error for invalid phone number (starting with zero or too short)', () => {
    expect(() => Phone.create('000')).toThrow(ValidationErrorException);
  });
});
