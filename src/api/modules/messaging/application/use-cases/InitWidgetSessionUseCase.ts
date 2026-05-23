import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  IWidgetConfigRepository,
  WIDGET_CONFIG_REPOSITORY,
} from '@modules/messaging/domain/repositories/IWidgetConfigRepository';
import {
  IWidgetSessionRepository,
  WIDGET_SESSION_REPOSITORY,
} from '@modules/messaging/domain/repositories/IWidgetSessionRepository';
import { InitiateWidgetContactUseCase } from './InitiateWidgetContactUseCase';

export interface InitWidgetSessionInput {
  publicToken: string;
  visitorId: string;
  visitorName?: string | null;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  visitorCpf?: string | null;
  pageUrl?: string | null;
}

export interface InitWidgetSessionOutput {
  sessionId: string;
  conversationId: string;
  resumed: boolean;
}

@Injectable()
export class InitWidgetSessionUseCase {
  constructor(
    @Inject(WIDGET_CONFIG_REPOSITORY)
    private readonly configRepo: IWidgetConfigRepository,
    @Inject(WIDGET_SESSION_REPOSITORY)
    private readonly sessionRepo: IWidgetSessionRepository,
    private readonly initiateContact: InitiateWidgetContactUseCase,
  ) {}

  async execute(
    input: InitWidgetSessionInput,
  ): Promise<InitWidgetSessionOutput> {
    if (!input.visitorId) {
      throw new BadRequestException('visitorId is required');
    }

    const config = await this.configRepo.findByPublicToken(input.publicToken);
    if (!config || !config.enabled) {
      throw new NotFoundException('Widget not found or disabled');
    }

    const existing = await this.sessionRepo.findActiveByVisitor(
      config.id,
      config.tenantId,
      input.visitorId,
    );

    if (existing) {
      const visitorName = input.visitorName || existing.visitorName;
      const visitorPhone = input.visitorPhone || existing.visitorPhone;
      const visitorEmail = input.visitorEmail || existing.visitorEmail;
      const visitorCpf = input.visitorCpf || existing.visitorCpf;

      const { contactId, conversationId } = await this.initiateContact.execute({
        tenantId: config.tenantId,
        visitorId: input.visitorId,
        visitorName,
        visitorPhone,
        visitorEmail,
        visitorCpf,
        quickReplies: config.quickReplies,
      });

      await this.sessionRepo.update(existing.id, config.tenantId, {
        lastActiveAt: new Date(),
        visitorName,
        visitorPhone,
        visitorEmail,
        visitorCpf,
        pageUrl: input.pageUrl || existing.pageUrl,
        contactId,
        conversationId,
      });

      return { sessionId: existing.id, conversationId, resumed: true };
    }

    const session = await this.sessionRepo.create({
      widgetConfigId: config.id,
      tenantId: config.tenantId,
      visitorId: input.visitorId,
      visitorName: input.visitorName,
      visitorPhone: input.visitorPhone,
      visitorEmail: input.visitorEmail,
      visitorCpf: input.visitorCpf,
      pageUrl: input.pageUrl,
    });

    const { contactId, conversationId } = await this.initiateContact.execute({
      tenantId: config.tenantId,
      visitorId: input.visitorId,
      visitorName: input.visitorName,
      visitorPhone: input.visitorPhone,
      visitorEmail: input.visitorEmail,
      visitorCpf: input.visitorCpf,
      quickReplies: config.quickReplies,
    });

    await this.sessionRepo.update(session.id, config.tenantId, {
      contactId,
      conversationId,
    });

    return { sessionId: session.id, conversationId, resumed: false };
  }
}
