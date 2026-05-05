import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { Response } from 'express';
import { StartMetaInstagramConnectionUseCase } from '../../application/use-cases/StartMetaInstagramConnectionUseCase';
import { CompleteMetaInstagramConnectionUseCase } from '../../application/use-cases/CompleteMetaInstagramConnectionUseCase';

@Controller('channels/instagram/meta')
export class InstagramMetaConnectionController {
  constructor(
    private readonly startMetaInstagramConnectionUseCase: StartMetaInstagramConnectionUseCase,
    private readonly completeMetaInstagramConnectionUseCase: CompleteMetaInstagramConnectionUseCase,
  ) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async startConnection(
    @Req() req: any,
    @Body() body: { branchId?: string },
  ) {
    return this.startMetaInstagramConnectionUseCase.execute({
      tenantId: req.user.tenantId,
      branchId: body?.branchId,
    });
  }

  @Get('callback')
  async completeConnection(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Query('error_message') errorMessage: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      res
        .type('html')
        .send(this.buildPopupHtml(false, [], errorMessage || error, null));
      return;
    }

    try {
      const result = await this.completeMetaInstagramConnectionUseCase.execute({
        code,
        state,
      });
      res
        .type('html')
        .send(this.buildPopupHtml(true, result.accounts, '', result.branchId));
    } catch (callbackError: any) {
      res
        .type('html')
        .send(
          this.buildPopupHtml(
            false,
            [],
            callbackError?.message || 'Falha ao conectar Instagram com Meta',
            null,
          ),
        );
    }
  }

  private buildPopupHtml(
    success: boolean,
    accounts: Array<{
      instagramAccountId: string;
      username: string | null;
      pageId: string;
      pageName: string | null;
      profilePictureUrl: string | null;
    }>,
    message: string,
    branchId: string | null,
  ): string {
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Meta Instagram</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <script>
            (function () {
              try {
                if (window.opener) {
                  window.opener.postMessage(
                    {
                      source: 'atendeai-meta-instagram-oauth',
                      success: ${success ? 'true' : 'false'},
                      message: ${JSON.stringify(message || '')},
                      branchId: ${JSON.stringify(branchId)},
                      accounts: ${JSON.stringify(accounts)}
                    },
                    '*'
                  );
                }
              } catch (error) {}
              window.close();
            })();
          </script>
          <p>${success ? 'Instagram conectado. Volte ao AtendeAi para escolher a conta.' : message || 'Falha ao conectar Instagram com Meta.'}</p>
        </body>
      </html>
    `;
  }
}
