import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import {
  AUTH_USER_REPOSITORY,
  IAuthUserRepository,
} from '../../domain/repositories/IAuthUserRepository';
import {
  IRequestPasswordResetUseCase,
  RequestPasswordResetInput,
  RequestPasswordResetOutput,
} from './interfaces/IRequestPasswordResetUseCase';
import {
  IPasswordResetTokenStore,
  PASSWORD_RESET_TOKEN_STORE,
} from '../ports/IPasswordResetTokenStore';
import {
  IPasswordResetEmailSender,
  PASSWORD_RESET_EMAIL_SENDER,
} from '../ports/IPasswordResetEmailSender';
import {
  AUTH_AUDIT_LOG_REPOSITORY,
  IAuthAuditLogRepository,
} from '../ports/IAuthAuditLogRepository';

@Injectable()
export class RequestPasswordResetUseCase implements IRequestPasswordResetUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: IAuthUserRepository,
    @Inject(PASSWORD_RESET_TOKEN_STORE)
    private readonly passwordResetTokenStore: IPasswordResetTokenStore,
    @Inject(PASSWORD_RESET_EMAIL_SENDER)
    private readonly passwordResetEmailSender: IPasswordResetEmailSender,
    @Inject(AUTH_AUDIT_LOG_REPOSITORY)
    private readonly authAuditLogRepository: IAuthAuditLogRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    input: RequestPasswordResetInput,
  ): Promise<RequestPasswordResetOutput> {
    const user = await this.authUserRepository.findByEmail(input.email);

    if (!user) {
      await this.recordAudit({
        eventType: 'PASSWORD_RESET_REQUESTED',
        email: input.email,
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        deviceId: input.context?.deviceId,
        metadata: { resolvedUser: false },
      });
      return {
        message:
          'Se o e-mail existir, enviaremos um link para redefinição de senha.',
      };
    }

    await this.passwordResetTokenStore.invalidateForUser(user.id.toString());

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.passwordResetTokenStore.create({
      userId: user.id.toString(),
      email: user.email.value,
      tokenHash,
      expiresAt,
    });

    const resetPasswordUrlBase =
      this.configService.get<string>('AUTH_RESET_PASSWORD_URL_BASE') ??
      'http://localhost:8080/reset-password';
    const resetUrl = `${resetPasswordUrlBase}?token=${rawToken}`;

    await this.passwordResetEmailSender.send({
      email: user.email.value,
      name: user.name,
      resetUrl,
      expiresAt,
    });
    await this.recordAudit({
      eventType: 'PASSWORD_RESET_REQUESTED',
      userId: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.value,
      ipAddress: input.context?.ipAddress,
      userAgent: input.context?.userAgent,
      deviceId: input.context?.deviceId,
      metadata: {
        resolvedUser: true,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      message:
        'Se o e-mail existir, enviaremos um link para redefinição de senha.',
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
