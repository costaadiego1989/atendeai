import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ProcessWidgetMessageUseCase } from '../../application/use-cases/ProcessWidgetMessageUseCase';
import { InitiateWidgetContactUseCase } from '../../application/use-cases/InitiateWidgetContactUseCase';

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

/**
 * Public controller for the Chat Embed Widget.
 * No auth guard — uses publicToken to identify the tenant/widget config.
 */
@Controller('widget')
export class WidgetController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly processWidgetMessage: ProcessWidgetMessageUseCase,
    private readonly initiateWidgetContact: InitiateWidgetContactUseCase,
  ) {}

  /**
   * GET /api/v1/widget/:publicToken/config
   * Returns widget configuration for the embed SDK to render.
   */
  @Get(':publicToken/config')
  async getConfig(@Param('publicToken') publicToken: string) {
    const config = await this.prisma.widgetConfig.findUnique({
      where: { publicToken },
    });

    if (!config || !config.enabled) {
      throw new NotFoundException('Widget not found or disabled');
    }

    return {
      id: config.id,
      name: config.name,
      greeting: config.greeting,
      color: config.color,
      position: config.position,
      avatarUrl: config.avatarUrl,
      collectName: config.collectName,
      collectPhone: config.collectPhone,
      collectEmail: config.collectEmail,
      collectCpf: config.collectCpf,
      proactiveDelay: config.proactiveDelay,
      proactiveMsg: config.proactiveMsg,
      quickReplies: (config.quickReplies as string[]) ?? [],
    };
  }

  /**
   * POST /api/v1/widget/:publicToken/sessions
   * Creates or resumes a widget chat session.
   */
  @Post(':publicToken/sessions')
  async initSession(
    @Param('publicToken') publicToken: string,
    @Body() dto: InitSessionDTO,
  ) {
    if (!dto.visitorId) {
      throw new BadRequestException('visitorId is required');
    }

    const config = await this.prisma.widgetConfig.findUnique({
      where: { publicToken },
    });

    if (!config || !config.enabled) {
      throw new NotFoundException('Widget not found or disabled');
    }

    // Try to resume existing session
    const existing = await this.prisma.widgetSession.findFirst({
      where: {
        widgetConfigId: config.id,
        tenantId: config.tenantId,
        visitorId: dto.visitorId,
        status: 'ACTIVE',
      },
    });

    if (existing) {
      const visitorName = dto.visitorName || existing.visitorName;
      const visitorPhone = dto.visitorPhone || existing.visitorPhone;

      const { contactId, conversationId } =
        await this.initiateWidgetContact.execute({
          tenantId: config.tenantId,
          visitorId: dto.visitorId,
          visitorName,
          visitorPhone,
          visitorEmail: dto.visitorEmail || existing.visitorEmail,
          visitorCpf: dto.visitorCpf || existing.visitorCpf,
        });

      await this.prisma.widgetSession.update({
        where: { id: existing.id },
        data: {
          lastActiveAt: new Date(),
          visitorName,
          visitorPhone,
          visitorEmail: dto.visitorEmail || existing.visitorEmail,
          visitorCpf: dto.visitorCpf || existing.visitorCpf,
          pageUrl: dto.pageUrl || existing.pageUrl,
          contactId,
          conversationId,
        },
      });

      return { sessionId: existing.id, conversationId, resumed: true };
    }

    // Create new session then immediately register contact + start conversation
    const session = await this.prisma.widgetSession.create({
      data: {
        widgetConfigId: config.id,
        tenantId: config.tenantId,
        visitorId: dto.visitorId,
        visitorName: dto.visitorName,
        visitorPhone: dto.visitorPhone,
        visitorEmail: dto.visitorEmail,
        visitorCpf: dto.visitorCpf,
        pageUrl: dto.pageUrl,
      },
    });

    const { contactId, conversationId } =
      await this.initiateWidgetContact.execute({
        tenantId: config.tenantId,
        visitorId: dto.visitorId,
        visitorName: dto.visitorName,
        visitorPhone: dto.visitorPhone,
        visitorEmail: dto.visitorEmail,
        visitorCpf: dto.visitorCpf,
      });

    await this.prisma.widgetSession.update({
      where: { id: session.id },
      data: { contactId, conversationId },
    });

    return { sessionId: session.id, conversationId, resumed: false };
  }

  /**
   * POST /api/v1/widget/:publicToken/messages
   * Receives a message from the widget visitor.
   */
  @Post(':publicToken/messages')
  async sendMessage(
    @Param('publicToken') publicToken: string,
    @Body() dto: SendWidgetMessageDTO,
  ) {
    if (!dto.sessionId || !dto.visitorId || !dto.text) {
      throw new BadRequestException(
        'sessionId, visitorId, and text are required',
      );
    }

    const config = await this.prisma.widgetConfig.findUnique({
      where: { publicToken },
    });

    if (!config || !config.enabled) {
      throw new NotFoundException('Widget not found or disabled');
    }

    const session = await this.prisma.widgetSession.findFirst({
      where: {
        id: dto.sessionId,
        tenantId: config.tenantId,
        visitorId: dto.visitorId,
        status: 'ACTIVE',
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const { contactId, conversationId, messageId } =
      await this.processWidgetMessage.execute({
        tenantId: config.tenantId,
        widgetSessionId: session.id,
        visitorId: session.visitorId,
        visitorName: session.visitorName,
        visitorPhone: session.visitorPhone,
        visitorEmail: session.visitorEmail,
        visitorCpf: session.visitorCpf,
        text: dto.text,
        contentType: dto.type,
        url: dto.url,
        quickReplies: (config.quickReplies as string[]) ?? [],
      });

    await this.prisma.widgetSession.update({
      where: { id: session.id },
      data: { contactId, conversationId, lastActiveAt: new Date() },
    });

    return { messageId, conversationId, contactId };
  }

  /**
   * GET /api/v1/widget/:publicToken/sessions/:sessionId/messages
   * Returns message history for a widget session.
   */
  @Get(':publicToken/sessions/:sessionId/messages')
  async getMessages(
    @Param('publicToken') publicToken: string,
    @Param('sessionId') sessionId: string,
  ) {
    const config = await this.prisma.widgetConfig.findUnique({
      where: { publicToken },
    });

    if (!config || !config.enabled) {
      throw new NotFoundException('Widget not found or disabled');
    }

    const session = await this.prisma.widgetSession.findFirst({
      where: {
        id: sessionId,
        tenantId: config.tenantId,
      },
    });

    if (!session || !session.conversationId) {
      return { messages: [] };
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId: session.conversationId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return {
      messages: messages.map((m: any) => ({
        id: m.id,
        direction: m.direction,
        contentType: m.contentType,
        content: m.content,
        sentBy: m.sentBy,
        createdAt: m.createdAt,
      })),
    };
  }
}
