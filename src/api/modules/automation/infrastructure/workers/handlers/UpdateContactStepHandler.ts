import { Inject, Injectable } from '@nestjs/common';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import { IStepHandler } from '../../../application/ports/IStepHandler';
import {
  StepExecutionContext,
  StepExecutionResult,
} from '../../../application/ports/IStepExecutor';
import { StepType } from '../../../domain/value-objects/StepType';

type ContactStage =
  | 'LEAD'
  | 'PROSPECT'
  | 'OPPORTUNITY'
  | 'CUSTOMER'
  | 'INACTIVE';

interface UpdatableContactFields {
  name?: string;
  document?: string;
  email?: string;
  notes?: string;
  stage?: ContactStage;
}

const VALID_STAGES: ContactStage[] = [
  'LEAD',
  'PROSPECT',
  'OPPORTUNITY',
  'CUSTOMER',
  'INACTIVE',
];

@Injectable()
export class UpdateContactStepHandler implements IStepHandler {
  readonly type = StepType.UPDATE_CONTACT;

  constructor(
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
  ) {}

  async execute(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    if (!context.contactId) {
      return { success: false, error: 'update_contact requires a contactId' };
    }

    const rawFields = (config['fields'] as Record<string, unknown>) || {};
    const fields: UpdatableContactFields = {};

    if (rawFields.name != null) fields.name = String(rawFields.name);
    if (rawFields.document != null)
      fields.document = String(rawFields.document);
    if (rawFields.email != null) fields.email = String(rawFields.email);
    if (rawFields.notes != null) fields.notes = String(rawFields.notes);
    if (rawFields.stage != null) {
      const stage = String(rawFields.stage).toUpperCase() as ContactStage;
      if (!VALID_STAGES.includes(stage)) {
        return {
          success: false,
          error: `update_contact: invalid stage "${String(rawFields.stage)}"`,
        };
      }
      fields.stage = stage;
    }

    if (Object.keys(fields).length === 0) {
      return {
        success: false,
        error: 'update_contact requires at least one known field',
      };
    }

    await this.contactFacade.updateContactFields(
      context.tenantId,
      context.contactId,
      fields,
    );

    return { success: true, output: { contactUpdated: true, fields } };
  }
}
