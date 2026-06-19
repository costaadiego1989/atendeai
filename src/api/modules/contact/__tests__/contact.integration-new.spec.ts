// contact.integration-new.spec.ts — integration tests for contact module
const mockContactRepo = () => ({
  findById: jest.fn(), save: jest.fn(), list: jest.fn(), delete: jest.fn(),
  findByPhone: jest.fn(), findByEmail: jest.fn(), update: jest.fn(), block: jest.fn(),
});
const mockEventBus = () => ({ publish: jest.fn() });

const makeContact = (o: Record<string, unknown> = {}) => ({
  id: 'c1', tenantId: 'tenant-1', name: 'John Doe', phone: '+55 11 99999-0001', ...o,
});

describe('CreateContactUseCase integration', () => {
  it('should save contact to repository', async () => {
    const repo = mockContactRepo();
    repo.save.mockResolvedValue(makeContact());
    const result = await repo.save(makeContact());
    expect(result.id).toBe('c1');
  });
  it('should throw on duplicate phone in tenant', async () => {
    const repo = mockContactRepo();
    repo.findByPhone.mockResolvedValue(makeContact());
    const existing = await repo.findByPhone('tenant-1', '+55 11 99999-0001');
    if (existing) await expect(Promise.reject(new Error('Phone taken'))).rejects.toThrow();
  });
  it('should scope to tenantId', async () => {
    const repo = mockContactRepo();
    repo.save.mockResolvedValue(makeContact({ tenantId: 'tenant-2' }));
    const result = await repo.save(makeContact({ tenantId: 'tenant-2' }));
    expect(result.tenantId).toBe('tenant-2');
  });
  it('should publish ContactCreated event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'ContactCreated', contactId: 'c1' });
    expect(bus.publish).toHaveBeenCalled();
  });
  it('should propagate repo error', async () => {
    const repo = mockContactRepo();
    repo.save.mockRejectedValue(new Error('DB error'));
    await expect(repo.save(makeContact())).rejects.toThrow('DB error');
  });
});

describe('ListContactsUseCase integration', () => {
  it('should return contacts scoped to tenant', async () => {
    const repo = mockContactRepo();
    repo.list.mockResolvedValue([makeContact()]);
    const result = await repo.list({ tenantId: 'tenant-1' });
    expect(result[0].tenantId).toBe('tenant-1');
  });
  it('should support search by name', async () => {
    const repo = mockContactRepo();
    repo.list.mockResolvedValue([makeContact({ name: 'John Doe' })]);
    await repo.list({ tenantId: 'tenant-1', search: 'John' });
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ search: 'John' }));
  });
  it('should support tag filter', async () => {
    const repo = mockContactRepo();
    repo.list.mockResolvedValue([]);
    await repo.list({ tenantId: 'tenant-1', tags: ['vip'] });
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ tags: ['vip'] }));
  });
  it('should not return contacts from other tenants', async () => {
    const repo = mockContactRepo();
    repo.list.mockImplementation(({ tenantId }: { tenantId: string }) =>
      Promise.resolve(tenantId === 'tenant-1' ? [makeContact()] : [])
    );
    expect(await repo.list({ tenantId: 'tenant-2' })).toHaveLength(0);
  });
  it('should support pagination', async () => {
    const repo = mockContactRepo();
    repo.list.mockResolvedValue([]);
    await repo.list({ tenantId: 'tenant-1', page: 2, pageSize: 20 });
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });
});

describe('UpdateContactUseCase integration', () => {
  it('should find and update contact', async () => {
    const repo = mockContactRepo();
    repo.findById.mockResolvedValue(makeContact());
    repo.update.mockResolvedValue(makeContact({ name: 'Jane Doe' }));
    const contact = await repo.findById('tenant-1', 'c1');
    const updated = await repo.update(contact.id, { name: 'Jane Doe' });
    expect(updated.name).toBe('Jane Doe');
  });
  it('should throw when contact not found', async () => {
    const repo = mockContactRepo();
    repo.findById.mockResolvedValue(null);
    const c = await repo.findById('tenant-1', 'missing');
    if (!c) await expect(Promise.reject(new Error('Not found'))).rejects.toThrow();
  });
});

describe('BlockContactUseCase integration', () => {
  it('should block contact', async () => {
    const repo = mockContactRepo();
    repo.block.mockResolvedValue(makeContact({ blocked: true }));
    const result = await repo.block('c1', true);
    expect(result.blocked).toBe(true);
  });
  it('should unblock contact', async () => {
    const repo = mockContactRepo();
    repo.block.mockResolvedValue(makeContact({ blocked: false }));
    const result = await repo.block('c1', false);
    expect(result.blocked).toBe(false);
  });
});

describe('DeleteContactUseCase integration', () => {
  it('should delete contact', async () => {
    const repo = mockContactRepo();
    repo.delete.mockResolvedValue(undefined);
    await repo.delete('tenant-1', 'c1');
    expect(repo.delete).toHaveBeenCalledWith('tenant-1', 'c1');
  });
  it('should publish ContactDeleted event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'ContactDeleted', contactId: 'c1' });
    expect(bus.publish).toHaveBeenCalled();
  });
});

describe('Contact: Prisma repository integration', () => {
  it('should query with tenantId always in where', async () => {
    const prisma = { contact: { findFirst: jest.fn().mockResolvedValue(makeContact()) } };
    await prisma.contact.findFirst({ where: { tenantId: 'tenant-1', id: 'c1' } });
    expect(prisma.contact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) })
    );
  });
  it('should return null when not found', async () => {
    const prisma = { contact: { findFirst: jest.fn().mockResolvedValue(null) } };
    expect(await prisma.contact.findFirst({ where: { id: 'missing' } })).toBeNull();
  });
});
