import { GetGoogleCalendarConnectionStatusUseCase } from '../application/use-cases/GetGoogleCalendarConnectionStatusUseCase';
import { ISchedulingGoogleCalendarConnectionRepository } from '../domain/ports/ISchedulingGoogleCalendarConnectionRepository';

describe('GetGoogleCalendarConnectionStatusUseCase', () => {
  let useCase: GetGoogleCalendarConnectionStatusUseCase;
  let repository: jest.Mocked<ISchedulingGoogleCalendarConnectionRepository>;

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      findByScope: jest.fn(),
      findBestForScope: jest.fn(),
      deleteByScope: jest.fn(),
    };

    useCase = new GetGoogleCalendarConnectionStatusUseCase(repository);
  });

  it('should return branch scope when the active branch has its own connection', async () => {
    const branchConnection = {
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      googleEmail: 'branch@test.com',
      refreshToken: 'refresh-token',
      calendarId: 'calendar-branch',
      status: 'CONNECTED' as const,
      connectedAt: '2026-04-09T12:00:00.000Z',
      updatedAt: '2026-04-09T12:00:00.000Z',
    };

    repository.findByScope.mockResolvedValue(branchConnection);
    repository.findBestForScope.mockResolvedValue(branchConnection);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
    });

    expect(result).toEqual({
      connected: true,
      status: 'CONNECTED',
      googleEmail: 'branch@test.com',
      calendarId: 'calendar-branch',
      scope: 'BRANCH',
      connectedAt: '2026-04-09T12:00:00.000Z',
      updatedAt: '2026-04-09T12:00:00.000Z',
    });
  });

  it('should return tenant scope when the branch inherits the tenant connection', async () => {
    const tenantConnection = {
      tenantId: 'tenant-1',
      branchId: null,
      googleEmail: 'tenant@test.com',
      refreshToken: 'refresh-token',
      calendarId: 'calendar-tenant',
      status: 'CONNECTED' as const,
      connectedAt: '2026-04-09T12:00:00.000Z',
      updatedAt: '2026-04-09T12:00:00.000Z',
    };

    repository.findByScope.mockResolvedValue(null);
    repository.findBestForScope.mockResolvedValue(tenantConnection);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      branchId: 'branch-2',
    });

    expect(result.scope).toBe('TENANT');
    expect(result.connected).toBe(true);
    expect(result.calendarId).toBe('calendar-tenant');
  });

  it('should return none when no connection exists for the tenant', async () => {
    repository.findByScope.mockResolvedValue(null);
    repository.findBestForScope.mockResolvedValue(null);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      branchId: 'branch-2',
    });

    expect(result).toEqual({
      connected: false,
      status: 'NOT_CONNECTED',
      googleEmail: undefined,
      calendarId: undefined,
      scope: 'NONE',
      connectedAt: undefined,
      updatedAt: undefined,
    });
  });
});
