import { Inject, Injectable } from '@nestjs/common';
import {
  IContactRepository,
  CONTACT_REPOSITORY,
} from '../../domain/repositories/IContactRepository';
import {
  IListContactsUseCase,
  ListContactsInput,
  ListContactsOutput,
} from './interfaces/IListContactsUseCase';

@Injectable()
export class ListContactsUseCase implements IListContactsUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
  ) {}

  async execute(input: ListContactsInput): Promise<ListContactsOutput> {
    const page = input.page || 1;
    const limit = input.limit || 20;

    const { data, total } = await this.contactRepository.findAllByTenant(
      input.tenantId,
      {
        page,
        limit,
        stage: input.stage,
        tag: input.tag,
        branchId: input.branchId,
      },
    );

    return {
      data: data.map((c) => ({
        id: c.id.toString(),
        branchId: c.branchId,
        name: c.name.value,
        phone: c.phone,
        document: c.document,
        stage: c.stage.value,
        tags: c.tags,
        lastInteraction: c.lastInteraction,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
