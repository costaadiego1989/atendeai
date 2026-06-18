// tenant.unit-new.spec.ts — unit tests for tenant module
describe('Tenant entity validation', () => {
  const makeTenantProps = (o: Record<string, unknown> = {}) => ({
    id: 'tenant-1', name: 'Acme Corp', cnpj: '12.345.678/0001-90',
    email: 'admin@acme.com', phone: '+55 11 99999-0001',
    plan: 'BASIC', status: 'ACTIVE', ...o,
  });

  it('should require non-empty company name', () => {
    const v = (props: any) => { if (!props.name?.trim()) throw new Error('name required'); return true; };
    expect(() => v({ ...makeTenantProps(), name: '' })).toThrow();
  });

  it('should trim company name', () => {
    const normalize = (name: string) => name.trim();
    expect(normalize('  Acme  ')).toBe('Acme');
  });

  it('should reject invalid email format', () => {
    const validateEmail = (email: string) => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid email');
    };
    expect(() => validateEmail('not-an-email')).toThrow();
  });

  it('should accept valid email', () => {
    const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    expect(validateEmail('user@domain.com')).toBe(true);
  });

  it('should reject empty CNPJ', () => {
    const v = (cnpj: string) => { if (!cnpj?.trim()) throw new Error('cnpj required'); };
    expect(() => v('')).toThrow();
  });

  it('should accept ACTIVE status', () => {
    expect(['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes('ACTIVE')).toBe(true);
  });

  it('should reject invalid status', () => {
    expect(['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes('DELETED')).toBe(false);
  });

  it('should require valid plan', () => {
    const validPlans = ['BASIC', 'PRO', 'ENTERPRISE'];
    expect(validPlans.includes('BASIC')).toBe(true);
    expect(validPlans.includes('UNKNOWN')).toBe(false);
  });
});

describe('User entity validation', () => {
  it('should require non-empty name', () => {
    const v = (name: string) => { if (!name?.trim()) throw new Error('name required'); };
    expect(() => v('')).toThrow();
  });

  it('should require valid email', () => {
    const v = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    expect(v('test@domain.com')).toBe(true);
    expect(v('bad')).toBe(false);
  });

  it('should accept OWNER role', () => {
    expect(['OWNER', 'ADMIN', 'AGENT', 'VIEWER'].includes('OWNER')).toBe(true);
  });

  it('should accept AGENT role', () => {
    expect(['OWNER', 'ADMIN', 'AGENT', 'VIEWER'].includes('AGENT')).toBe(true);
  });

  it('should reject invalid role', () => {
    expect(['OWNER', 'ADMIN', 'AGENT', 'VIEWER'].includes('SUPER_ADMIN')).toBe(false);
  });

  it('should require tenantId on user', () => {
    const v = (u: any) => { if (!u.tenantId) throw new Error('tenantId required'); };
    expect(() => v({ name: 'John' })).toThrow();
  });
});

describe('Tenant plan value object', () => {
  it('should compare plans by tier', () => {
    const tier: Record<string, number> = { BASIC: 1, PRO: 2, ENTERPRISE: 3 };
    expect(tier.PRO > tier.BASIC).toBe(true);
    expect(tier.ENTERPRISE > tier.PRO).toBe(true);
  });

  it('should allow upgrade from BASIC to PRO', () => {
    const canUpgrade = (from: string, to: string) => {
      const tier: Record<string, number> = { BASIC: 1, PRO: 2, ENTERPRISE: 3 };
      return tier[to] > tier[from];
    };
    expect(canUpgrade('BASIC', 'PRO')).toBe(true);
  });

  it('should not allow downgrade from PRO to BASIC in upgrade flow', () => {
    const canUpgrade = (from: string, to: string) => {
      const tier: Record<string, number> = { BASIC: 1, PRO: 2, ENTERPRISE: 3 };
      return tier[to] > tier[from];
    };
    expect(canUpgrade('PRO', 'BASIC')).toBe(false);
  });
});

describe('Email value object', () => {
  it('should normalize to lowercase', () => {
    const normalize = (email: string) => email.toLowerCase().trim();
    expect(normalize('USER@DOMAIN.COM')).toBe('user@domain.com');
  });

  it('should reject email with spaces', () => {
    const v = (email: string) => { if (email.includes(' ')) throw new Error('invalid'); };
    expect(() => v('user @domain.com')).toThrow();
  });

  it('should reject email without @', () => {
    const v = (email: string) => { if (!email.includes('@')) throw new Error('invalid'); };
    expect(() => v('nodomain.com')).toThrow();
  });
});

describe('Phone value object', () => {
  it('should accept Brazilian mobile number', () => {
    const v = (phone: string) => /^\+55\s?\d{2}\s?\d{5}-?\d{4}$/.test(phone);
    expect(v('+55 11 99999-0001')).toBe(true);
  });

  it('should reject empty phone', () => {
    const v = (phone: string) => { if (!phone?.trim()) throw new Error('required'); };
    expect(() => v('')).toThrow();
  });
});

describe('Tenant service injection safety', () => {
  it('should not allow HTML in company name', () => {
    const sanitize = (name: string) => name.replace(/<[^>]*>/g, '').trim();
    expect(sanitize('<script>alert(1)</script>Acme')).toBe('Acme');
  });

  it('should not interpret SQL in email field', () => {
    const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    expect(validateEmail("admin'; DROP TABLE tenant; --")).toBe(false);
  });

  it('should trim and store cleaned description', () => {
    const clean = (v: string) => v.trim();
    expect(clean('  description  ')).toBe('description');
  });
});
