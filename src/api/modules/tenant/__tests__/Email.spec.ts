import { Email } from '../domain/value-objects/Email';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

describe('Email Value Object', () => {
  it('should create a valid email address', () => {
    const emailStr = 'test@example.com';
    const email = Email.create(emailStr);
    expect(email.value).toBe(emailStr);
  });

  it('should convert email to lowercase', () => {
    const email = Email.create('TEST@EXAMPLE.COM');
    expect(email.value).toBe('test@example.com');
  });

  it('should trim the email address', () => {
    const email = Email.create('  test@example.com  ');
    expect(email.value).toBe('test@example.com');
  });

  it('should throw an error for invalid email without @', () => {
    expect(() => Email.create('invalidemail.com')).toThrow(
      ValidationErrorException,
    );
  });

  it('should throw an error for email without domain', () => {
    expect(() => Email.create('test@')).toThrow(ValidationErrorException);
  });

  it('should throw an error for empty email', () => {
    expect(() => Email.create('')).toThrow(ValidationErrorException);
  });
});
