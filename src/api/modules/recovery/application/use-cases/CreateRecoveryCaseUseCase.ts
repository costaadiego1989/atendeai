import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  IRecoveryPlaybookRepository,
  RECOVERY_PLAYBOOK_REPOSITORY,
} from '../../domain/ports/IRecoveryPlaybookRepository';
import {
  IRecoveryRepository,
  RECOVERY_REPOSITORY,
} from '../../domain/ports/IRecoveryRepository';

export interface CreateRecoveryCaseCommand {
  tenantId: string;
  branchId?: string;
  contactId?: string;
  debtorName?: string;
  debtorCompanyName?: string;
  debtorDocument?: string;
  phone?: string;
  externalReference?: string;
  chargeType?: string;
  chargeTitle?: string;
  chargeDescription?: string;
  referencePeriod?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityLabel?: string;
  amountDue?: string;
  dueDate?: string;
  assignedTags?: string[];
}

@Injectable()
export class CreateRecoveryCaseUseCase {
  constructor(
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(RECOVERY_PLAYBOOK_REPOSITORY)
    private readonly playbookRepository: IRecoveryPlaybookRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: CreateRecoveryCaseCommand) {
    let debtorName = command.debtorName?.trim();
    let phone = command.phone?.trim();
    let branchId = command.branchId?.trim() || undefined;
    let source = 'MANUAL';

    if (command.contactId) {
      const contact = await this.contactFacade.getContactById(
        command.tenantId,
        command.contactId,
      );

      if (!contact) {
        throw new ValidationErrorException('Contato informado não foi encontrado');
      }

      debtorName = debtorName || contact.name;
      phone = phone || contact.phone;
      branchId = branchId || contact.branchId || undefined;
      source = 'CRM';
    }

    if (!debtorName || !phone) {
      throw new ValidationErrorException(
        'Informe um contato do CRM ou nome e telefone do devedor',
      );
    }

    const dueDate = command.dueDate
      ? new Date(`${command.dueDate}T00:00:00.000Z`)
      : undefined;

    let playbookId: string | null | undefined = undefined;
    const playbooksEnabled =
      this.configService.get<string>('RECOVERY_PLAYBOOKS_ENABLED') === 'true';

    if (playbooksEnabled) {
      await this.playbookRepository.ensureSystemDefaultPlaybook(command.tenantId);
      const active = await this.playbookRepository.findActivePlaybookWithPhases(
        command.tenantId,
        branchId ?? null,
      );
      playbookId = active?.playbook.id ?? null;
    }

    return this.recoveryRepository.createCase({
      tenantId: command.tenantId,
      branchId,
      contactId: command.contactId,
      debtorName,
      debtorCompanyName: command.debtorCompanyName?.trim() || undefined,
      debtorDocument: command.debtorDocument?.trim() || undefined,
      phone,
      externalReference: command.externalReference,
      source,
      chargeType: command.chargeType?.trim() || undefined,
      chargeTitle: command.chargeTitle?.trim() || undefined,
      chargeDescription: command.chargeDescription?.trim() || undefined,
      referencePeriod: command.referencePeriod?.trim() || undefined,
      relatedEntityType: command.relatedEntityType?.trim() || undefined,
      relatedEntityId: command.relatedEntityId?.trim() || undefined,
      relatedEntityLabel: command.relatedEntityLabel?.trim() || undefined,
      amountDue: command.amountDue,
      dueDate,
      assignedTags: command.assignedTags || [],
      playbookId,
    });
  }
}
