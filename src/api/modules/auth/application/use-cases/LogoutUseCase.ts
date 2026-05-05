import { Inject, Injectable } from '@nestjs/common';
import {
  IRefreshSessionStore,
  REFRESH_SESSION_STORE,
} from '../ports/IRefreshSessionStore';
import {
  ITokenService,
  TOKEN_SERVICE,
  TokenPayload,
} from '@shared/application/ports/ITokenService';
import { ILogoutUseCase, LogoutInput } from './interfaces/ILogoutUseCase';
import {
  AUTH_AUDIT_LOG_REPOSITORY,
  IAuthAuditLogRepository,
} from '../ports/IAuthAuditLogRepository';

@Injectable()
export class LogoutUseCase implements ILogoutUseCase {
  constructor(
    @Inject(REFRESH_SESSION_STORE)
    private readonly refreshSessionStore: IRefreshSessionStore,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
    @Inject(AUTH_AUDIT_LOG_REPOSITORY)
    private readonly authAuditLogRepository: IAuthAuditLogRepository,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    if (!input.refreshToken) {
      return;
    }

    try {
      const payload = await this.tokenService.verifyRefreshToken<TokenPayload>(
        input.refreshToken,
      );

      if (payload.type === 'refresh') {
        await this.refreshSessionStore.revoke(payload.sub);
        await this.recordAudit({
          eventType: 'LOGOUT_SUCCEEDED',
          userId: payload.sub,
          tenantId: payload.tenantId,
          ipAddress: input.context?.ipAddress,
          userAgent: input.context?.userAgent,
          deviceId: input.context?.deviceId,
          sessionId: payload.sid,
        });
      }
    } catch {
      // Ignore
    }
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
