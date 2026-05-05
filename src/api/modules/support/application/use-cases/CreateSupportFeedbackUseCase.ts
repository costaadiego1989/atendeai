import { Inject, Injectable } from '@nestjs/common';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';
import { randomUUID } from 'crypto';
import {
  AUTH_USER_REPOSITORY,
  IAuthUserRepository,
} from '@modules/auth/domain/repositories/IAuthUserRepository';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  ISupportFeedbackRepository,
  SUPPORT_FEEDBACK_REPOSITORY,
} from '../../domain/repositories/ISupportFeedbackRepository';
import {
  SupportFeedback,
  SupportFeedbackType,
} from '../../domain/types/SupportFeedback';

export interface CreateSupportFeedbackInput {
  tenantId: string;
  branchId?: string;
  userId: string;
  type: SupportFeedbackType;
  title: string;
  description: string;
  pagePath?: string;
  appModule?: string;
}

@Injectable()
export class CreateSupportFeedbackUseCase {
  constructor(
    @Inject(SUPPORT_FEEDBACK_REPOSITORY)
    private readonly repository: ISupportFeedbackRepository,
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: IAuthUserRepository,
    private readonly structuredLog: StructuredLogEmitter,
  ) {}

  async execute(input: CreateSupportFeedbackInput): Promise<SupportFeedback> {
    const user = await this.authUserRepository.findById(input.userId);
    if (!user || user.tenantId !== input.tenantId) {
      throw new EntityNotFoundException('User', input.userId);
    }

    const now = new Date().toISOString();
    const slug = input.appModule?.trim().toLowerCase();
    const feedback: SupportFeedback = {
      id: randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      userId: input.userId,
      userName: user.name,
      userEmail: user.email.value,
      type: input.type,
      title: input.title.trim(),
      description: input.description.trim(),
      pagePath: input.pagePath?.trim() || undefined,
      appModule: slug || null,
      status: 'OPEN',
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.save(feedback);
    this.structuredLog.emit({
      level: 'info',
      event: 'support.feedback.created',
      message: 'Support feedback stored',
      tenantId: input.tenantId,
      attributes: {
        feedback_id: feedback.id,
        type: feedback.type,
        app_module: feedback.appModule ?? '',
      },
    });
    return feedback;
  }
}
