import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  AUTH_USER_REPOSITORY,
  IAuthUserRepository,
} from '../../domain/repositories/IAuthUserRepository';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '@shared/application/ports/IPasswordHasher';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IPasswordResetTokenStore,
  PASSWORD_RESET_TOKEN_STORE,
} from '../ports/IPasswordResetTokenStore';
import {
  IRefreshSessionStore,
  REFRESH_SESSION_STORE,
} from '../ports/IRefreshSessionStore';
import {
  IResetPasswordUseCase,
  ResetPasswordInput,
  ResetPasswordOutput,
} from './interfaces/IResetPasswordUseCase';
import {
  AUTH_AUDIT_LOG_REPOSITORY,
  IAuthAuditLogRepository,
} from '../ports/IAuthAuditLogRepository';

@Injectable()
export class ResetPasswordUseCase implements IResetPasswordUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: IAuthUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    @Inject(PASSWORD_RESET_TOKEN_STORE)
    private readonly passwordResetTokenStore: IPasswordResetTokenStore,
    @Inject(REFRESH_SESSION_STORE)
    private readonly refreshSessionStore: IRefreshSessionStore,
    @Inject(AUTH_AUDIT_LOG_REPOSITORY)
    private readonly authAuditLogRepository: IAuthAuditLogRepository,
  ) {}

  async execute(input: ResetPasswordInput): Promise<ResetPasswordOutput> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const resetToken =
      await this.passwordResetTokenStore.findValidByHash(tokenHash);

    if (!resetToken) {
      await this.recordAudit({
        eventType: 'PASSWORD_RESET_COMPLETED',
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        deviceId: input.context?.deviceId,
        metadata: {
          success: false,
          reason: 'INVALID_OR_EXPIRED_TOKEN',
        },
      });
      throw new ValidationErrorException('Token de redefinição inválido');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    await this.authUserRepository.updatePassword(
      resetToken.userId,
      passwordHash,
    );
    await this.refreshSessionStore.revoke(resetToken.userId);
    await this.passwordResetTokenStore.markUsed(resetToken.id);
    await this.recordAudit({
      eventType: 'PASSWORD_RESET_COMPLETED',
      userId: resetToken.userId,
      email: resetToken.email,
      ipAddress: input.context?.ipAddress,
      userAgent: input.context?.userAgent,
      deviceId: input.context?.deviceId,
      metadata: {
        success: true,
      },
    });

    return {
      message: 'Senha redefinida com sucesso.',
    };
  }

  private async recordAudit(
    input: Parameters<IAuthAuditLogRepository['record']>[0],
  ): Promise<void> {
    try {
      await this.authAuditLogRepository.record(input);
    } catch {
      // Best effort audit only.
    }
  }
}
