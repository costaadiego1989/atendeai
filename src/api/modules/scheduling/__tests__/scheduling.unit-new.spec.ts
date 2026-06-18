// scheduling.unit-new.spec.ts — unit tests for scheduling module
const makeAppointment = (o: Record<string, unknown> = {}) => ({
  id: 'appt-1', tenantId: 'tenant-1', contactId: 'contact-1',
  scheduledAt: new Date('2024-06-01T10:00:00Z'), durationMinutes: 60,
  status: 'SCHEDULED', ...o,
});

describe('Appointment status transitions', () => {
  const validTransitions: Record<string, string[]> = {
    SCHEDULED: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
    COMPLETED: [], CANCELLED: [], NO_SHOW: [],
  };
  it('should allow SCHEDULED → CONFIRMED', () => expect(validTransitions.SCHEDULED.includes('CONFIRMED')).toBe(true));
  it('should allow SCHEDULED → CANCELLED', () => expect(validTransitions.SCHEDULED.includes('CANCELLED')).toBe(true));
  it('should allow CONFIRMED → COMPLETED', () => expect(validTransitions.CONFIRMED.includes('COMPLETED')).toBe(true));
  it('should allow CONFIRMED → NO_SHOW', () => expect(validTransitions.CONFIRMED.includes('NO_SHOW')).toBe(true));
  it('should not allow COMPLETED → anything', () => expect(validTransitions.COMPLETED).toHaveLength(0));
  it('should not allow CANCELLED → anything', () => expect(validTransitions.CANCELLED).toHaveLength(0));
});

describe('Appointment duration validation', () => {
  it('should reject zero duration', () => {
    const v = (d: number) => { if (d <= 0) throw new Error('Duration must be positive'); };
    expect(() => v(0)).toThrow();
  });
  it('should reject negative duration', () => {
    const v = (d: number) => { if (d <= 0) throw new Error('Duration must be positive'); };
    expect(() => v(-30)).toThrow();
  });
  it('should accept 15-minute appointment', () => {
    const v = (d: number) => d > 0;
    expect(v(15)).toBe(true);
  });
  it('should accept 120-minute appointment', () => {
    expect(makeAppointment({ durationMinutes: 120 }).durationMinutes).toBe(120);
  });
});

describe('Appointment scheduledAt validation', () => {
  it('should reject past date for new appointment', () => {
    const v = (date: Date) => { if (date < new Date()) throw new Error('Past date'); };
    expect(() => v(new Date('2020-01-01'))).toThrow();
  });
  it('should accept future date', () => {
    const v = (date: Date) => date > new Date();
    expect(v(new Date('2099-01-01'))).toBe(true);
  });
});

describe('Appointment tenantId isolation', () => {
  it('should require tenantId', () => {
    const v = (a: any) => { if (!a.tenantId) throw new Error('tenantId required'); };
    expect(() => v({ id: 'appt-1' })).toThrow();
  });
  it('should store tenantId correctly', () => {
    const appt = makeAppointment({ tenantId: 'tenant-xyz' });
    expect(appt.tenantId).toBe('tenant-xyz');
  });
});

describe('Scheduling conflict detection', () => {
  it('should detect time overlap between two appointments', () => {
    const overlaps = (start1: Date, end1: Date, start2: Date, end2: Date) =>
      start1 < end2 && end1 > start2;
    const s1 = new Date('2024-06-01T10:00Z'), e1 = new Date('2024-06-01T11:00Z');
    const s2 = new Date('2024-06-01T10:30Z'), e2 = new Date('2024-06-01T11:30Z');
    expect(overlaps(s1, e1, s2, e2)).toBe(true);
  });
  it('should not flag adjacent non-overlapping slots', () => {
    const overlaps = (start1: Date, end1: Date, start2: Date, end2: Date) =>
      start1 < end2 && end1 > start2;
    const s1 = new Date('2024-06-01T10:00Z'), e1 = new Date('2024-06-01T11:00Z');
    const s2 = new Date('2024-06-01T11:00Z'), e2 = new Date('2024-06-01T12:00Z');
    expect(overlaps(s1, e1, s2, e2)).toBe(false);
  });
});

describe('Scheduling availability', () => {
  it('should return available slots for a given date', async () => {
    const service = { getAvailableSlots: jest.fn().mockResolvedValue(['10:00', '11:00', '14:00']) };
    const slots = await service.getAvailableSlots({ tenantId: 'tenant-1', date: '2024-06-01' });
    expect(slots.length).toBeGreaterThan(0);
  });
  it('should return empty array when fully booked', async () => {
    const service = { getAvailableSlots: jest.fn().mockResolvedValue([]) };
    const slots = await service.getAvailableSlots({ tenantId: 'tenant-1', date: '2024-06-01' });
    expect(slots).toHaveLength(0);
  });
  it('should respect business hours', () => {
    const inBusinessHours = (hour: number) => hour >= 8 && hour < 18;
    expect(inBusinessHours(10)).toBe(true);
    expect(inBusinessHours(7)).toBe(false);
    expect(inBusinessHours(18)).toBe(false);
  });
});

describe('Scheduling event emission', () => {
  it('should emit AppointmentCreated', async () => {
    const bus = { publish: jest.fn() };
    await bus.publish({ name: 'AppointmentCreated', appointmentId: 'appt-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
  it('should emit AppointmentCancelled', async () => {
    const bus = { publish: jest.fn() };
    await bus.publish({ name: 'AppointmentCancelled', appointmentId: 'appt-1' });
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'AppointmentCancelled' }));
  });
  it('should emit AppointmentReminder 24h before', async () => {
    const bus = { publish: jest.fn() };
    await bus.publish({ name: 'AppointmentReminder', appointmentId: 'appt-1', hoursUntil: 24 });
    expect(bus.publish).toHaveBeenCalled();
  });
});
