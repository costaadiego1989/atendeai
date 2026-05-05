import { CreateSupportFeedbackUseCase } from '../application/use-cases/CreateSupportFeedbackUseCase';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';

describe('CreateSupportFeedbackUseCase', () => {
  let repository: { save: jest.Mock };
  let authUserRepository: { findById: jest.Mock };
  let structuredLog: { emit: jest.Mock };
  let sut: CreateSupportFeedbackUseCase;

  beforeEach(() => {
    repository = {
      save: jest.fn(),
    };
    authUserRepository = {
      findById: jest.fn(),
    };
    structuredLog = {
      emit: jest.fn(),
    };

    sut = new CreateSupportFeedbackUseCase(
      repository as never,
      authUserRepository as never,
      structuredLog as never,
    );
  });

  it('SUP-T-020: persiste feedback com branch quando informado', async () => {
    authUserRepository.findById.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      name: 'Paulo',
      email: { value: 'paulo@example.com' },
    });

    const result = await sut.execute({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      userId: 'user-1',
      type: 'IMPROVEMENT',
      title: 'Checkout por loja',
      description: 'Mostrar o nome da filial no detalhe do pedido',
      pagePath: '/app/checkout',
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        type: 'IMPROVEMENT',
      }),
    );
    expect(result.branchId).toBe('branch-1');
    expect(structuredLog.emit).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'support.feedback.created' }),
    );
  });

  it('SUP-T-030: utilizador de outro tenant gera EntityNotFoundException', async () => {
    authUserRepository.findById.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-outro',
      name: 'Paulo',
      email: { value: 'paulo@example.com' },
    });

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        userId: 'user-1',
        type: 'BUG',
        title: 'Erro',
        description: 'Detalhe',
      }),
    ).rejects.toBeInstanceOf(EntityNotFoundException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('SUP-T-031: utilizador inexistente gera EntityNotFoundException', async () => {
    authUserRepository.findById.mockResolvedValue(null);

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        userId: 'ghost',
        type: 'BUG',
        title: 'Erro',
        description: 'Detalhe',
      }),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('SUP-T-010: aceita título vazio após trim (comportamento atual — validação pode endurecer)', async () => {
    authUserRepository.findById.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      name: 'Paulo',
      email: { value: 'paulo@example.com' },
    });

    await sut.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      type: 'IMPROVEMENT',
      title: '   ',
      description: 'só descrição',
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ title: '', description: 'só descrição' }),
    );
  });
});
