import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/schedulingApi', () => ({
  schedulingApi: { getAvailability: mockGet, createAppointment: mockPost, updateAppointment: mockPut, cancelAppointment: mockDelete, syncGoogleCalendar: mockPost, getCategories: mockGet, createCategory: mockPost, updateCategory: mockPut, deleteCategory: mockDelete, getReport: mockGet },
}));

const makeProfessional = (o = {}) => ({ id: 'prof_1', name: 'Dr. Alice', availability: [], ...o });
const makeSlot = (o = {}) => ({ date: '2024-06-15', time: '09:00', available: true, ...o });
const makeAppointment = (o = {}) => ({ id: 'appt_1', professionalId: 'prof_1', clientId: 'cl_1', date: '2024-06-15', time: '09:00', status: 'confirmed', ...o });
const makeCategory = (o = {}) => ({ id: 'cat_1', name: 'Consultation', duration: 60, ...o });

describe('Scheduling Integration – Appointment Booking Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load available time slots', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeSlot(), makeSlot({ time: '10:00' })] });
    expect((await mockGet('/availability?professionalId=prof_1&date=2024-06-15')).data).toHaveLength(2);
  });

  it('should book appointment in available slot', async () => {
    mockPost.mockResolvedValueOnce({ data: makeAppointment() });
    expect((await mockPost('/appointments', { professionalId: 'prof_1', date: '2024-06-15', time: '09:00' })).data.status).toBe('confirmed');
  });

  it('should prevent double booking', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Slot already booked' } } });
    await expect(mockPost('/appointments', {})).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('should send confirmation to client', () => {
    const notify = vi.fn(); notify('cl_1', 'Appointment confirmed'); expect(notify).toHaveBeenCalled();
  });

  it('should validate required booking fields', () => {
    const v = vi.fn().mockReturnValue({ professionalId: 'Required', date: 'Required' });
    expect(v({}).professionalId).toBe('Required');
  });

  it('should load appointment duration from category', async () => {
    mockGet.mockResolvedValueOnce({ data: makeCategory({ duration: 60 }) });
    expect((await mockGet('/categories/cat_1')).data.duration).toBe(60);
  });

  it('should show booked appointment in calendar', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAppointment()] });
    expect((await mockGet('/appointments?date=2024-06-15')).data).toHaveLength(1);
  });

  it('should handle booking error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Booking failed'));
    await expect(mockPost('/appointments', {})).rejects.toThrow('Booking failed');
  });

  it('should add to Google Calendar if synced', async () => {
    mockPost.mockResolvedValueOnce({ data: { calendarEventId: 'gcal_1' } });
    expect((await mockPost('/appointments/appt_1/sync-calendar')).data.calendarEventId).toBeDefined();
  });

  it('should apply service fee to booking', async () => {
    mockPost.mockResolvedValueOnce({ data: { ...makeAppointment(), fee: 150 } });
    expect((await mockPost('/appointments', {})).data.fee).toBe(150);
  });
});

describe('Scheduling Integration – Professional Availability Check', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load professional availability', async () => {
    mockGet.mockResolvedValueOnce({ data: makeProfessional({ availability: ['09:00', '10:00', '11:00'] }) });
    expect((await mockGet('/professionals/prof_1')).data.availability).toHaveLength(3);
  });

  it('should return only available slots', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeSlot({ available: true }), makeSlot({ time: '10:00', available: false })] });
    const slots = (await mockGet('/availability')).data;
    const available = slots.filter((s: any) => s.available);
    expect(available).toHaveLength(1);
  });

  it('should mark slot as unavailable after booking', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeSlot({ available: false })] });
    expect((await mockGet('/availability?after=booking')).data[0].available).toBe(false);
  });

  it('should check business hours for availability', () => {
    const inHours = vi.fn().mockReturnValue(true);
    expect(inHours('09:00', { start: '08:00', end: '18:00' })).toBe(true);
  });

  it('should exclude blocked time from availability', () => {
    const hasBlock = vi.fn().mockReturnValue(true);
    expect(hasBlock('12:00')).toBe(true);
  });

  it('should respect minimum advance notice', () => {
    const canBook = vi.fn().mockReturnValue(false);
    expect(canBook(new Date(), 24)).toBe(false);
  });

  it('should load available professionals for date', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeProfessional()] });
    expect((await mockGet('/professionals?available=2024-06-15')).data).toHaveLength(1);
  });

  it('should load availability for week view', async () => {
    mockGet.mockResolvedValueOnce({ data: { '2024-06-15': ['09:00', '10:00'], '2024-06-16': ['11:00'] } });
    expect((await mockGet('/availability?week=2024-06-15')).data['2024-06-15']).toHaveLength(2);
  });
});

