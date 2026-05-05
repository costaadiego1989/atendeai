import { Inject, Injectable } from '@nestjs/common';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  IMessagingFacade,
  MESSAGING_FACADE,
} from '@modules/messaging/application/facades/MessagingFacade';
import { RecoveryCaseRecord } from '../../domain/ports/IRecoveryRepository';

interface QueueRecoveryCaseMessageInput {
  tenantId: string;
  recoveryCase: RecoveryCaseRecord;
  text: string;
}

@Injectable()
export class RecoveryCaseMessagingService {
  constructor(
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
  ) {}

  async queueMessage(input: QueueRecoveryCaseMessageInput) {
    const contact = await this.resolveContact(input.tenantId, input.recoveryCase);

    const queuedMessage = await this.messagingFacade.queueSystemMessage({
      tenantId: input.tenantId,
      contactId: contact.contactId,
      branchId: contact.branchId,
      channel: 'WHATSAPP',
      text: input.text,
    });

    return {
      ...contact,
      conversationId: queuedMessage.conversationId,
      messageId: queuedMessage.messageId,
    };
  }

  private async resolveContact(
    tenantId: string,
    recoveryCase: RecoveryCaseRecord,
  ): Promise<{ contactId: string; branchId: string | null; created: boolean }> {
    if (recoveryCase.contactId) {
      const contact = await this.contactFacade.getContactById(
        tenantId,
        recoveryCase.contactId,
      );

      return {
        contactId: recoveryCase.contactId,
        branchId: contact?.branchId ?? recoveryCase.branchId ?? null,
        created: false,
      };
    }

    const createdContact = await this.contactFacade.ensureContact({
      tenantId,
      branchId: recoveryCase.branchId ?? undefined,
      name: recoveryCase.debtorName,
      phone: recoveryCase.phone,
      tags: ['recovery', ...recoveryCase.assignedTags],
    });

    return {
      contactId: createdContact.contactId,
      branchId:
        (createdContact as { branchId?: string | null }).branchId ??
        recoveryCase.branchId ??
        null,
      created: createdContact.created,
    };
  }
}
