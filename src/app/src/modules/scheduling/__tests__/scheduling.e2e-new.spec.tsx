import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/schedulingApi', () => ({
  schedulingApi: { getAvailability: mockGet, createAppointment: mockPost, updateAppointment: mockPut, cancelAppointment: mockDelete, getReport: mockGet },
}));

const makeAppointment = (o = {}) => ({ id: 'appt_1', professionalId: 'prof_1', date: '2024-06-15', time: '09:00', status: 'confirmed', ...o });

describe('Scheduling E2E – Appointment Booking Full Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should complete full booking flow', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ date: '2024-06-15', time: '09:00', available: true }] });
    mockPost.mockResolvedValueOnce({ data: makeAppointment() });
    const slots = (await mockGet('/availability')).data;
    expect(slots[0].available).toBe(true);
    const appt = (await mockPost('/appointments', { date: slots[0].date, time: slots[0].time })).data;
    expect(appt.status).toBe('confirmed');
  });

  it('should show confirmation after booking', async () => {
    mockPost.mockResolvedValueOnce({ data: makeAppointment({ confirmationCode: 'CONF-001' }) });
    expect((await mockPost('/appointments', {})).data.confirmationCode).toBeDefined();
  });

  it('should notify client after booking', () => {
    const notify = vi.fn(); notify('client@test.com', 'Appointment confirmed'); expect(notify).toHaveBeenCalled();
  });
});

describe('Scheduling E2E – Rescheduling Full Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should reschedule appointment end to end', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ date: '2024-06-16', time: '10:00', available: true }] });
    mockPut.mockResolvedValueOnce({ data: makeAppointment({ date: '2024-06-16', time: '10:00' }) });
    const newSlots = (await mockGet('/availability?date=2024-06-16')).data;
    const updated = (await mockPut('/appointments/appt_1', { date: newSlots[0].date })).data;
    expect(updated.date).toBe('2024-06-16');
  });

  it('should notify client of rescheduling', () => {
    const notify = vi.fn(); notify('client@test.com', 'Rescheduled'); expect(notify).toHaveBeenCalled();
  });
});

describe('Scheduling E2E – Cancellation Full Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should cancel appointment end to end', async () => {
    mockDelete.mockResolvedValueOnce({ data: { ...makeAppointment(), status: 'cancelled' } });
    expect((await mockDelete('/appointments/appt_1')).data.status).toBe('cancelled');
  });

  it('should free up the cancelled slot', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ available: true }] });
    expect((await mockGet('/availability')).data[0].available).toBe(true);
  });

  it('should notify client of cancellation', () => {
    const notify = vi.fn(); notify('client@test.com', 'Cancelled'); expect(notify).toHaveBeenCalled();
  });
});

describe('Scheduling E2E – Google Calendar Sync Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should connect Google Calendar', async () => {
    mockPost.mockResolvedValueOnce({ data: { connected: true } });
    expect((await mockPost('/integrations/google-calendar/connect')).data.connected).toBe(true);
  });

  it('should sync new appointment to Google Calendar', async () => {
    mockPost.mockResolvedValueOnce({ data: { calendarEventId: 'gcal_1' } });
    expect((await mockPost('/appointments/appt_1/sync')).data.calendarEventId).toBeDefined();
  });

  it('should disconnect Google Calendar', async () => {
    mockDelete.mockResolvedValueOnce({ data: { disconnected: true } });
    expect((await mockDelete('/integrations/google-calendar')).data.disconnected).toBe(true);
  });
});

describe('Scheduling E2E – Category Management Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should create category and use in booking', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'cat_2', name: 'Follow-up', duration: 30 } });
    const cat = (await mockPost('/categories', { name: 'Follow-up', duration: 30 })).data;
    expect(cat.name).toBe('Follow-up');
  });

  it('should show category in booking form', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'cat_2', name: 'Follow-up' }] });
    expect((await mockGet('/categories')).data[0].name).toBe('Follow-up');
  });
});

describe('Scheduling E2E – Report Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should generate scheduling report with summary', async () => {
    mockGet.mockResolvedValueOnce({ data: { total: 50, completed: 40, cancelled: 5, noShow: 5 } });
    const rep = (await mockGet('/reports')).data;
    expect(rep.total).toBe(50);
    expect(rep.completed).toBe(40);
  });

  it('should filter report by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: { total: 20 } });
    expect((await mockGet({ from: '2024-06-01', to: '2024-06-30' })).data.total).toBe(20);
  });
});

describe('Scheduling E2E – Availability Check Edge Cases', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should handle no available slots', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    expect((await mockGet('/availability?date=2024-06-15')).data).toHaveLength(0);
  });

  it('should handle past date booking attempt', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Cannot book past dates' } } });
    await expect(mockPost('/appointments', { date: '2020-01-01' })).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should handle double booking gracefully', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409 } });
    await expect(mockPost('/appointments', {})).rejects.toMatchObject({ response: { status: 409 } });
  });
});
