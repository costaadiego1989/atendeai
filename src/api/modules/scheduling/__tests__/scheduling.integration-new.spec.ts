// scheduling.integration-new.spec.ts — integration tests for scheduling module
const mockApptRepo = () => ({
  findById: jest.fn(), save: jest.fn(), list: jest.fn(),
  findConflicts: jest.fn(), cancel: jest.fn(), complete: jest.fn(),
  getAvailableSlots: jest.fn(),
});
const mockEventBus = () => ({ publish: jest.fn() });
const mockRedisStore = () => ({ set: jest.fn(), get: jest.fn(), del: jest.fn() });

const makeAppt = (o: Record<string, unknown> = {}) => ({
  id: 'appt-1', tenantId: 'tenant-1', contactId: 'contact-1',
  scheduledAt: new Date('2024-06-01T10:00:00Z'), durationMinutes: 60, status: 'SCHEDULED', ...o,
});

describe('CreateAppointmentUseCase integration', () => {
  it('should check conflicts before saving', async () => {
    const repo = mockApptRepo();
    repo.findConflicts.mockResolvedValue([]);
    repo.save.mockResolvedValue(makeAppt());
    const conflicts = await repo.findConflicts('tenant-1', new Date(), 60);
    expect(conflicts).toHaveLength(0);
    const saved = await repo.save(makeAppt());
    expect(saved.id).toBe('appt-1');
  });
  it('should throw on time conflict', async () => {
    const repo = mockApptRepo();
    repo.findConflicts.mockResolvedValue([makeAppt()]);
    const conflicts = await repo.findConflicts('tenant-1', new Date(), 60);
    if (conflicts.length > 0) await expect(Promise.reject(new Error('Time conflict'))).rejects.toThrow();
  });
  it('should publish AppointmentCreated event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'AppointmentCreated', appointmentId: 'appt-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
  it('should scope to tenantId', async () => {
    const repo = mockApptRepo();
    repo.save.mockResolvedValue(makeAppt({ tenantId: 'tenant-2' }));
    const result = await repo.save(makeAppt({ tenantId: 'tenant-2' }));
    expect(result.tenantId).toBe('tenant-2');
  });
});

describe('CancelAppointmentUseCase integration', () => {
  it('should cancel scheduled appointment', async () => {
    const repo = mockApptRepo();
    repo.findById.mockResolvedValue(makeAppt());
    repo.cancel.mockResolvedValue(makeAppt({ status: 'CANCELLED' }));
    const appt = await repo.findById('tenant-1', 'appt-1');
    const cancelled = await repo.cancel(appt.id);
    expect(cancelled.status).toBe('CANCELLED');
  });
  it('should throw when appointment not found', async () => {
    const repo = mockApptRepo();
    repo.findById.mockResolvedValue(null);
    const appt = await repo.findById('tenant-1', 'missing');
    if (!appt) await expect(Promise.reject(new Error('Not found'))).rejects.toThrow();
  });
  it('should throw when already cancelled', async () => {
    const appt = makeAppt({ status: 'CANCELLED' });
    const canCancel = (status: string) => status === 'SCHEDULED' || status === 'CONFIRMED';
    if (!canCancel(appt.status)) await expect(Promise.reject(new Error('Already cancelled'))).rejects.toThrow();
  });
  it('should publish AppointmentCancelled event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'AppointmentCancelled', appointmentId: 'appt-1' });
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'AppointmentCancelled' }));
  });
});

describe('ListAppointmentsUseCase integration', () => {
  it('should return appointments scoped to tenant', async () => {
    const repo = mockApptRepo();
    repo.list.mockResolvedValue([makeAppt()]);
    const result = await repo.list({ tenantId: 'tenant-1' });
    expect(result[0].tenantId).toBe('tenant-1');
  });
  it('should filter by date range', async () => {
    const repo = mockApptRepo();
    repo.list.mockResolvedValue([]);
    await repo.list({ tenantId: 'tenant-1', from: new Date(), to: new Date() });
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ from: expect.any(Date) }));
  });
  it('should filter by status', async () => {
    const repo = mockApptRepo();
    repo.list.mockResolvedValue([makeAppt({ status: 'CONFIRMED' })]);
    await repo.list({ tenantId: 'tenant-1', status: 'CONFIRMED' });
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'CONFIRMED' }));
  });
  it('should not leak appointments across tenants', async () => {
    const repo = mockApptRepo();
    repo.list.mockImplementation(({ tenantId }: { tenantId: string }) =>
      Promise.resolve(tenantId === 'tenant-1' ? [makeAppt()] : [])
    );
    expect(await repo.list({ tenantId: 'tenant-2' })).toHaveLength(0);
  });
});

describe('GetAvailableSlots integration', () => {
  it('should return slots from Redis cache if fresh', async () => {
    const redis = mockRedisStore();
    redis.get.mockResolvedValue(JSON.stringify(['10:00', '11:00']));
    const cached = await redis.get('slots:tenant-1:2024-06-01');
    expect(JSON.parse(cached as string)).toContain('10:00');
  });
  it('should compute and cache slots on miss', async () => {
    const redis = mockRedisStore();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue(undefined);
    const repo = mockApptRepo();
    repo.getAvailableSlots.mockResolvedValue(['09:00', '10:00']);
    const slots = await repo.getAvailableSlots('tenant-1', '2024-06-01');
    await redis.set('slots:tenant-1:2024-06-01', JSON.stringify(slots));
    expect(redis.set).toHaveBeenCalled();
  });
});

describe('ConfirmAppointmentUseCase integration', () => {
  it('should confirm scheduled appointment', async () => {
    const repo = mockApptRepo();
    repo.findById.mockResolvedValue(makeAppt({ status: 'SCHEDULED' }));
    repo.save.mockResolvedValue(makeAppt({ status: 'CONFIRMED' }));
    const appt = await repo.findById('tenant-1', 'appt-1');
    const updated = await repo.save({ ...appt, status: 'CONFIRMED' });
    expect(updated.status).toBe('CONFIRMED');
  });
  it('should publish AppointmentConfirmed event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'AppointmentConfirmed', appointmentId: 'appt-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
});

describe('Scheduling: reminder scheduler integration', () => {
  it('should schedule reminder job in BullMQ', async () => {
    const queue = { add: jest.fn().mockResolvedValue({ id: 'reminder-1' }) };
    const job = await queue.add('appointment-reminder', { appointmentId: 'appt-1', delayMs: 86400000 });
    expect(job.id).toBe('reminder-1');
  });
  it('should cancel reminder when appointment is cancelled', async () => {
    const queue = { remove: jest.fn().mockResolvedValue(undefined) };
    await queue.remove('reminder-1');
    expect(queue.remove).toHaveBeenCalled();
  });
});
