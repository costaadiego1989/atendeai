import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class ProspectAlreadyContactedError extends DomainException {
  constructor(contactId: string) {
    super(
      `Contact ${contactId} was already contacted in this campaign`,
      'PROSPECT_ALREADY_CONTACTED',
    );
  }
}

export class ProspectCooldownActiveError extends DomainException {
  constructor(contactId: string, cooldownDays: number) {
    super(
      `Contact ${contactId} is within the ${cooldownDays}-day cooldown period`,
      'PROSPECT_COOLDOWN_ACTIVE',
    );
  }
}

export class ProspectOptOutError extends DomainException {
  constructor(contactId: string) {
    super(
      `Contact ${contactId} has opted out of prospecting`,
      'PROSPECT_OPT_OUT',
    );
  }
}

export class ProspectNoWhatsAppPhoneError extends DomainException {
  constructor(contactId: string) {
    super(
      `Contact ${contactId} has no WhatsApp phone number`,
      'PROSPECT_NO_WHATSAPP_PHONE',
    );
  }
}

export class ProspectTemplateUnavailableError extends DomainException {
  constructor(templateName: string) {
    super(
      `WhatsApp template "${templateName}" is unavailable or rejected by Meta`,
      'PROSPECT_TEMPLATE_UNAVAILABLE',
    );
  }
}
