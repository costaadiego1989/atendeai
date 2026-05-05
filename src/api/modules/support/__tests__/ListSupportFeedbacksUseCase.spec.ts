import { ListSupportFeedbacksUseCase } from '../application/use-cases/ListSupportFeedbacksUseCase';
import { SupportFeedback } from '../domain/types/SupportFeedback';

describe('ListSupportFeedbacksUseCase', () => {
  it('SUP-T-022: delega ao repositório filtrando tenant e branch opcional', async () => {
    const rows: SupportFeedback[] = [
      {
        id: 'f1',
        tenantId: 'tenant-1',
        branchId: 'b1',
        userId: 'u1',
        userName: 'A',
        userEmail: 'a@test.com',
        type: 'BUG',
        title: 't',
        description: 'd',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const repository = {
      findAllByTenant: jest.fn().mockResolvedValue(rows),
    };

    const sut = new ListSupportFeedbacksUseCase(repository as never);

    const result = await sut.execute({
      tenantId: 'tenant-1',
      branchId: 'b1',
    });

    expect(repository.findAllByTenant).toHaveBeenCalledWith('tenant-1', 'b1');
    expect(result).toEqual(rows);
  });
});
