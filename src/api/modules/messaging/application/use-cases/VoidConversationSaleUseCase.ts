import { Inject, Injectable } from '@nestjs/common';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../../domain/repositories/IConversationRepository';
import {
  EntityNotFoundException,
  ForbiddenException,
  UnauthorizedException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  IVoidConversationSaleUseCase,
  VoidConversationSaleInput,
  VoidConversationSaleOutput,
} from './interfaces/IVoidConversationSaleUseCase';

function canVoidSale(
  actorRole: string,
  actorUserId: string,
  markedByUserId: string,
): boolean {
  if (actorRole === 'OWNER' || actorRole === 'ADMIN') {
    return true;
  }
  return actorUserId === markedByUserId;
}

@Injectable()
export class VoidConversationSaleUseCase implements IVoidConversationSaleUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    input: VoidConversationSaleInput,
  ): Promise<VoidConversationSaleOutput> {
    const conversation = await this.conversationRepository.findById(
      input.conversationId,
      input.tenantId,
    );
    if (!conversation) {
      throw new EntityNotFoundException('Conversation', input.conversationId);
    }
    if (conversation.tenantId.toString() !== input.tenantId) {
      throw new UnauthorizedException(
        'Conversation does not belong to this tenant',
      );
    }

    const sale = await this.prisma.conversationSaleEvent.findFirst({
      where: {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        lifecycleStatus: 'ACTIVE',
      },
      orderBy: { markedAt: 'desc' },
    });

    if (!sale) {
      throw new ValidationErrorException(
        'Não há marcação de venda activa nesta conversa.',
      );
    }

    if (!canVoidSale(input.actorRole, input.actorUserId, sale.markedByUserId)) {
      throw new ForbiddenException(
        'Sem permissão para anular esta marcação de venda.',
      );
    }

    const updated = await this.prisma.conversationSaleEvent.update({
      where: { id: sale.id },
      data: { lifecycleStatus: 'VOIDED' },
    });

    return {
      id: updated.id,
      lifecycleStatus: updated.lifecycleStatus,
    };
  }
}
