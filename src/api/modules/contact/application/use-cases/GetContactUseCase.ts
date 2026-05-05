import { Inject, Injectable } from '@nestjs/common';
import {
  IContactRepository,
  CONTACT_REPOSITORY,
} from '../../domain/repositories/IContactRepository';
import {
  GetContactInput,
  GetContactOutput,
  IGetContactUseCase,
} from './interfaces/IGetContactUseCase';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/DomainExceptions';

@Injectable()
export class GetContactUseCase implements IGetContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
  ) {}

  async execute(input: GetContactInput): Promise<GetContactOutput> {
    const contact = await this.contactRepository.findById(
      input.tenantId,
      input.contactId,
    );

    if (!contact) {
      throw new EntityNotFoundException('Contact', input.contactId);
    }

    return {
      id: contact.id.toString(),
      name: contact.name.value,
      phone: contact.phone,
      document: contact.document,
      email: contact.email,
      stage: contact.stage.value,
      tags: contact.tags,
      notes: contact.notes,
      lastInteraction: contact.lastInteraction ?? contact.createdAt,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }
}
