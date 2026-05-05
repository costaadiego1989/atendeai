import { ListPlatformTenantsOverviewUseCase } from '../application/use-cases/ListPlatformTenantsOverviewUseCase';

describe('ListPlatformTenantsOverviewUseCase', () => {
  it('returns paginated shape', async () => {
    const dao = {
      listOverview: jest.fn().mockResolvedValue({
        total: 50,
        items: [],
      }),
    };
    const uc = new ListPlatformTenantsOverviewUseCase(dao as any);
    const out = await uc.execute({ page: 2, limit: 10 });
    expect(out.page).toBe(2);
    expect(out.totalPages).toBe(5);
    expect(dao.listOverview).toHaveBeenCalledWith({ page: 2, limit: 10 });
  });
});
