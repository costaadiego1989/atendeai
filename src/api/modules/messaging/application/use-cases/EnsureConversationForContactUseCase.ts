import { Inject, Injectable } from '@nestjs/common';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../../domain/repositories/IConversationRepository';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  EnsureConversationForContactInput,
  EnsureConversationForContactOutput,
  IEnsureConversationForContactUseCase,
} from './interfaces/IEnsureConversationForContactUseCase';
import { Conversation } from '../../domain/entities/Conversation';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';

@Injectable()
export class EnsureConversationForContactUseCase
  implements IEnsureConversationForContactUseCase
{
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
  ) {}

  async execute(
    input: EnsureConversationForContactInput,
  ): Promise<EnsureConversationForContactOutput> {
    const contact = await this.contactFacade.getContactById(
      input.tenantId,
      input.contactId,
    );

    if (!contact) {
      throw new EntityNotFoundException('Contact', input.contactId);
    }

    const existingConversation =
      await this.conversationRepository.findLatestByContact(
        input.tenantId,
        input.contactId,
      );

    if (existingConversation) {
      if (existingConversation.status === 'ARCHIVED') {
        existingConversation.activate();
        await this.conversationRepository.save(existingConversation);
        await this.conversationRepository.setAssignedUser(
          input.tenantId,
          existingConversation.id.toString(),
          null,
        );
      }

      return {
        conversationId: existingConversation.id.toString(),
        contactId: input.contactId,
        channel: existingConversation.channel as 'WHATSAPP' | 'INSTAGRAM',
        status: existingConversation.status,
        created: false,
      };
    }

    const conversation = Conversation.create({
      tenantId: TenantId.create(input.tenantId),
      contactId: new UniqueEntityID(input.contactId),
      branchId: contact.branchId ?? null,
      channel: input.channel || 'WHATSAPP',
    });

    await this.conversationRepository.save(conversation);

    return {
      conversationId: conversation.id.toString(),
      contactId: input.contactId,
      channel: conversation.channel as 'WHATSAPP' | 'INSTAGRAM',
      status: conversation.status,
      created: true,
    };
  }
}
