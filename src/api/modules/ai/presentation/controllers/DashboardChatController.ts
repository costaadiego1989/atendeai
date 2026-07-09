import {
  Controller,
  Get,
  Query,
  Param,
  Sse,
  UseGuards,
  Req,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { TenantParam } from '@shared/infrastructure/auth/decorators/tenant-param.decorator';
import { StreamDashboardChatUseCase } from '../../application/use-cases/StreamDashboardChatUseCase';

@Controller('ai/dashboard')
@TenantParam('tenantId')
export class DashboardChatController {
  private readonly logger = new Logger(DashboardChatController.name);

  constructor(
    private readonly streamChatUseCase: StreamDashboardChatUseCase,
  ) {}

  @Sse(':tenantId/chat/stream')
  @UseGuards(JwtCookieGuard, TenantGuard)
  streamChat(
    @Param('tenantId') tenantId: string,
    @Query('message') message: string,
    @Query('threadId') threadId: string,
    @Req() req: Request,
  ): Observable<MessageEvent> {
    if (!message || !message.trim()) {
      throw new BadRequestException('O parâmetro "message" é obrigatório.');
    }

    const user = (req as any).user;
    const userId = user?.sub || 'anonymous';

    this.logger.log(
      `Dashboard chat stream: tenant=${tenantId} user=${userId} message="${message.slice(0, 50)}"`,
    );

    return this.streamChatUseCase.execute({
      tenantId,
      userId,
      message: message.trim(),
      threadId: threadId || undefined,
    });
  }
}
