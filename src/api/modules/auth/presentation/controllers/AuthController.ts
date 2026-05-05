import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ILoginUseCase } from '../../application/use-cases/interfaces/ILoginUseCase';
import { IRefreshTokenUseCase } from '../../application/use-cases/interfaces/IRefreshTokenUseCase';
import { IGetCurrentUserUseCase } from '../../application/use-cases/interfaces/IGetCurrentUserUseCase';
import { ILogoutUseCase } from '../../application/use-cases/interfaces/ILogoutUseCase';
import {
  ChangeFirstAccessPasswordDTO,
  ForgotPasswordDTO,
  LoginDTO,
  ResetPasswordDTO,
} from '../dtos/AuthDTOs';
import {
  ITokenService,
  TOKEN_SERVICE,
} from '@shared/application/ports/ITokenService';
import {
  JwtCookieGuard,
  AuthenticatedUser,
} from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { IRequestPasswordResetUseCase } from '../../application/use-cases/interfaces/IRequestPasswordResetUseCase';
import { IResetPasswordUseCase } from '../../application/use-cases/interfaces/IResetPasswordUseCase';
import { IChangeFirstAccessPasswordUseCase } from '../../application/use-cases/interfaces/IChangeFirstAccessPasswordUseCase';
import { AuthRequestContext } from '../../application/types/AuthRequestContext';
import { DeviceAwareThrottlerGuard } from '../guards/DeviceAwareThrottlerGuard';
import { DEVICE_ID_COOKIE_NAME } from '@shared/infrastructure/http/interceptors/DeviceIdInterceptor';
import { RequiresActivePlan } from '@shared/infrastructure/auth/decorators/requires-active-plan.decorator';
import { SubscriptionActiveGuard } from '@shared/infrastructure/auth/guards/SubscriptionActiveGuard';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const DEVICE_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 1000 * 60 * 60 * 24 * 365,
};

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(ILoginUseCase)
    private readonly loginUseCase: ILoginUseCase,
    @Inject(IRefreshTokenUseCase)
    private readonly refreshTokenUseCase: IRefreshTokenUseCase,
    @Inject(IGetCurrentUserUseCase)
    private readonly getCurrentUserUseCase: IGetCurrentUserUseCase,
    @Inject(ILogoutUseCase)
    private readonly logoutUseCase: ILogoutUseCase,
    @Inject(IRequestPasswordResetUseCase)
    private readonly requestPasswordResetUseCase: IRequestPasswordResetUseCase,
    @Inject(IResetPasswordUseCase)
    private readonly resetPasswordUseCase: IResetPasswordUseCase,
    @Inject(IChangeFirstAccessPasswordUseCase)
    private readonly changeFirstAccessPasswordUseCase: IChangeFirstAccessPasswordUseCase,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
  ) {}

  @Post('login')
  @RequiresActivePlan()
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceAwareThrottlerGuard, SubscriptionActiveGuard)
  async login(
    @Body() body: LoginDTO,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.ensureDeviceCookie(req, res);

    const result = await this.loginUseCase.execute({
      email: body.email,
      password: body.password,
      context: this.buildRequestContext(req),
    });

    res.cookie('atendeai_access', result.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: this.tokenService.getAccessTokenTtlSeconds() * 1000,
    });

    res.cookie('atendeai_refresh', result.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: this.tokenService.getRefreshTokenTtlSeconds() * 1000,
    });

    return {
      user: result.user,
      tenant: result.tenant,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceAwareThrottlerGuard)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.ensureDeviceCookie(req, res);

    const refreshToken = req.cookies?.['atendeai_refresh'];
    const result = await this.refreshTokenUseCase.execute({
      refreshToken,
      context: this.buildRequestContext(req),
    });

    res.cookie('atendeai_access', result.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: this.tokenService.getAccessTokenTtlSeconds() * 1000,
    });

    res.cookie('atendeai_refresh', result.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: this.tokenService.getRefreshTokenTtlSeconds() * 1000,
    });

    return { message: 'Token successfully renewed' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.ensureDeviceCookie(req, res);

    await this.logoutUseCase.execute({
      refreshToken: req.cookies?.['atendeai_refresh'],
      context: this.buildRequestContext(req),
    });
    res.clearCookie('atendeai_access', COOKIE_OPTIONS);
    res.clearCookie('atendeai_refresh', COOKIE_OPTIONS);
    return { message: 'Logout successfully completed' };
  }

  @Get('me')
  @RequiresActivePlan()
  @UseGuards(JwtCookieGuard, SubscriptionActiveGuard)
  async me(@Req() req: Request) {
    const user = (req as unknown as { user: AuthenticatedUser }).user;
    return this.getCurrentUserUseCase.execute(user.sub);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceAwareThrottlerGuard)
  async forgotPassword(
    @Body() body: ForgotPasswordDTO,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.ensureDeviceCookie(req, res);

    return this.requestPasswordResetUseCase.execute({
      email: body.email,
      context: this.buildRequestContext(req),
    });
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceAwareThrottlerGuard)
  async resetPassword(
    @Body() body: ResetPasswordDTO,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.ensureDeviceCookie(req, res);

    return this.resetPasswordUseCase.execute({
      token: body.token,
      password: body.password,
      context: this.buildRequestContext(req),
    });
  }

  @Post('first-access-password')
  @UseGuards(JwtCookieGuard)
  @HttpCode(HttpStatus.OK)
  async changeFirstAccessPassword(
    @Req() req: Request,
    @Body() body: ChangeFirstAccessPasswordDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.ensureDeviceCookie(req, res);

    const user = (req as unknown as { user: AuthenticatedUser }).user;
    return this.changeFirstAccessPasswordUseCase.execute({
      userId: user.sub,
      password: body.password,
      context: this.buildRequestContext(req),
    });
  }

  private buildRequestContext(req: Request): AuthRequestContext {
    const forwardedForHeader = req.headers['x-forwarded-for'];
    const forwardedFor = Array.isArray(forwardedForHeader)
      ? forwardedForHeader[0]
      : forwardedForHeader;

    return {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
      deviceId:
        req.cookies?.[DEVICE_ID_COOKIE_NAME] ||
        (req as Request & { deviceId?: string }).deviceId,
      forwardedFor:
        typeof forwardedFor === 'string'
          ? forwardedFor.split(',')[0]?.trim() || undefined
          : undefined,
    };
  }

  private ensureDeviceCookie(req: Request, res: Response): void {
    const rawCookieHeader = req.headers['cookie'];
    const incomingCookies = Array.isArray(rawCookieHeader)
      ? rawCookieHeader.join('; ')
      : rawCookieHeader ?? '';
    const hasIncomingDeviceCookie = incomingCookies.includes(
      `${DEVICE_ID_COOKIE_NAME}=`,
    );
    const deviceId =
      req.cookies?.[DEVICE_ID_COOKIE_NAME] ||
      (req as Request & { deviceId?: string }).deviceId;

    if (!hasIncomingDeviceCookie && deviceId) {
      res.cookie(DEVICE_ID_COOKIE_NAME, deviceId, DEVICE_COOKIE_OPTIONS);
    }
  }
}
