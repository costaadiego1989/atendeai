import { ContactName } from '../domain/value-objects/ContactName';

describe('ContactName (Value Object)', () => {
  it('should create with a valid name', () => {
    const name = ContactName.create('John Doe');
    expect(name.value).toBe('John Doe');
  });

  it('should reject empty string', () => {
    expect(() => ContactName.create('')).toThrow(
      'Contact name must be at least 3 characters long',
    );
  });

  it('should reject name shorter than 3 characters', () => {
    expect(() => ContactName.create('AB')).toThrow(
      'Contact name must be at least 3 characters long',
    );
  });

  it('should accept name with exactly 3 characters', () => {
    const name = ContactName.create('Ana');
    expect(name.value).toBe('Ana');
  });

  it('should preserve whitespace in valid names', () => {
    const name = ContactName.create('  John Doe  ');
    expect(name.value).toBe('  John Doe  ');
  });

  it('should determine equality between two ContactName instances', () => {
    const name1 = ContactName.create('John Doe');
    const name2 = ContactName.create('John Doe');
    const name3 = ContactName.create('Jane Doe');

    expect(name1.equals(name2)).toBe(true);
    expect(name1.equals(name3)).toBe(false);
  });
});
