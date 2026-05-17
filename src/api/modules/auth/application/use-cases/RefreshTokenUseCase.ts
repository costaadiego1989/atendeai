import { Inject, Injectable } from '@nestjs/common';
import {
  IAuthUserRepository,
  AUTH_USER_REPOSITORY,
} from '../../domain/repositories/IAuthUserRepository';
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IRefreshTokenUseCase,
  RefreshTokenInput,
  RefreshTokenOutput,
} from './interfaces/IRefreshTokenUseCase';
import {
  ITokenService,
  TOKEN_SERVICE,
  TokenPayload,
} from '@shared/application/ports/ITokenService';
import {
  IRefreshSessionStore,
  REFRESH_SESSION_STORE,
} from '../ports/IRefreshSessionStore';
import { randomUUID } from 'crypto';
import {
  AUTH_AUDIT_LOG_REPOSITORY,
  IAuthAuditLogRepository,
} from '../ports/IAuthAuditLogRepository';

@Injectable()
export class RefreshTokenUseCase implements IRefreshTokenUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepo: IAuthUserRepository,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
    @Inject(REFRESH_SESSION_STORE)
    private readonly refreshSessionStore: IRefreshSessionStore,
    @Inject(AUTH_AUDIT_LOG_REPOSITORY)
    private readonly authAuditLogRepository: IAuthAuditLogRepository,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    if (!input.refreshToken) {
      await this.recordAudit({
        eventType: 'REFRESH_FAILED',
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        deviceId: input.context?.deviceId,
        metadata: { reason: 'MISSING_REFRESH_TOKEN' },
      });
      throw new UnauthorizedException(
        'Refresh token not provided',
        'MISSING_REFRESH_TOKEN',
      );
    }

    let payload: TokenPayload;
    try {
      payload = await this.tokenService.verifyRefreshToken<TokenPayload>(
        input.refreshToken,
      );
    } catch {
      await this.recordAudit({
        eventType: 'REFRESH_FAILED',
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        deviceId: input.context?.deviceId,
        metadata: { reason: 'INVALID_REFRESH_TOKEN' },
      });
      throw new UnauthorizedException(
        'Invalid or expired refresh token',
        'INVALID_TOKEN',
      );
    }

    if (payload.type !== 'refresh') {
      await this.recordAudit({
        eventType: 'REFRESH_FAILED',
        userId: payload.sub,
        tenantId: payload.tenantId,
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        deviceId: input.context?.deviceId,
        sessionId: payload.sid,
        metadata: { reason: 'WRONG_TOKEN_TYPE' },
      });
      throw new UnauthorizedException(
        'Token is not a refresh token',
        'INVALID_TOKEN',
      );
    }

    if (!payload.sid) {
      await this.recordAudit({
        eventType: 'REFRESH_FAILED',
        userId: payload.sub,
        tenantId: payload.tenantId,
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        deviceId: input.context?.deviceId,
        metadata: { reason: 'MISSING_SESSION_ID' },
      });
      throw new UnauthorizedException(
        'Refresh session is invalid',
        'INVALID_TOKEN',
      );
    }

    const isSessionValid = await this.refreshSessionStore.isValid(
      payload.sub,
      payload.sid,
    );
    if (!isSessionValid) {
      await this.recordAudit({
        eventType: 'REFRESH_FAILED',
        userId: payload.sub,
        tenantId: payload.tenantId,
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        deviceId: input.context?.deviceId,
        sessionId: payload.sid,
        metadata: { reason: 'SESSION_REVOKED' },
      });
      throw new UnauthorizedException(
        'Refresh session has been revoked',
        'INVALID_TOKEN',
      );
    }

    const user = await this.authUserRepo.findById(payload.sub);
    if (!user) {
      await this.recordAudit({
        eventType: 'REFRESH_FAILED',
        userId: payload.sub,
        tenantId: payload.tenantId,
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        deviceId: input.context?.deviceId,
        sessionId: payload.sid,
        metadata: { reason: 'USER_NOT_FOUND' },
      });
      throw new UnauthorizedException('User not found', 'USER_NOT_FOUND');
    }

    const nextSessionId = randomUUID();

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.value,
      role: user.role.value,
      type: 'access' as const,
    });

    const refreshToken = await this.tokenService.signRefreshToken({
      sub: user.id.toString(),
      tenantId: user.tenantId,
      sid: nextSessionId,
      type: 'refresh' as const,
    });

    await this.refreshSessionStore.save(
      user.id.toString(),
      nextSessionId,
      this.tokenService.getRefreshTokenTtlSeconds(),
    );
    await this.recordAudit({
      eventType: 'REFRESH_SUCCEEDED',
      userId: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.value,
      ipAddress: input.context?.ipAddress,
      userAgent: input.context?.userAgent,
      deviceId: input.context?.deviceId,
      sessionId: nextSessionId,
      metadata: { previousSessionId: payload.sid },
    });

    return { accessToken, refreshToken };
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