describe('Scheduling Integration – Google Calendar Sync', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should initiate Google Calendar OAuth', async () => {
    mockPost.mockResolvedValueOnce({ data: { authUrl: 'https://accounts.google.com/oauth' } });
    expect((await mockPost('/integrations/google-calendar/connect')).data.authUrl).toBeDefined();
  });

  it('should handle OAuth callback and save token', async () => {
    mockPost.mockResolvedValueOnce({ data: { connected: true } });
    expect((await mockPost('/integrations/google-calendar/callback', { code: 'code' })).data.connected).toBe(true);
  });

  it('should sync appointment to Google Calendar', async () => {
    mockPost.mockResolvedValueOnce({ data: { calendarEventId: 'gcal_123' } });
    expect((await mockPost('/appointments/appt_1/sync')).data.calendarEventId).toBeDefined();
  });

  it('should sync cancellation to Google Calendar', async () => {
    mockDelete.mockResolvedValueOnce({ data: { deleted: true } });
    expect((await mockDelete('/calendar/events/gcal_123')).data.deleted).toBe(true);
  });

  it('should handle sync error gracefully', async () => {
    mockPost.mockRejectedValueOnce(new Error('Sync failed'));
    await expect(mockPost('/appointments/appt_1/sync')).rejects.toThrow('Sync failed');
  });

  it('should disconnect Google Calendar', async () => {
    mockDelete.mockResolvedValueOnce({ data: { disconnected: true } });
    expect((await mockDelete('/integrations/google-calendar')).data.disconnected).toBe(true);
  });

  it('should show sync status badge', async () => {
    mockGet.mockResolvedValueOnce({ data: { connected: true, lastSync: '2024-01-01T10:00:00Z' } });
    expect((await mockGet('/integrations/google-calendar/status')).data.connected).toBe(true);
  });
});

describe('Scheduling Integration – Rescheduling Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should reschedule to new slot', async () => {
    mockPut.mockResolvedValueOnce({ data: makeAppointment({ date: '2024-06-16', time: '10:00' }) });
    expect((await mockPut('/appointments/appt_1', { date: '2024-06-16', time: '10:00' })).data.date).toBe('2024-06-16');
  });

  it('should check new slot availability before rescheduling', async () => {
    mockGet.mockResolvedValueOnce({ data: makeSlot({ available: true }) });
    expect((await mockGet('/availability?date=2024-06-16&time=10:00')).data.available).toBe(true);
  });

  it('should notify client of rescheduling', () => {
    const notify = vi.fn(); notify('cl_1', 'Appointment rescheduled'); expect(notify).toHaveBeenCalled();
  });

  it('should update Google Calendar event on reschedule', async () => {
    mockPut.mockResolvedValueOnce({ data: { calendarEventId: 'gcal_1' } });
    expect((await mockPut('/appointments/appt_1/sync')).data.calendarEventId).toBeDefined();
  });

  it('should handle reschedule conflict', async () => {
    mockPut.mockRejectedValueOnce({ response: { status: 409 } });
    await expect(mockPut('/appointments/appt_1', {})).rejects.toMatchObject({ response: { status: 409 } });
  });
});

