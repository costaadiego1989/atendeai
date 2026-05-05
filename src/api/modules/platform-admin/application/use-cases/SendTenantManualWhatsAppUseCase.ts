import { Inject, Injectable, BadRequestException } from '@nestjs/common';
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

@Injectable()
export class SendTenantManualWhatsAppUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
    @Inject(CONTACT_FACADE)
    private readonly contacts: IContactFacade,
    @Inject(MESSAGING_FACADE)
    private readonly messaging: IMessagingFacade,
  ) {}

  async execute(input: { tenantId: string; text: string }) {
    const owner = await this.users.findOwnerPrincipalByTenantId(
      input.tenantId,
    );
    if (!owner) {
      throw new BadRequestException('Owner user not found for tenant');
    }
    const { contactId } = await this.contacts.ensureContact({
      tenantId: input.tenantId,
      name: owner.name,
      phone: owner.phone,
      stage: 'CUSTOMER',
    });
    return this.messaging.queueSystemMessage({
      tenantId: input.tenantId,
      contactId,
      channel: 'WHATSAPP',
      text: input.text,
    });
  }
}
