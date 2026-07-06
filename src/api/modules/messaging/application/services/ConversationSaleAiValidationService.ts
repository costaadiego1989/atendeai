import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AI_ENGINE, IAIEngine } from '@modules/ai/application/ports/IAIEngine';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { SaleValidationSchema } from '../../domain/schemas/SaleValidationSchema';

export interface ConversationSaleAiValidationInput {
  tenantId: string;
  conversationId: string;
  claimedSaleAmount?: number | null;
  notes?: string | null;
}

export interface ConversationSaleAiValidationResult {
  approved: boolean;
  reason: string;
  confidence: number;
  rawModelText: string;
}

@Injectable()
export class ConversationSaleAiValidationService {
  private static readonly MESSAGE_LIMIT = 55;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_ENGINE)
    private readonly aiEngine: IAIEngine,
  ) {}

  async validate(
    input: ConversationSaleAiValidationInput,
  ): Promise<ConversationSaleAiValidationResult> {
    const transcript = await this.buildTranscript(
      input.tenantId,
      input.conversationId,
    );
    const amountLine =
      input.claimedSaleAmount != null &&
      Number.isFinite(input.claimedSaleAmount)
        ? `Valor declarado pelo atendente: ${input.claimedSaleAmount}`
        : 'Valor declarado: não informado.';
    const notesLine = input.notes?.trim()
      ? `Notas do atendente: ${input.notes.trim()}`
      : '';

    const userMessage = [
      'Decida se há evidência suficiente na conversa de que uma venda ou fecho comercial foi concretizado com o cliente (ex.: confirmação de pagamento, pedido fechado, aceitação explícita de proposta).',
      amountLine,
      notesLine,
      '',
      'Transcrição recente da conversa:',
      transcript || '(sem mensagens de texto utilizáveis)',
    ].join('\n');

    const systemPrompt = [
      'És um auditor de vendas. Responde apenas com um único objeto JSON válido (sem markdown), formato:',
      '{"approved":boolean,"reason":"texto curto em português","confidence":number}',
      'confidence entre 0 e 1.',
      'approved=true apenas se a conversa indicar claramente concretização de venda ou compromisso firme equivalente.',
      'approved=false se for ambíguo, só intenção futura, ou sem evidência.',
    ].join(' ');

    try {
      const parsed = await this.aiEngine.generateStructuredResponse({
        schema: SaleValidationSchema,
        systemPrompt,
        userMessage,
        maxTokens: 320,
        temperature: 0.15,
      });

      return {
        approved: parsed.approved,
        reason: parsed.reason,
        confidence: parsed.confidence,
        rawModelText: JSON.stringify(parsed),
      };
    } catch {
      throw new ValidationErrorException(
        'Validação por IA indisponível. Tenta novamente dentro de instantes.',
      );
    }
  }

  private async buildTranscript(
    _tenantId: string,
    conversationId: string,
  ): Promise<string> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: ConversationSaleAiValidationService.MESSAGE_LIMIT,
      select: {
        direction: true,
        sentBy: true,
        contentType: true,
        content: true,
        createdAt: true,
      },
    });

    rows.reverse();
    const lines: string[] = [];
    for (const row of rows) {
      const preview = this.contentPreview(row.content);
      if (!preview) {
        continue;
      }
      const who =
        row.direction === 'INBOUND' ? 'Cliente' : `Atendimento (${row.sentBy})`;
      lines.push(`[${row.createdAt.toISOString()}] ${who}: ${preview}`);
    }
    return lines.join('\n');
  }

  private contentPreview(content: Prisma.JsonValue): string {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      return '';
    }
    const c = content as Record<string, unknown>;
    const text = typeof c.text === 'string' ? c.text.trim() : '';
    if (text.length > 0) {
      return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
    }
    const type = typeof c.type === 'string' ? c.type : '';
    if (type && type !== 'TEXT') {
      return `[${type}]`;
    }
    return '';
  }
}
