import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { ListRecoveryCasesUseCase } from '../application/use-cases/ListRecoveryCasesUseCase';
import { GetRecoveryCaseUseCase } from '../application/use-cases/GetRecoveryCaseUseCase';
import { IRecoveryRepository } from '../domain/ports/IRecoveryRepository';

describe('Recovery — Tenant Isolation', () => {
  let recoveryRepository: jest.Mocked<IRecoveryRepository>;

  const TENANT_A = 'tenant-aaa';
  const TENANT_B = 'tenant-bbb';

  const caseFromTenantA = {
    id: 'case-1',
    tenantId: TENANT_A,
    debtorName: 'João',
    phone: '5511999990001',
    status: 'OPEN',
    source: 'MANUAL',
    assignedTags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    recoveryRepository = {
      createCase: jest.fn(),
      listCases: jest.fn(),
      findCaseById: jest.fn(),
      findLatestActiveCaseByContact: jest.fn(),
      findCaseByPaymentReference: jest.fn(),
      updateCaseStatus: jest.fn(),
      updateCaseGuidance: jest.fn(),
      updateCasePlaybookProgress: jest.fn(),
      setPaymentReference: jest.fn(),
    } as unknown as jest.Mocked<IRecoveryRepository>;
  });

  describe('ListRecoveryCasesUseCase', () => {
    let listUseCase: ListRecoveryCasesUseCase;

    beforeEach(() => {
      listUseCase = new ListRecoveryCasesUseCase(recoveryRepository);
    });

    it('should pass tenantId to repository filter', async () => {
      recoveryRepository.listCases.mockResolvedValue([]);

      await listUseCase.execute({ tenantId: TENANT_A });

      expect(recoveryRepository.listCases).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_A }),
      );
    });

    it('should not return cases from another tenant', async () => {
      recoveryRepository.listCases.mockResolvedValue([]);

      await listUseCase.execute({ tenantId: TENANT_B });

      expect(recoveryRepository.listCases).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_B }),
      );
      expect(recoveryRepository.listCases).not.toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_A }),
      );
    });

    it('should forward all filter params alongside tenantId', async () => {
      recoveryRepository.listCases.mockResolvedValue([]);
      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-12-31');

      await listUseCase.execute({
        tenantId: TENANT_A,
        status: 'OPEN',
        source: 'MANUAL',
        dateFrom,
        dateTo,
      });

      expect(recoveryRepository.listCases).toHaveBeenCalledWith({
        tenantId: TENANT_A,
        status: 'OPEN',
        source: 'MANUAL',
        dateFrom,
        dateTo,
      });
    });
  });

  describe('GetRecoveryCaseUseCase', () => {
    let getUseCase: GetRecoveryCaseUseCase;

    beforeEach(() => {
      getUseCase = new GetRecoveryCaseUseCase(recoveryRepository);
    });

    it('should scope findCaseById by tenantId', async () => {
      recoveryRepository.findCaseById.mockResolvedValue(caseFromTenantA as any);

      await getUseCase.execute({ tenantId: TENANT_A, caseId: 'case-1' });

      expect(recoveryRepository.findCaseById).toHaveBeenCalledWith(
        TENANT_A,
        'case-1',
      );
    });

    it('should throw EntityNotFoundException when case belongs to another tenant', async () => {
      recoveryRepository.findCaseById.mockResolvedValue(null);

      await expect(
        getUseCase.execute({ tenantId: TENANT_B, caseId: 'case-1' }),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(recoveryRepository.findCaseById).toHaveBeenCalledWith(
        TENANT_B,
        'case-1',
      );
    });

    it('should never query without tenantId scope', async () => {
      recoveryRepository.findCaseById.mockResolvedValue(caseFromTenantA as any);

      await getUseCase.execute({ tenantId: TENANT_A, caseId: 'case-1' });

      const [calledTenantId] = recoveryRepository.findCaseById.mock.calls[0];
      expect(calledTenantId).toBe(TENANT_A);
      expect(calledTenantId).not.toBe('');
      expect(calledTenantId).not.toBeUndefined();
    });
  });
});
