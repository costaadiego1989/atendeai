import { Inject, Injectable } from '@nestjs/common';
import {
  IAuthUserRepository,
  AUTH_USER_REPOSITORY,
} from '../../domain/repositories/IAuthUserRepository';
import {
  UnauthorizedException,
  ForbiddenException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  ILoginUseCase,
  LoginInput,
  LoginOutput,
} from './interfaces/ILoginUseCase';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '@shared/application/ports/IPasswordHasher';
import {
  ITokenService,
  TOKEN_SERVICE,
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
import { TenantModuleAccessService } from '@shared/infrastructure/billing/TenantModuleAccessService';

@Injectable()
export class LoginUseCase implements ILoginUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepo: IAuthUserRepository,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    @Inject(REFRESH_SESSION_STORE)
    private readonly refreshSessionStore: IRefreshSessionStore,
    @Inject(AUTH_AUDIT_LOG_REPOSITORY)
    private readonly authAuditLogRepository: IAuthAuditLogRepository,
    private readonly tenantModuleAccessService: TenantModuleAccessService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.authUserRepo.findByEmail(input.email);
    if (!user) {
      await this.recordAudit({
        eventType: 'LOGIN_FAILED',
        email: input.email,
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        deviceId: input.context?.deviceId,
        metadata: { reason: 'USER_NOT_FOUND' },
      });
      throw new UnauthorizedException(
        'Invalid email or password',
        'INVALID_CREDENTIALS',
      );
    }

    const isPasswordValid = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      await this.recordAudit({
        eventType: 'LOGIN_FAILED',
        userId: user.id.toString(),
        tenantId: user.tenantId,
        email: user.email.value,
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        deviceId: input.context?.deviceId,
        metadata: { reason: 'INVALID_PASSWORD' },
      });
      throw new UnauthorizedException(
        'Invalid email or password',
        'INVALID_CREDENTIALS',
      );
    }

    if (user.planStatus === 'TRIAL_EXPIRED') {
      throw new ForbiddenException(
        'Seu período de teste (7 dias) expirou. Para continuar aproveitando os recursos do AtendeAí, escolha um plano agora.',
        'TRIAL_EXPIRED',
      );
    }

    const accessPayload = {
      sub: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.value,
      role: user.role.value,
      planStatus: user.planStatus,
      type: 'access' as const,
    };

    const refreshSessionId = randomUUID();
    const refreshPayload = {
      sub: user.id.toString(),
      tenantId: user.tenantId,
      sid: refreshSessionId,
      type: 'refresh' as const,
    };

    const accessToken = await this.tokenService.signAccessToken(accessPayload);
    const refreshToken =
      await this.tokenService.signRefreshToken(refreshPayload);
    await this.refreshSessionStore.save(
      user.id.toString(),
      refreshSessionId,
      this.tokenService.getRefreshTokenTtlSeconds(),
    );
    await this.recordAudit({
      eventType: 'LOGIN_SUCCEEDED',
      userId: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.value,
      ipAddress: input.context?.ipAddress,
      userAgent: input.context?.userAgent,
      deviceId: input.context?.deviceId,
      sessionId: refreshSessionId,
      metadata: {
        mustChangePassword: user.mustChangePassword,
        role: user.role.value,
      },
    });

    const billingAccess = await this.tenantModuleAccessService.getSummary(
      user.tenantId,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id.toString(),
        tenantId: user.tenantId,
        name: user.name,
        email: user.email.value,
        accessibleBranchIds: user.tenantBranches
          .filter((branch) => branch.active)
          .map((branch) => branch.id),
        phone: user.phone,
        cpf: user.cpf,
        role: user.role.value,
        mustChangePassword: user.mustChangePassword,
      },
      tenant: {
        id: user.tenantId,
        name: user.tenantName ?? 'Empresa',
        plan: billingAccess.plan,
        cnpj: user.tenantCnpj,
        businessType: user.tenantBusinessType,
        planStatus: user.planStatus,
        billingAccess,
        branches: user.tenantBranches,
        createdAt: user.tenantCreatedAt.toISOString(),
      },
    };
  }

  private async recordAudit(
    input: Parameters<IAuthAuditLogRepository['record']>[0],
  ): Promise<void> {
    try {
      await this.authAuditLogRepository.record(input);
    } catch {
      // Auth should remain available even if audit persistence fails.
    }
  }
}
