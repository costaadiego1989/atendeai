import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { SkipSuccessEnvelope } from '@shared/infrastructure/http/decorators/skip-success-envelope.decorator';
import { SocialOAuthService } from '../../infrastructure/services/SocialOAuthService';

@Controller()
export class SocialOAuthController {
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
    if (error) {
      return res.redirect(
        `${this.oAuthService.successUrl}?instagram_error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${this.oAuthService.successUrl}?instagram_error=missing_params`,
      );
    }

    try {
      const redirectUrl = await this.oAuthService.handleCallback(code, state);
      return res.redirect(redirectUrl);
    } catch {
      return res.redirect(
        `${this.oAuthService.successUrl}?instagram_error=callback_failed`,
      );
    }
  }
}
