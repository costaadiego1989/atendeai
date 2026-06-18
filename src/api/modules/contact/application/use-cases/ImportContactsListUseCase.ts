import { Inject, Injectable } from '@nestjs/common';
import { TenantId } from '@shared/domain/TenantId';
import {
  CONTACT_REPOSITORY,
  IContactRepository,
} from '../../domain/repositories/IContactRepository';
import { Contact } from '../../domain/entities/Contact';
import { ContactName } from '../../domain/value-objects/ContactName';
import { ContactStageVO } from '../../domain/value-objects/ContactStage';
import { PhoneNumber } from '../../domain/value-objects/PhoneNumber';
import { ContactImportParser } from '../services/ContactImportParser';
import { ContactDomainEventPublisher } from '../services/ContactDomainEventPublisher';
import {
  IImportContactsListUseCase,
  ImportContactsListInput,
  ImportContactsListOutput,
} from './interfaces/IImportContactsListUseCase';

@Injectable()
export class ImportContactsListUseCase implements IImportContactsListUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
    private readonly contactDomainEventPublisher: ContactDomainEventPublisher,
    private readonly contactImportParser: ContactImportParser,
  ) {}

  async execute(
    input: ImportContactsListInput,
  ): Promise<ImportContactsListOutput> {
    const tenantId = TenantId.create(input.tenantId);
    const rows = this.contactImportParser.parseRows(
      input.rawText,
      input.defaultTags ?? [],
    );
    const items: ImportContactsListOutput['items'] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        // C5 fix: validate using digit-count (E.164 range 8–15) via PhoneNumber VO.
        // Also normalize the phone (strip spaces, dashes, parens, "+") before use.
        if (!PhoneNumber.isValid(row.phone)) {
          skipped += 1;
          items.push({
            lineNumber: row.lineNumber,
            status: 'SKIPPED',
            name: row.name,
            phone: row.phone,
            reason: 'Telefone ausente ou invalido.',
          });
          continue;
        }

        const normalizedPhone = PhoneNumber.normalize(row.phone);

        const existing = await this.contactRepository.findByPhone(
          tenantId.toString(),
          normalizedPhone,
        );

        if (existing) {
          existing.updateDetails({
            name: row.name ? ContactName.create(row.name) : undefined,
            document: row.document ?? existing.document,
            email: row.email ?? existing.email,
            notes: row.notes ?? existing.notes,
            tags: [...new Set([...(existing.tags ?? []), ...row.tags])],
          });

          if (input.branchId && !existing.branchId) {
            existing.assignBranch(input.branchId);
          }

          if (
            input.defaultStage &&
            existing.stage.value !== input.defaultStage
          ) {
            existing.updateStage(ContactStageVO.create(input.defaultStage));
          }

          await this.contactRepository.save(existing);
          await this.contactDomainEventPublisher.publishFromAggregate(existing);

          updated += 1;
          items.push({
            lineNumber: row.lineNumber,
            status: 'UPDATED',
            name: existing.name.value,
            phone: existing.phone,
          });
          continue;
        }

        const contact = Contact.create({
          tenantId,
          branchId: input.branchId,
          name: ContactName.create(row.name),
          phone: normalizedPhone,
          document: row.document,
          email: row.email,
          notes: row.notes,
          tags: row.tags,
          stage: input.defaultStage
            ? ContactStageVO.create(input.defaultStage)
            : undefined,
        });

        await this.contactRepository.save(contact);
        await this.contactDomainEventPublisher.publishFromAggregate(contact);

        created += 1;
        items.push({
          lineNumber: row.lineNumber,
          status: 'CREATED',
          name: contact.name.value,
          phone: contact.phone,
        });
      } catch (error) {
        failed += 1;
        items.push({
          lineNumber: row.lineNumber,
          status: 'FAILED',
          name: row.name,
          phone: row.phone,
          reason:
            error instanceof Error
              ? error.message
              : 'Falha ao importar a linha.',
        });
      }
    }

    return {
      totalRows: rows.length,
      processed: created + updated,
      created,
      updated,
      skipped,
      failed,
      items,
    };
  }
}
