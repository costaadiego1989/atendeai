import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  BadRequestException,
  Post,
  Param,
} from '@nestjs/common';
import { GetWidgetPublicConfigUseCase } from '../../application/use-cases/GetWidgetPublicConfigUseCase';
import { InitWidgetSessionUseCase } from '../../application/use-cases/InitWidgetSessionUseCase';
import { CloseWidgetSessionUseCase } from '../../application/use-cases/CloseWidgetSessionUseCase';
import { GetWidgetSessionMessagesUseCase } from '../../application/use-cases/GetWidgetSessionMessagesUseCase';
import { ProcessWidgetMessageUseCase } from '../../application/use-cases/ProcessWidgetMessageUseCase';
import {
  IWidgetSessionRepository,
  WIDGET_SESSION_REPOSITORY,
} from '../../domain/repositories/IWidgetSessionRepository';

interface InitSessionDTO {
  visitorId: string;
  visitorName?: string;
  visitorPhone?: string;
  visitorEmail?: string;
  visitorCpf?: string;
  pageUrl?: string;
}

interface SendWidgetMessageDTO {
  sessionId: string;
  visitorId: string;
  text: string;
  type?: 'text' | 'image' | 'audio';
  url?: string;
}

@Controller('widget')
export class WidgetController {
  constructor(
    private readonly getPublicConfig: GetWidgetPublicConfigUseCase,
    private readonly initSession: InitWidgetSessionUseCase,
    private readonly closeSession: CloseWidgetSessionUseCase,
    private readonly getMessages: GetWidgetSessionMessagesUseCase,
    private readonly processMessage: ProcessWidgetMessageUseCase,
    @Inject(WIDGET_SESSION_REPOSITORY)
    private readonly sessionRepo: IWidgetSessionRepository,
  ) {}

  @Get(':publicToken/config')
  async getConfig(@Param('publicToken') publicToken: string) {
    return this.getPublicConfig.execute(publicToken);
  }

  @Post(':publicToken/sessions')
  async initWidgetSession(
    @Param('publicToken') publicToken: string,
    @Body() dto: InitSessionDTO,
  ) {
    return this.initSession.execute({
      publicToken,
      visitorId: dto.visitorId,
      visitorName: dto.visitorName,
      visitorPhone: dto.visitorPhone,
      visitorEmail: dto.visitorEmail,
      visitorCpf: dto.visitorCpf,
      pageUrl: dto.pageUrl,
    });
  }

  @Post(':publicToken/messages')
  async sendMessage(
    @Param('publicToken') publicToken: string,
    @Body() dto: SendWidgetMessageDTO,
  ) {
    if (!dto.sessionId || !dto.visitorId || !dto.text) {
      throw new BadRequestException('sessionId, visitorId, and text are required');
    }

    const config = await this.getPublicConfig.execute(publicToken);

    const session = await this.sessionRepo.findById(dto.sessionId, config.tenantId);
    if (!session || session.visitorId !== dto.visitorId || session.status !== 'ACTIVE') {
      throw new NotFoundException('Session not found');
    }

    const { contactId, conversationId, messageId } =
      await this.processMessage.execute({
        tenantId: session.tenantId,
        widgetSessionId: session.id,
        visitorId: session.visitorId,
        visitorName: session.visitorName,
        visitorPhone: session.visitorPhone,
        visitorEmail: session.visitorEmail,
        visitorCpf: session.visitorCpf,
        text: dto.text,
        contentType: dto.type,
        url: dto.url,
        quickReplies: config.quickReplies,
      });

    await this.sessionRepo.update(session.id, config.tenantId, {
      contactId,
      conversationId,
      lastActiveAt: new Date(),
    });

    return { messageId, conversationId, contactId };
  }

  @Delete(':publicToken/sessions/:sessionId')
  @HttpCode(200)
  async restartSession(
    @Param('publicToken') publicToken: string,
    @Param('sessionId') sessionId: string,
  ) {
    await this.closeSession.execute({ publicToken, sessionId });
    return { success: true };
  }

  @Get(':publicToken/sessions/:sessionId/messages')
  async getSessionMessages(
    @Param('publicToken') publicToken: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.getMessages.execute({ publicToken, sessionId });
  }
}
