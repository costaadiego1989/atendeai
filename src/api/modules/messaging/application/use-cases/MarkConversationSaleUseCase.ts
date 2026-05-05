import {
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
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
import { TenantManualSaleEligibilityService } from '@shared/infrastructure/billing/TenantManualSaleEligibilityService';
import { ConversationSaleAiValidationService } from '../services/ConversationSaleAiValidationService';
import {
  IMarkConversationSaleUseCase,
  MarkConversationSaleInput,
  MarkConversationSaleOutput,
} from './interfaces/IMarkConversationSaleUseCase';

const MARK_ROLES = new Set(['OWNER', 'ADMIN', 'AGENT']);

@Injectable()
export class MarkConversationSaleUseCase implements IMarkConversationSaleUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    private readonly prisma: PrismaService,
    private readonly manualSaleEligibility: TenantManualSaleEligibilityService,
    private readonly saleAiValidation: ConversationSaleAiValidationService,
  ) {}

  async execute(
    input: MarkConversationSaleInput,
  ): Promise<MarkConversationSaleOutput> {
    if (!MARK_ROLES.has(input.actorRole)) {
      throw new ForbiddenException('Sem permissão para registar vendas.');
    }

    const eligible =
      await this.manualSaleEligibility.supportsManualSaleAttribution(
        input.tenantId,
      );
    if (!eligible) {
      throw new ForbiddenException(
        'Marcação manual de venda não está disponível para este plano (checkout/commerce activo).',
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

    const attributedUserId =
      input.attributedUserId?.trim() || input.actorUserId;

    if (input.actorRole === 'AGENT' && attributedUserId !== input.actorUserId) {
      throw new ForbiddenException(
        'Agentes só podem atribuir vendas a si próprios.',
      );
    }

    const attributedUser = await this.prisma.user.findFirst({
      where: { id: attributedUserId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!attributedUser) {
      throw new ValidationErrorException(
        'Utilizador atribuído inválido ou não pertence ao tenant.',
      );
    }

    if (input.saleAmount != null) {
      if (!Number.isFinite(input.saleAmount) || input.saleAmount < 0) {
        throw new ValidationErrorException(
          'Valor da venda inválido (use número ≥ 0).',
        );
      }
    }

    const existingApproved =
      await this.prisma.conversationSaleEvent.findFirst({
        where: {
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          lifecycleStatus: 'ACTIVE',
          aiValidationStatus: 'APPROVED',
        },
      });
    if (existingApproved) {
      throw new ConflictException(
        'Já existe uma venda aprovada para esta conversa.',
      );
    }

    const ai = await this.saleAiValidation.validate({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      claimedSaleAmount: input.saleAmount ?? null,
      notes: input.notes ?? null,
    });

    if (!ai.approved) {
      throw new ValidationErrorException(
        ai.reason || 'Venda não confirmada pelo contexto da conversa.',
      );
    }

    const currency =
      input.currency?.trim() ||
      (input.saleAmount != null ? 'BRL' : null);

    const saleAmountDecimal =
      input.saleAmount != null
        ? new Prisma.Decimal(input.saleAmount)
        : null;

    const now = new Date();
    const created = await this.prisma.conversationSaleEvent.create({
      data: {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        attributedUserId,
        markedByUserId: input.actorUserId,
        saleAmount: saleAmountDecimal,
        currency,
        lifecycleStatus: 'ACTIVE',
        aiValidationStatus: 'APPROVED',
        aiValidatedAt: now,
        notes: input.notes?.trim() || null,
        metadata: {
          aiReason: ai.reason,
          aiConfidence: ai.confidence,
          aiModelExcerpt: ai.rawModelText.slice(0, 12000),
        } as Prisma.InputJsonValue,
      },
    });

    return this.map(created);
  }

  private map(row: {
    id: string;
    conversationId: string;
    attributedUserId: string;
    saleAmount: Prisma.Decimal | null;
    currency: string | null;
    lifecycleStatus: string;
    aiValidationStatus: string;
    markedByUserId: string;
    markedAt: Date;
    aiValidatedAt: Date | null;
    notes: string | null;
  }): MarkConversationSaleOutput {
    return {
      id: row.id,
      conversationId: row.conversationId,
      attributedUserId: row.attributedUserId,
      saleAmount:
        row.saleAmount != null ? row.saleAmount.toString() : null,
      currency: row.currency,
      lifecycleStatus: row.lifecycleStatus,
      aiValidationStatus: row.aiValidationStatus,
      markedByUserId: row.markedByUserId,
      markedAt: row.markedAt.toISOString(),
      aiValidatedAt: row.aiValidatedAt
        ? row.aiValidatedAt.toISOString()
        : null,
      notes: row.notes,
    };
  }
}
