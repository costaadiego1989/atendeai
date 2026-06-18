import { Inject, Injectable, Logger } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { UsageType } from '@modules/billing/application/use-cases/interfaces/IRecordUsageUseCase';
import {
  AIQuotaDeniedIntegrationEvent,
  AIResponseFailedIntegrationEvent,
} from '../integration-events/publishers/AIIntegrationEvents';
import { ProcessAIResponseInput } from '../use-cases/interfaces/IProcessAIResponseUseCase';

export type QuotaGuardResult =
  | { canProceed: true }
  | { canProceed: false; error: string; message: string };

@Injectable()
export class AIQuotaGuard {
  private readonly logger = new Logger(AIQuotaGuard.name);

  constructor(
    @Inject(ICheckQuotaUseCase)
    private readonly checkQuotaUseCase: ICheckQuotaUseCase,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async check(input: ProcessAIResponseInput): Promise<QuotaGuardResult> {
    const quotaCheck = await this.checkQuotaUseCase.execute({
      tenantId: input.tenantId,
      type: UsageType.AI_TOKEN,
    });

    if (quotaCheck.canProceed) {
      return { canProceed: true };
    }

    await this.publishQuotaDenied(input, quotaCheck);

    if (quotaCheck.status === 'NO_SUBSCRIPTION') {
      await this.publishFallbackFailed(
        input,
        'Estou em configuração. Tente novamente em breve.',
      );
      return {
        canProceed: false,
        error: 'NO_SUBSCRIPTION',
        message: 'Conta em configuração. Tente novamente em instantes.',
      };
    }

    if (quotaCheck.status !== 'ACTIVE') {
      await this.publishFallbackFailed(
        input,
        'Assinatura inativa. Entre em contato com o suporte.',
      );
      return {
        canProceed: false,
        error: 'SUBSCRIPTION_INACTIVE',
        message: 'Assinatura inativa.',
      };
    }

    await this.publishFallbackFailed(
      input,
      'Limite de uso atingido. Tente novamente mais tarde.',
    );
    return {
      canProceed: false,
      error: 'QUOTA_EXCEEDED',
      message: 'Limite de uso atingido.',
    };
  }

  private async publishQuotaDenied(
    input: ProcessAIResponseInput,
    quotaCheck: { status: string; used: number; quota: number },
  ): Promise<void> {
    await this.eventBus.publish(
      new AIQuotaDeniedIntegrationEvent({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        contactId: input.contactId,
        usageType: UsageType.AI_TOKEN,
        status: quotaCheck.status,
        used: quotaCheck.used,
        quota: quotaCheck.quota,
      }),
    );
  }

  private async publishFallbackFailed(
    input: ProcessAIResponseInput,
    fallbackMessage: string,
  ): Promise<void> {
    await this.eventBus.publish(
      new AIResponseFailedIntegrationEvent({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        contactId: input.contactId,
        reason: 'QUOTA_DENIED',
        provider: 'internal',
        fallbackMessage,
      }),
    );
  }
}
