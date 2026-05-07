import { Inject, Injectable } from '@nestjs/common';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../../domain/repositories/IConversationRepository';
import {
  EntityNotFoundException,
  UnauthorizedException,
} from '@shared/domain/exceptions/DomainExceptions';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  ConversationSaleAttributionDTO,
  GetConversationSaleAttributionInput,
  IGetConversationSaleAttributionUseCase,
} from './interfaces/IGetConversationSaleAttributionUseCase';

@Injectable()
export class GetConversationSaleAttributionUseCase
  implements IGetConversationSaleAttributionUseCase
{
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    input: GetConversationSaleAttributionInput,
  ): Promise<ConversationSaleAttributionDTO | null> {
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
      return null;
    }

    return {
      id: sale.id,
      conversationId: sale.conversationId,
      attributedUserId: sale.attributedUserId,
      saleAmount:
        sale.saleAmount != null ? sale.saleAmount.toString() : null,
      currency: sale.currency,
      lifecycleStatus: sale.lifecycleStatus,
      aiValidationStatus: sale.aiValidationStatus,
      markedByUserId: sale.markedByUserId,
      markedAt: sale.markedAt.toISOString(),
      aiValidatedAt: sale.aiValidatedAt
        ? sale.aiValidatedAt.toISOString()
        : null,
      notes: sale.notes,
      commercialKind:
        typeof (sale.metadata as any)?.objectiveEvidence?.commercialKind === 'string'
          ? (sale.metadata as any).objectiveEvidence.commercialKind
          : null,
      commercialStatus:
        typeof (sale.metadata as any)?.objectiveEvidence?.commercialStatus === 'string'
          ? (sale.metadata as any).objectiveEvidence.commercialStatus
          : null,
      evidenceSource:
        typeof (sale.metadata as any)?.objectiveEvidence?.source === 'string'
          ? (sale.metadata as any).objectiveEvidence.source
          : null,
    };
  }
}
