import {
  Body,
  Controller,
  Delete,
  Get,
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
import { StartGoogleCalendarConnectionUseCase } from '../../application/use-cases/StartGoogleCalendarConnectionUseCase';
import { CompleteGoogleCalendarConnectionUseCase } from '../../application/use-cases/CompleteGoogleCalendarConnectionUseCase';
import { GetGoogleCalendarConnectionStatusUseCase } from '../../application/use-cases/GetGoogleCalendarConnectionStatusUseCase';
import { DisconnectGoogleCalendarConnectionUseCase } from '../../application/use-cases/DisconnectGoogleCalendarConnectionUseCase';
import { ListGoogleCalendarCalendarsUseCase } from '../../application/use-cases/ListGoogleCalendarCalendarsUseCase';
import { SelectGoogleCalendarUseCase } from '../../application/use-cases/SelectGoogleCalendarUseCase';

@Controller('scheduling/google-calendar')
export class SchedulingGoogleCalendarController {
  constructor(
    private readonly startGoogleCalendarConnectionUseCase: StartGoogleCalendarConnectionUseCase,
    private readonly completeGoogleCalendarConnectionUseCase: CompleteGoogleCalendarConnectionUseCase,
    private readonly getGoogleCalendarConnectionStatusUseCase: GetGoogleCalendarConnectionStatusUseCase,
    private readonly disconnectGoogleCalendarConnectionUseCase: DisconnectGoogleCalendarConnectionUseCase,
    private readonly listGoogleCalendarCalendarsUseCase: ListGoogleCalendarCalendarsUseCase,
    private readonly selectGoogleCalendarUseCase: SelectGoogleCalendarUseCase,
  ) {}

  @Get('connection/status')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async getConnectionStatus(@Req() req: any) {
    return this.getGoogleCalendarConnectionStatusUseCase.execute({
      tenantId: req.user.tenantId,
      branchId: req.query.branchId,
    });
  }

  @Post('connection/start')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async startConnection(@Req() req: any) {
    return this.startGoogleCalendarConnectionUseCase.execute({
      tenantId: req.user.tenantId,
      branchId: req.query.branchId,
    });
  }

  @Get('connection/callback')
  async completeConnection(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      res.type('html').send(this.buildPopupHtml(false, error));
      return;
    }

    try {
      await this.completeGoogleCalendarConnectionUseCase.execute({ code, state });
      res.type('html').send(this.buildPopupHtml(true));
    } catch (callbackError: any) {
      res
        .type('html')
        .send(
          this.buildPopupHtml(
            false,
            callbackError?.message || 'Falha ao conectar Google Calendar',
          ),
        );
    }
  }

  @Delete('connection')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async disconnect(@Req() req: any) {
    return this.disconnectGoogleCalendarConnectionUseCase.execute({
      tenantId: req.user.tenantId,
      branchId: req.query.branchId,
    });
  }

  @Get('connection/calendars')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async listCalendars(@Req() req: any) {
    return this.listGoogleCalendarCalendarsUseCase.execute({
      tenantId: req.user.tenantId,
      branchId: req.query.branchId,
    });
  }

  @Post('connection/select-calendar')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async selectCalendar(
    @Req() req: any,
    @Body() body: { calendarId: string },
  ) {
    return this.selectGoogleCalendarUseCase.execute({
      tenantId: req.user.tenantId,
      branchId: req.query.branchId,
      calendarId: body.calendarId,
    });
  }

  private buildPopupHtml(success: boolean, message?: string): string {
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Google Calendar</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <script>
            (function () {
              try {
                if (window.opener) {
                  window.opener.postMessage(
                    {
                      source: 'atendeai-google-calendar-oauth',
                      success: ${success ? 'true' : 'false'},
                      message: ${JSON.stringify(message || '')}
                    },
                    '*'
                  );
                }
              } catch (error) {}
              window.close();
            })();
          </script>
          <p>${success ? 'Google Calendar conectado. Pode voltar ao AtendeAi.' : message || 'Falha ao conectar Google Calendar.'}</p>
        </body>
      </html>
    `;
  }
}
