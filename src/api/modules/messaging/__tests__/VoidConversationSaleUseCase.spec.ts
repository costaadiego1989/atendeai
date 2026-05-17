import { VoidConversationSaleUseCase } from '../application/use-cases/VoidConversationSaleUseCase';
import {
  EntityNotFoundException,
  ForbiddenException,
  UnauthorizedException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';

describe('VoidConversationSaleUseCase', () => {
  let sut: VoidConversationSaleUseCase;
  let conversationRepository: { findById: jest.Mock };
  let prisma: {
    conversationSaleEvent: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    conversationRepository = {
      findById: jest.fn(),
    };
    prisma = {
      conversationSaleEvent: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    sut = new VoidConversationSaleUseCase(
      conversationRepository as any,
      prisma as any,
    );
  });

  it('should void an existing active sale attribution', async () => {
    conversationRepository.findById.mockResolvedValue({
      id: 'conversation-1',
      tenantId: { toString: () => 'tenant-1' },
    });
    prisma.conversationSaleEvent.findFirst.mockResolvedValue({
      id: 'sale-1',
      markedByUserId: 'user-1',
      lifecycleStatus: 'ACTIVE',
    });
    prisma.conversationSaleEvent.update.mockResolvedValue({
      id: 'sale-1',
      lifecycleStatus: 'VOIDED',
    });

    const result = await sut.execute({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      actorUserId: 'user-1',
      actorRole: 'OWNER',
    });

    expect(prisma.conversationSaleEvent.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { lifecycleStatus: 'VOIDED' },
    });
    expect(result).toEqual({
      id: 'sale-1',
      lifecycleStatus: 'VOIDED',
    });
  });

  it('should throw EntityNotFoundException when conversation does not exist', async () => {
    conversationRepository.findById.mockResolvedValue(null);

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        conversationId: 'non-existent',
        actorUserId: 'user-1',
        actorRole: 'OWNER',
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should throw UnauthorizedException when conversation belongs to a different tenant', async () => {
    conversationRepository.findById.mockResolvedValue({
      id: 'conversation-1',
      tenantId: { toString: () => 'tenant-other' },
    });

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        conversationId: 'conversation-1',
        actorUserId: 'user-1',
        actorRole: 'OWNER',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ValidationErrorException when there is no active sale to void', async () => {
    conversationRepository.findById.mockResolvedValue({
      id: 'conversation-1',
      tenantId: { toString: () => 'tenant-1' },
    });
    prisma.conversationSaleEvent.findFirst.mockResolvedValue(null);

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        conversationId: 'conversation-1',
        actorUserId: 'user-1',
        actorRole: 'OWNER',
      }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('should throw ForbiddenException when a non-owner agent tries to void a sale marked by another user', async () => {
    conversationRepository.findById.mockResolvedValue({
      id: 'conversation-1',
      tenantId: { toString: () => 'tenant-1' },
    });
    prisma.conversationSaleEvent.findFirst.mockResolvedValue({
      id: 'sale-1',
      markedByUserId: 'user-other',
      lifecycleStatus: 'ACTIVE',
    });

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        conversationId: 'conversation-1',
        actorUserId: 'agent-1',
        actorRole: 'AGENT',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow an agent to void their own sale attribution', async () => {
    conversationRepository.findById.mockResolvedValue({
      id: 'conversation-1',
      tenantId: { toString: () => 'tenant-1' },
    });
    prisma.conversationSaleEvent.findFirst.mockResolvedValue({
      id: 'sale-2',
      markedByUserId: 'agent-1',
      lifecycleStatus: 'ACTIVE',
    });
    prisma.conversationSaleEvent.update.mockResolvedValue({
      id: 'sale-2',
      lifecycleStatus: 'VOIDED',
    });

    const result = await sut.execute({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      actorUserId: 'agent-1',
      actorRole: 'AGENT',
    });

    expect(result).toEqual({
      id: 'sale-2',
      lifecycleStatus: 'VOIDED',
    });
  });
});
