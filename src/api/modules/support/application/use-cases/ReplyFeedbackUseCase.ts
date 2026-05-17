import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ISupportFeedbackRepository,
  SUPPORT_FEEDBACK_REPOSITORY,
  SupportFeedbackReply,
} from '../../domain/repositories/ISupportFeedbackRepository';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@modules/tenant/domain/repositories/IUserRepository';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  MESSAGING_FACADE,
  IMessagingFacade,
} from '@modules/messaging/application/facades/MessagingFacade';

export interface ReplyFeedbackInput {
  feedbackId: string;
  message: string;
  authorName: string;
}

export interface ReplyFeedbackOutput {
  reply: SupportFeedbackReply;
  messageSent: boolean;
}

@Injectable()
export class ReplyFeedbackUseCase {
  constructor(
    @Inject(SUPPORT_FEEDBACK_REPOSITORY)
    private readonly repository: ISupportFeedbackRepository,
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
    @Inject(CONTACT_FACADE)
    private readonly contacts: IContactFacade,
    @Inject(MESSAGING_FACADE)
    private readonly messaging: IMessagingFacade,
  ) {}

  async execute(input: ReplyFeedbackInput): Promise<ReplyFeedbackOutput> {
    const feedback = await this.repository.findById(input.feedbackId);
    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    // Update status to REVIEWED if currently OPEN
    if (feedback.status === 'OPEN') {
      await this.repository.updateStatus(input.feedbackId, 'REVIEWED');
    }

    // Try to send WhatsApp message to the feedback author
    let messageSent = false;
    let messageId: string | undefined;

    try {
      const user = await this.users.findById(feedback.userId);
      if (user?.phone) {
        const { contactId } = await this.contacts.ensureContact({
          tenantId: feedback.tenantId,
          name: user.name,
          phone: user.phone.value,
          stage: 'CUSTOMER',
        });

        const whatsappText = this.buildReplyMessage(
          input.message,
          feedback.title,
        );

        const result = await this.messaging.queueSystemMessage({
          tenantId: feedback.tenantId,
          contactId,
          channel: 'WHATSAPP',
          text: whatsappText,
        });

        messageId = result.messageId;
        messageSent = true;
      }
    } catch {
      // Message delivery is best-effort; reply is still saved
      messageSent = false;
    }

    // Save the reply
    const reply = await this.repository.createReply({
      feedbackId: input.feedbackId,
      authorName: input.authorName,
      message: input.message,
      sentVia: messageSent ? 'WHATSAPP' : undefined,
      messageId,
    });

    return { reply, messageSent };
  }

  private buildReplyMessage(message: string, feedbackTitle: string): string {
    return `[Suporte AtendeAi]\n\n${message}\n\n---\nEm resposta ao seu feedback: "${feedbackTitle}"`;
  }
}
