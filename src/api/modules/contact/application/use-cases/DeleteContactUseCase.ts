import { Inject, Injectable } from '@nestjs/common';
import {
  IContactRepository,
  CONTACT_REPOSITORY,
} from '../../domain/repositories/IContactRepository';
import {
  DeleteContactInput,
  IDeleteContactUseCase,
} from './interfaces/IDeleteContactUseCase';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/DomainExceptions';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { ContactDeletedIntegrationEvent } from '../integration-events/ContactIntegrationEvents';

@Injectable()
export class DeleteContactUseCase implements IDeleteContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(input: DeleteContactInput): Promise<void> {
    const contact = await this.contactRepository.findById(
      input.tenantId,
      input.contactId,
    );

    if (!contact) {
      throw new EntityNotFoundException('Contact', input.contactId);
    }

    await this.contactRepository.delete(input.tenantId, input.contactId);
    await this.eventBus.publish(
      new ContactDeletedIntegrationEvent({
        contactId: contact.id.toString(),
        tenantId: contact.tenantId.toString(),
        phone: contact.phone,
        stage: contact.stage.value,
      }),
    );
  }
}
