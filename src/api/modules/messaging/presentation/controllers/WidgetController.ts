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

interface InitSessionDTO {
  visitorId: string;
  visitorName?: string;
  visitorPhone?: string;
  visitorEmail?: string;
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
  constructor(private readonly prisma: PrismaService) {}

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
      proactiveDelay: config.proactiveDelay,
      proactiveMsg: config.proactiveMsg,
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
      // Update last active
      await this.prisma.widgetSession.update({
        where: { id: existing.id },
        data: {
          lastActiveAt: new Date(),
          visitorName: dto.visitorName || existing.visitorName,
          visitorPhone: dto.visitorPhone || existing.visitorPhone,
          visitorEmail: dto.visitorEmail || existing.visitorEmail,
          pageUrl: dto.pageUrl || existing.pageUrl,
        },
      });

      return {
        sessionId: existing.id,
        conversationId: existing.conversationId,
        resumed: true,
      };
    }

    // Create new session
    const session = await this.prisma.widgetSession.create({
      data: {
        widgetConfigId: config.id,
        tenantId: config.tenantId,
        visitorId: dto.visitorId,
        visitorName: dto.visitorName,
        visitorPhone: dto.visitorPhone,
        visitorEmail: dto.visitorEmail,
        pageUrl: dto.pageUrl,
      },
    });

    return {
      sessionId: session.id,
      conversationId: null,
      resumed: false,
    };
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

    // Ensure we have a contact and conversation for this visitor
    let contactId = session.contactId;
    let conversationId = session.conversationId;

    if (!contactId) {
      // Create or find contact
      const phone = session.visitorPhone || `widget_${session.visitorId}`;
      const existingContact = await this.prisma.contact.findFirst({
        where: { tenantId: config.tenantId, phone },
      });

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const contact = await this.prisma.contact.create({
          data: {
            tenantId: config.tenantId,
            name: session.visitorName || 'Visitante Web',
            phone,
            email: session.visitorEmail,
            stage: 'LEAD',
          },
        });
        contactId = contact.id;
      }
    }

    if (!conversationId) {
      // Create conversation for this widget session
      const conversation = await this.prisma.conversation.create({
        data: {
          tenantId: config.tenantId,
          contactId,
          channel: 'WEB_CHAT',
          status: 'ACTIVE',
          lastMessageAt: new Date(),
          lastMessageDirection: 'INBOUND',
          lastMessagePreview: dto.text.substring(0, 100),
          lastInboundAt: new Date(),
        },
      });
      conversationId = conversation.id;
    }

    // Update session with contact and conversation
    await this.prisma.widgetSession.update({
      where: { id: session.id },
      data: {
        contactId,
        conversationId,
        lastActiveAt: new Date(),
      },
    });

    // Create the message
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'INBOUND',
        contentType: (dto.type || 'text').toUpperCase(),
        content: { text: dto.text, url: dto.url },
        sentBy: 'CONTACT',
        deliveryStatus: 'DELIVERED',
      },
    });

    // Update conversation
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessageDirection: 'INBOUND',
        lastMessagePreview: dto.text.substring(0, 100),
        lastInboundAt: new Date(),
        unreadCount: { increment: 1 },
      },
    });

    return {
      messageId: message.id,
      conversationId,
      contactId,
    };
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
