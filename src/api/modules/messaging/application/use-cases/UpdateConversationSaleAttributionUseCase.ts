import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  IUpdateConversationSaleAttributionUseCase,
  UpdateConversationSaleAttributionInput,
  UpdateConversationSaleAttributionOutput,
} from './interfaces/IUpdateConversationSaleAttributionUseCase';

@Injectable()
export class UpdateConversationSaleAttributionUseCase
  implements IUpdateConversationSaleAttributionUseCase
{
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    input: UpdateConversationSaleAttributionInput,
  ): Promise<UpdateConversationSaleAttributionOutput> {
    if (input.actorRole !== 'OWNER' && input.actorRole !== 'ADMIN') {
      throw new ForbiddenException(
        'Apenas OWNER ou ADMIN podem corrigir dados da venda.',
      );
    }

    const conversation = await this.conversationRepository.findById(
      input.conversationId,
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

    const data: Prisma.ConversationSaleEventUpdateInput = {};

    if (input.saleAmount !== undefined) {
      if (input.saleAmount === null) {
        data.saleAmount = null;
      } else {
        if (!Number.isFinite(input.saleAmount) || input.saleAmount < 0) {
          throw new ValidationErrorException(
            'Valor da venda inválido (use número ≥ 0 ou null).',
          );
        }
        data.saleAmount = new Prisma.Decimal(input.saleAmount);
      }
    }

    if (input.notes !== undefined) {
      data.notes = input.notes?.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      throw new ValidationErrorException(
        'Nada para atualizar (saleAmount ou notes).',
      );
    }

    const updated = await this.prisma.conversationSaleEvent.update({
      where: { id: sale.id },
      data,
    });

    return {
      id: updated.id,
      saleAmount:
        updated.saleAmount != null ? updated.saleAmount.toString() : null,
      notes: updated.notes,
    };
  }
}
