import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { LoginUseCase } from './application/use-cases/LoginUseCase';
import { RefreshTokenUseCase } from './application/use-cases/RefreshTokenUseCase';
import { GetCurrentUserUseCase } from './application/use-cases/GetCurrentUserUseCase';
import { AUTH_USER_REPOSITORY } from './domain/repositories/IAuthUserRepository';
import { PrismaAuthUserRepository } from './infrastructure/persistence/repositories/PrismaAuthUserRepository';
import { AuthController } from './presentation/controllers/AuthController';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { SubscriptionActiveGuard } from '@shared/infrastructure/auth/guards/SubscriptionActiveGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { ILoginUseCase } from './application/use-cases/interfaces/ILoginUseCase';
import { IRefreshTokenUseCase } from './application/use-cases/interfaces/IRefreshTokenUseCase';
import { IGetCurrentUserUseCase } from './application/use-cases/interfaces/IGetCurrentUserUseCase';
import { ILogoutUseCase } from './application/use-cases/interfaces/ILogoutUseCase';
import { IRequestPasswordResetUseCase } from './application/use-cases/interfaces/IRequestPasswordResetUseCase';
import { IResetPasswordUseCase } from './application/use-cases/interfaces/IResetPasswordUseCase';
import { IChangeFirstAccessPasswordUseCase } from './application/use-cases/interfaces/IChangeFirstAccessPasswordUseCase';
import { TOKEN_SERVICE } from '@shared/application/ports/ITokenService';
import { JwtTokenService } from '@shared/infrastructure/services/JwtTokenService';
import { PASSWORD_HASHER } from '@shared/application/ports/IPasswordHasher';
import { BcryptPasswordHasher } from '@shared/infrastructure/services/BcryptPasswordHasher';
import { REFRESH_SESSION_STORE } from './application/ports/IRefreshSessionStore';
import { RedisRefreshSessionStore } from './infrastructure/services/RedisRefreshSessionStore';
import { LogoutUseCase } from './application/use-cases/LogoutUseCase';
import { RequestPasswordResetUseCase } from './application/use-cases/RequestPasswordResetUseCase';
import { ResetPasswordUseCase } from './application/use-cases/ResetPasswordUseCase';
import { ChangeFirstAccessPasswordUseCase } from './application/use-cases/ChangeFirstAccessPasswordUseCase';
import { PASSWORD_RESET_TOKEN_STORE } from './application/ports/IPasswordResetTokenStore';
import { PrismaPasswordResetTokenStore } from './infrastructure/persistence/repositories/PrismaPasswordResetTokenStore';
import { PASSWORD_RESET_EMAIL_SENDER } from './application/ports/IPasswordResetEmailSender';
import { ConsolePasswordResetEmailSender } from './infrastructure/services/ConsolePasswordResetEmailSender';
import { BrevoPasswordResetEmailSender } from './infrastructure/services/BrevoPasswordResetEmailSender';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { AUTH_AUDIT_LOG_REPOSITORY } from './application/ports/IAuthAuditLogRepository';
import { PrismaAuthAuditLogRepository } from './infrastructure/persistence/repositories/PrismaAuthAuditLogRepository';
import { DeviceAwareThrottlerGuard } from './presentation/guards/DeviceAwareThrottlerGuard';
import { TenantModuleAccessService } from '@shared/infrastructure/billing/TenantModuleAccessService';

@Module({
  imports: [ConfigModule, DatabaseModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    {
      provide: ILoginUseCase,
      useClass: LoginUseCase,
    },
    {
      provide: IRefreshTokenUseCase,
      useClass: RefreshTokenUseCase,
    },
    {
      provide: IGetCurrentUserUseCase,
      useClass: GetCurrentUserUseCase,
    },
    {
      provide: ILogoutUseCase,
      useClass: LogoutUseCase,
    },
    {
      provide: IRequestPasswordResetUseCase,
      useClass: RequestPasswordResetUseCase,
    },
    {
      provide: IResetPasswordUseCase,
      useClass: ResetPasswordUseCase,
    },
    {
      provide: IChangeFirstAccessPasswordUseCase,
      useClass: ChangeFirstAccessPasswordUseCase,
    },
    {
      provide: AUTH_USER_REPOSITORY,
      useClass: PrismaAuthUserRepository,
    },
    {
      provide: TOKEN_SERVICE,
      useClass: JwtTokenService,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
    {
      provide: REFRESH_SESSION_STORE,
      useClass: RedisRefreshSessionStore,
    },
    {
      provide: PASSWORD_RESET_TOKEN_STORE,
      useClass: PrismaPasswordResetTokenStore,
    },
    {
      provide: AUTH_AUDIT_LOG_REPOSITORY,
      useClass: PrismaAuthAuditLogRepository,
    },
    {
      provide: PASSWORD_RESET_EMAIL_SENDER,
      inject: [ConfigService, ConsolePasswordResetEmailSender],
      useFactory: (
        configService: ConfigService,
        consolePasswordResetEmailSender: ConsolePasswordResetEmailSender,
      ) => {
        const hasBrevoCredentials =
          !!configService.get<string>('BREVO_SMTP_LOGIN') &&
          !!configService.get<string>('BREVO_SMTP_KEY');

        return hasBrevoCredentials
          ? new BrevoPasswordResetEmailSender(configService)
          : consolePasswordResetEmailSender;
      },
    },
    ConsolePasswordResetEmailSender,
    TenantModuleAccessService,
    DeviceAwareThrottlerGuard,
    JwtCookieGuard,
    SubscriptionActiveGuard,
    TenantGuard,
  ],
  exports: [
    AUTH_USER_REPOSITORY,
    TOKEN_SERVICE,
    PASSWORD_HASHER,
    JwtModule,
    JwtCookieGuard,
    SubscriptionActiveGuard,
    TenantGuard,
    ILoginUseCase,
    IRefreshTokenUseCase,
    IGetCurrentUserUseCase,
    ILogoutUseCase,
    IRequestPasswordResetUseCase,
    IResetPasswordUseCase,
    IChangeFirstAccessPasswordUseCase,
  ],
})
export class AuthModule {}
