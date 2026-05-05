import { Role } from '../domain/value-objects/Role';

describe('Role Value Object', () => {
  it('should create an OWNER role', () => {
    const role = Role.create('OWNER');
    expect(role.value).toBe('OWNER');
  });

  it('should create an ADMIN role', () => {
    const role = Role.create('ADMIN');
    expect(role.value).toBe('ADMIN');
  });

  it('should create an AGENT role', () => {
    const role = Role.create('AGENT');
    expect(role.value).toBe('AGENT');
  });

  it('should throw error for invalid role', () => {
    expect(() => Role.create('INVALID')).toThrow();
  });
});
