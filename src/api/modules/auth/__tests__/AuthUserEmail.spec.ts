import { AuthUserEmail } from '../domain/value-objects/AuthUserEmail';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

describe('AuthUserEmail', () => {
  it('should create with a valid email', () => {
    const email = AuthUserEmail.create('user@example.com');
    expect(email.value).toBe('user@example.com');
  });

  it('should normalize email to lowercase', () => {
    const email = AuthUserEmail.create('User@Example.COM');
    expect(email.value).toBe('user@example.com');
  });

  it('should reject email without @', () => {
    expect(() => AuthUserEmail.create('userexample.com')).toThrow(
      ValidationErrorException,
    );
  });

  it('should reject empty string', () => {
    expect(() => AuthUserEmail.create('')).toThrow(ValidationErrorException);
  });

  it('should accept email with subdomain', () => {
    const email = AuthUserEmail.create('user@mail.example.com');
    expect(email.value).toBe('user@mail.example.com');
  });

  it('should accept email with + in local part', () => {
    const email = AuthUserEmail.create('user+tag@example.com');
    expect(email.value).toBe('user+tag@example.com');
  });

  it('should trim leading and trailing spaces', () => {
    const email = AuthUserEmail.create('  user@example.com  ');
    expect(email.value).toBe('user@example.com');
  });

  it('should determine equality by value', () => {
    const email1 = AuthUserEmail.create('user@example.com');
    const email2 = AuthUserEmail.create('USER@example.com');
    const email3 = AuthUserEmail.create('other@example.com');

    expect(email1.equals(email2)).toBe(true);
    expect(email1.equals(email3)).toBe(false);
  });

  it('should accept email with only @ present (minimal validation)', () => {
    // The current implementation only checks for presence of @
    const email = AuthUserEmail.create('a@b');
    expect(email.value).toBe('a@b');
  });

  it('should store the value after lowercase and trim transformation', () => {
    const email = AuthUserEmail.create('  TEST@Domain.Com  ');
    expect(email.value).toBe('test@domain.com');
  });

  it('should reject null-like values', () => {
    expect(() => AuthUserEmail.create(null as any)).toThrow(
      ValidationErrorException,
    );
    expect(() => AuthUserEmail.create(undefined as any)).toThrow(
      ValidationErrorException,
    );
  });
});
