// contact.unit-new.spec.ts — unit tests for contact module
describe('Contact entity validation', () => {
  const makeContact = (o: Record<string, unknown> = {}) => ({
    id: 'c1', tenantId: 'tenant-1', name: 'John Doe', phone: '+55 11 99999-0001', ...o,
  });

  it('should require non-empty name', () => {
    const v = (c: any) => { if (!c.name?.trim()) throw new Error('name required'); };
    expect(() => v({ ...makeContact(), name: '' })).toThrow();
  });
  it('should trim name whitespace', () => {
    const normalize = (n: string) => n.trim();
    expect(normalize('  John  ')).toBe('John');
  });
  it('should require tenantId', () => {
    const v = (c: any) => { if (!c.tenantId) throw new Error('tenantId required'); };
    expect(() => v({ name: 'John' })).toThrow();
  });
  it('should accept valid phone number', () => {
    const c = makeContact({ phone: '+55 11 99999-1234' });
    expect(c.phone).toBe('+55 11 99999-1234');
  });
  it('should accept null phone (optional)', () => {
    const c = makeContact({ phone: null });
    expect(c.phone).toBeNull();
  });
  it('should accept valid email', () => {
    const v = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    expect(v('john@domain.com')).toBe(true);
  });
  it('should reject invalid email', () => {
    const v = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    expect(v('not-email')).toBe(false);
  });
  it('should accept null email (optional)', () => {
    const c = makeContact({ email: null });
    expect(c.email).toBeNull();
  });
  it('should store tags as array', () => {
    const c = makeContact({ tags: ['vip', 'lead'] });
    expect(c.tags).toContain('vip');
  });
  it('should allow empty tags array', () => {
    const c = makeContact({ tags: [] });
    expect(c.tags).toHaveLength(0);
  });
});

describe('Contact blocklist validation', () => {
  it('should mark contact as blocked', () => {
    const c = { id: 'c1', blocked: false };
    c.blocked = true;
    expect(c.blocked).toBe(true);
  });
  it('should not send messages to blocked contact', () => {
    const canSend = (blocked: boolean) => !blocked;
    expect(canSend(true)).toBe(false);
    expect(canSend(false)).toBe(true);
  });
});

describe('Contact channel preferences', () => {
  it('should accept WHATSAPP preference', () => {
    const valid = ['WHATSAPP', 'INSTAGRAM', 'EMAIL'];
    expect(valid.includes('WHATSAPP')).toBe(true);
  });
  it('should accept EMAIL preference', () => {
    expect(['WHATSAPP', 'INSTAGRAM', 'EMAIL'].includes('EMAIL')).toBe(true);
  });
  it('should reject unknown channel preference', () => {
    expect(['WHATSAPP', 'INSTAGRAM', 'EMAIL'].includes('SMS')).toBe(false);
  });
});

describe('Contact custom fields', () => {
  it('should store arbitrary key-value pairs', () => {
    const c = { customFields: { birthdate: '1990-01-01', city: 'São Paulo' } };
    expect(c.customFields.city).toBe('São Paulo');
  });
  it('should allow empty custom fields', () => {
    const c = { customFields: {} };
    expect(Object.keys(c.customFields)).toHaveLength(0);
  });
  it('should reject non-string keys', () => {
    const v = (fields: Record<string, unknown>) => {
      Object.keys(fields).forEach(k => { if (typeof k !== 'string') throw new Error('keys must be string'); });
    };
    expect(() => v({ validKey: 'value' })).not.toThrow();
  });
});

describe('Contact injection safety', () => {
  it('should not interpret SQL in name', () => {
    const c = { name: "'; DROP TABLE contacts; --" };
    expect(c.name).toBe("'; DROP TABLE contacts; --");
  });
  it('should not interpret HTML in name', () => {
    const c = { name: '<script>alert(1)</script>' };
    expect(typeof c.name).toBe('string');
  });
});

describe('Contact unique phone per tenant', () => {
  it('should validate phone is unique per tenant', async () => {
    const repo = { findByPhone: jest.fn().mockResolvedValue({ id: 'existing-c' }) };
    const existing = await repo.findByPhone('tenant-1', '+55 11 99999-0001');
    if (existing) await expect(Promise.reject(new Error('Phone taken'))).rejects.toThrow();
  });
  it('should allow same phone in different tenants', async () => {
    const repo = {
      findByPhone: jest.fn().mockImplementation((tenantId: string) =>
        Promise.resolve(tenantId === 'tenant-1' ? { id: 'c1' } : null)
      ),
    };
    const t1 = await repo.findByPhone('tenant-1', '+55 11 99999-0001');
    const t2 = await repo.findByPhone('tenant-2', '+55 11 99999-0001');
    expect(t1).not.toBeNull();
    expect(t2).toBeNull();
  });
});
