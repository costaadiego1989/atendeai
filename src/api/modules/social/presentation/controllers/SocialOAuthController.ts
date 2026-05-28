import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { SkipSuccessEnvelope } from '@shared/infrastructure/http/decorators/skip-success-envelope.decorator';
import { SocialOAuthService } from '../../infrastructure/services/SocialOAuthService';

const FALLBACK_SUCCESS_URL = '/app/social';

@Controller()
export class SocialOAuthController {
  private readonly logger = new Logger(SocialOAuthController.name);

  constructor(private readonly oAuthService: SocialOAuthService) {}

  @Get('tenants/:tenantId/social/oauth/instagram/initiate')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  initiateOAuth(@Param('tenantId') tenantId: string) {
    return { authUrl: this.oAuthService.buildOAuthUrl(tenantId) };
  }

  @Get('social/oauth/instagram/callback')
  @SkipSuccessEnvelope()
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    // Resolve successUrl once — if env var missing, use fallback so catch never throws
    let successUrl: string;
    try {
      successUrl = this.oAuthService.successUrl;
    } catch {
      successUrl = FALLBACK_SUCCESS_URL;
    }

    if (error) {
      return res.redirect(
        `${successUrl}?instagram_error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return res.redirect(`${successUrl}?instagram_error=missing_params`);
    }

    try {
      const redirectUrl = await this.oAuthService.handleCallback(code, state);
      return res.redirect(redirectUrl);
    } catch (err) {
      this.logger.error(
        `OAuth callback failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return res.redirect(`${successUrl}?instagram_error=callback_failed`);
    }
  }
}
