import { Inject, Injectable } from '@nestjs/common';
import {
  IConversationRepository,
  CONVERSATION_REPOSITORY,
} from '../../domain/repositories/IConversationRepository';
import {
  CONVERSATION_INTELLIGENCE_REPOSITORY,
  IConversationIntelligenceRepository,
} from '../../domain/repositories/IConversationIntelligenceRepository';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  IListConversationsUseCase,
  ListConversationsInput,
  ListConversationsOutput,
} from './interfaces/IListConversationsUseCase';

@Injectable()
export class ListConversationsUseCase implements IListConversationsUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(CONVERSATION_INTELLIGENCE_REPOSITORY)
    private readonly conversationIntelligenceRepository: IConversationIntelligenceRepository,
  ) {}

  async execute(
    input: ListConversationsInput,
  ): Promise<ListConversationsOutput> {
    const page = input.page || 1;
    const limit = input.limit || 20;
    const assignedUserId =
      input.requesterRole && input.requesterRole !== 'OWNER'
        ? input.requesterUserId
        : undefined;

    const { data, total } = await this.conversationRepository.findAllByTenant(
      input.tenantId,
      {
        branchId: input.branchId,
        page,
        limit,
        status: input.status,
        assignedUserId,
      },
    );

    const assignedUsersByConversation =
      await this.conversationRepository.findAssignedUsers(
        input.tenantId,
        data.map((conversation) => conversation.id.toString()),
      );
    const intelligenceByConversation =
      await this.conversationIntelligenceRepository.findByConversationIds(
        input.tenantId,
        data.map((conversation) => conversation.id.toString()),
      );
    const queueStateByConversation =
      await this.conversationRepository.findQueueState(
        input.tenantId,
        data.map((conversation) => conversation.id.toString()),
      );

    return {
      data: await Promise.all(
        data.map(async (c) => {
          const contact = await this.contactFacade.getContactById(
            input.tenantId,
            c.contactId.toString(),
          );

          const assignedUser =
            assignedUsersByConversation[c.id.toString()] ?? undefined;
          const queueState = queueStateByConversation[c.id.toString()];
          const intelligence =
            intelligenceByConversation[c.id.toString()] ?? undefined;

          return {
            id: c.id.toString(),
            contactId: c.contactId.toString(),
            contactName: contact?.name || 'Contato',
            contactPhone: contact?.phone || '',
            channel: c.channel,
            status: c.status,
            assignedToUserId: assignedUser?.id,
            assignedToName: assignedUser?.name,
            assignedAt: assignedUser?.assignedAt,
            unreadCount: queueState?.unreadCount ?? 0,
            createdAt: c.startedAt,
            updatedAt: c.updatedAt,
            lastInboundAt: queueState?.lastInboundAt,
            lastOutboundAt: queueState?.lastOutboundAt,
            lastMessageSequence: queueState?.lastMessageSequence,
            lastMessage: queueState?.lastMessageAt
              ? {
                  content: queueState.lastMessagePreview || '',
                  direction: queueState.lastMessageDirection || 'INBOUND',
                  timestamp: queueState.lastMessageAt,
                }
              : undefined,
            intelligence: intelligence
              ? {
                  summary: intelligence.summary,
                  sentiment: intelligence.sentiment,
                  tags: intelligence.tags,
                  interests: intelligence.interests,
                  nextStep: intelligence.nextStep,
                  lossReason: intelligence.lossReason,
                  updatedAt: intelligence.updatedAt,
                }
              : undefined,
          };
        }),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