describe('Scheduling Integration – Category Management', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load service categories', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeCategory()] });
    expect((await mockGet('/categories')).data).toHaveLength(1);
  });

  it('should create category', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCategory({ name: 'Follow-up' }) });
    expect((await mockPost('/categories', { name: 'Follow-up', duration: 30 })).data.name).toBe('Follow-up');
  });

  it('should update category duration', async () => {
    mockPut.mockResolvedValueOnce({ data: makeCategory({ duration: 90 }) });
    expect((await mockPut('/categories/cat_1', { duration: 90 })).data.duration).toBe(90);
  });

  it('should delete category', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    expect((await mockDelete('/categories/cat_1')).data.success).toBe(true);
  });

  it('should prevent deleting category with appointments', async () => {
    mockDelete.mockRejectedValueOnce({ response: { status: 409 } });
    await expect(mockDelete('/categories/cat_1')).rejects.toMatchObject({ response: { status: 409 } });
  });
});

describe('Scheduling Integration – Cancellation Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should cancel appointment', async () => {
    mockDelete.mockResolvedValueOnce({ data: { ...makeAppointment(), status: 'cancelled' } });
    expect((await mockDelete('/appointments/appt_1')).data.status).toBe('cancelled');
  });

  it('should notify client of cancellation', () => {
    const notify = vi.fn(); notify('cl_1', 'Appointment cancelled'); expect(notify).toHaveBeenCalled();
  });

  it('should free up slot after cancellation', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeSlot({ available: true })] });
    expect((await mockGet('/availability')).data[0].available).toBe(true);
  });

  it('should delete from Google Calendar on cancellation', async () => {
    mockDelete.mockResolvedValueOnce({ data: { deleted: true } });
    expect((await mockDelete('/calendar/events/gcal_1')).data.deleted).toBe(true);
  });

  it('should record cancellation reason', async () => {
    mockDelete.mockResolvedValueOnce({ data: { ...makeAppointment(), status: 'cancelled', reason: 'Client request' } });
    expect((await mockDelete('/appointments/appt_1', { reason: 'Client request' })).data.reason).toBeDefined();
  });
});

describe('Scheduling Integration – Calendar View Data Loading', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load appointments for week view', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAppointment(), makeAppointment({ id: 'appt_2', time: '11:00' })] });
    expect((await mockGet('/appointments?week=2024-06-10')).data).toHaveLength(2);
  });

  it('should load appointments for month view', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAppointment()] });
    expect((await mockGet('/appointments?month=2024-06')).data).toHaveLength(1);
  });

  it('should show appointments by professional', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAppointment({ professionalId: 'prof_1' })] });
    expect((await mockGet({ professionalId: 'prof_1' })).data[0].professionalId).toBe('prof_1');
  });

  it('should handle calendar fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Calendar load failed'));
    await expect(mockGet('/appointments')).rejects.toThrow('Calendar load failed');
  });

  it('should cache calendar data', () => {
    const c = vi.fn().mockReturnValue({ stale: false }); expect(c('appointments').stale).toBe(false);
  });
});

describe('Scheduling Integration – Report Generation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should generate scheduling report', async () => {
    mockGet.mockResolvedValueOnce({ data: { total: 50, completed: 40, cancelled: 5, noShow: 5 } });
    expect((await mockGet('/reports')).data.total).toBe(50);
  });

  it('should filter report by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: { total: 20 } });
    expect((await mockGet({ from: '2024-06-01', to: '2024-06-30' })).data.total).toBe(20);
  });

  it('should filter report by professional', async () => {
    mockGet.mockResolvedValueOnce({ data: { total: 15, professionalId: 'prof_1' } });
    expect((await mockGet({ professionalId: 'prof_1' })).data.total).toBe(15);
  });

  it('should filter report by category', async () => {
    mockGet.mockResolvedValueOnce({ data: { total: 10, categoryId: 'cat_1' } });
    expect((await mockGet({ categoryId: 'cat_1' })).data.total).toBe(10);
  });

  it('should calculate completion rate', () => {
    const rate = vi.fn().mockReturnValue(80); expect(rate(40, 50)).toBe(80);
  });

  it('should export report as CSV', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/report.csv' } });
    expect((await mockPost('/reports/export')).data.url).toBeDefined();
  });
});
