import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  CreateRecoveryCaseInput,
  IRecoveryRepository,
  ListRecoveryCasesFilters,
  RecoveryCaseRecord,
} from '../../../domain/ports/IRecoveryRepository';

@Injectable()
export class PrismaRecoveryRepository implements IRecoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createCase(
    input: CreateRecoveryCaseInput,
  ): Promise<RecoveryCaseRecord> {
    const [recoveryCase] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        INSERT INTO recovery_schema.recovery_cases (
          tenant_id,
          branch_id,
          contact_id,
          debtor_name,
          debtor_company_name,
          debtor_document,
          phone,
          external_reference,
          payment_reference,
          source,
          charge_type,
          charge_title,
          charge_description,
          reference_period,
          related_entity_type,
          related_entity_id,
          related_entity_label,
          amount_due,
          due_date,
          assigned_tags,
          playbook_id
        )
        VALUES (
          ${input.tenantId}::uuid,
          ${input.branchId ?? null}::uuid,
          ${input.contactId ?? null}::uuid,
          ${input.debtorName},
          ${input.debtorCompanyName ?? null},
          ${input.debtorDocument ?? null},
          ${input.phone},
          ${input.externalReference ?? null},
          ${input.paymentReference ?? null},
          ${input.source},
          ${input.chargeType ?? null},
          ${input.chargeTitle ?? null},
          ${input.chargeDescription ?? null},
          ${input.referencePeriod ?? null},
          ${input.relatedEntityType ?? null},
          ${input.relatedEntityId ?? null},
          ${input.relatedEntityLabel ?? null},
          ${input.amountDue ?? null}::numeric,
          ${input.dueDate ?? null}::date,
          CAST(${JSON.stringify(input.assignedTags || [])} AS jsonb),
          ${input.playbookId ?? null}::uuid
        )
        RETURNING *
    `);

    return this.mapCase(recoveryCase);
  }

  async listCases(
    filters: ListRecoveryCasesFilters,
  ): Promise<RecoveryCaseRecord[]> {
    const whereClauses: Prisma.Sql[] = [
      Prisma.sql`tenant_id = ${filters.tenantId}::uuid`,
    ];

    if (filters.branchId) {
      whereClauses.push(Prisma.sql`branch_id = ${filters.branchId}::uuid`);
    }

    if (filters.status) {
      whereClauses.push(Prisma.sql`status = ${filters.status}`);
    }

    if (filters.source) {
      whereClauses.push(Prisma.sql`source = ${filters.source}`);
    }

    if (filters.dateFrom) {
      whereClauses.push(Prisma.sql`updated_at >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      whereClauses.push(Prisma.sql`updated_at <= ${filters.dateTo}`);
    }

    const recoveryCases = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM recovery_schema.recovery_cases
        WHERE ${Prisma.join(whereClauses, ' AND ')}
        ORDER BY created_at ASC
    `);

    return recoveryCases.map((recoveryCase) => this.mapCase(recoveryCase));
  }

  async findCaseById(
    tenantId: string,
    caseId: string,
  ): Promise<RecoveryCaseRecord | null> {
    const [recoveryCase] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM recovery_schema.recovery_cases
        WHERE tenant_id = ${tenantId}::uuid
          AND id = ${caseId}::uuid
        LIMIT 1
    `);

    return recoveryCase ? this.mapCase(recoveryCase) : null;
  }

  async findLatestActiveCaseByContact(
    tenantId: string,
    contactId: string,
  ): Promise<RecoveryCaseRecord | null> {
    const [recoveryCase] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM recovery_schema.recovery_cases
        WHERE tenant_id = ${tenantId}::uuid
          AND contact_id = ${contactId}::uuid
          AND status IN (
            'READY_TO_CONTACT',
            'CONTACTED',
            'NEGOTIATING',
            'PROMISE_TO_PAY',
            'NO_RESPONSE'
        )
        ORDER BY updated_at DESC
        LIMIT 1
    `);

    return recoveryCase ? this.mapCase(recoveryCase) : null;
  }

  async findCaseByPaymentReference(
    tenantId: string,
    paymentReference: string,
  ): Promise<RecoveryCaseRecord | null> {
    const [recoveryCase] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM recovery_schema.recovery_cases
        WHERE tenant_id = ${tenantId}::uuid
          AND payment_reference = ${paymentReference}
        LIMIT 1
    `);

    return recoveryCase ? this.mapCase(recoveryCase) : null;
  }

  async updateCaseStatus(input: {
    tenantId: string;
    caseId: string;
    status: string;
    contactId?: string;
    assignedTags?: string[];
    lastContactedAt?: Date | null;
    nextActionAt?: Date | null;
    paidAt?: Date | null;
  }): Promise<RecoveryCaseRecord> {
    const [recoveryCase] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      UPDATE recovery_schema.recovery_cases
      SET
        status = ${input.status},
        contact_id = CASE
          WHEN ${input.contactId === undefined} THEN contact_id
          ELSE ${input.contactId ?? null}::uuid
        END,
        assigned_tags = COALESCE(CAST(${input.assignedTags ? JSON.stringify(input.assignedTags) : null} AS jsonb), assigned_tags),
        last_contacted_at = CASE
          WHEN ${input.lastContactedAt === undefined} THEN last_contacted_at
          ELSE ${input.lastContactedAt ?? null}
        END,
        next_action_at = CASE
          WHEN ${input.nextActionAt === undefined} THEN next_action_at
          ELSE ${input.nextActionAt ?? null}
        END,
        paid_at = CASE
          WHEN ${input.paidAt === undefined} THEN paid_at
          ELSE ${input.paidAt ?? null}
        END,
        updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.caseId}::uuid
      RETURNING *
    `);

    if (!recoveryCase) {
      throw new Error('Recovery case tenant mismatch');
    }

    return this.mapCase(recoveryCase);
  }

  async updateCaseGuidance(input: {
    tenantId: string;
    caseId: string;
    suggestedReply?: string | null;
    suggestedNextAction?: string | null;
    guidanceGeneratedAt?: Date | null;
    assignedTags?: string[];
  }): Promise<RecoveryCaseRecord> {
    const [recoveryCase] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      UPDATE recovery_schema.recovery_cases
      SET
        suggested_reply = CASE
          WHEN ${input.suggestedReply === undefined} THEN suggested_reply
          ELSE ${input.suggestedReply ?? null}
        END,
        suggested_next_action = CASE
          WHEN ${input.suggestedNextAction === undefined} THEN suggested_next_action
          ELSE ${input.suggestedNextAction ?? null}
        END,
        guidance_generated_at = CASE
          WHEN ${input.guidanceGeneratedAt === undefined} THEN guidance_generated_at
          ELSE ${input.guidanceGeneratedAt ?? null}
        END,
        assigned_tags = COALESCE(CAST(${input.assignedTags ? JSON.stringify(input.assignedTags) : null} AS jsonb), assigned_tags),
        updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.caseId}::uuid
      RETURNING *
    `);

    if (!recoveryCase) {
      throw new Error('Recovery case tenant mismatch');
    }

    return this.mapCase(recoveryCase);
  }

  async updateCasePlaybookProgress(input: {
    tenantId: string;
    caseId: string;
    playbookPhaseIndex: number;
    lastPlaybookPhaseExecutedAt: Date;
  }): Promise<RecoveryCaseRecord> {
    const [recoveryCase] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      UPDATE recovery_schema.recovery_cases
      SET
        playbook_phase_index = ${input.playbookPhaseIndex},
        last_playbook_phase_executed_at = ${input.lastPlaybookPhaseExecutedAt},
        updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.caseId}::uuid
      RETURNING *
    `);

    if (!recoveryCase) {
      throw new Error('Recovery case tenant mismatch');
    }

    return this.mapCase(recoveryCase);
  }

  async setPaymentReference(input: {
    tenantId: string;
    caseId: string;
    paymentReference: string;
  }): Promise<RecoveryCaseRecord> {
    const [recoveryCase] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      UPDATE recovery_schema.recovery_cases
      SET
        payment_reference = ${input.paymentReference},
        updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.caseId}::uuid
      RETURNING *
    `);

    if (!recoveryCase) {
      throw new Error('Recovery case tenant mismatch');
    }

    return this.mapCase(recoveryCase);
  }

  private mapCase(recoveryCase: any): RecoveryCaseRecord {
    return {
      id: recoveryCase.id,
      tenantId: recoveryCase.tenantId ?? recoveryCase.tenant_id,
      branchId: recoveryCase.branchId ?? recoveryCase.branch_id ?? null,
      contactId: recoveryCase.contactId ?? recoveryCase.contact_id ?? null,
      debtorName: recoveryCase.debtorName ?? recoveryCase.debtor_name,
      debtorCompanyName:
        recoveryCase.debtorCompanyName ??
        recoveryCase.debtor_company_name ??
        null,
      debtorDocument:
        recoveryCase.debtorDocument ?? recoveryCase.debtor_document ?? null,
      phone: recoveryCase.phone,
      externalReference:
        recoveryCase.externalReference ??
        recoveryCase.external_reference ??
        null,
      paymentReference:
        recoveryCase.paymentReference ?? recoveryCase.payment_reference ?? null,
      source: recoveryCase.source,
      chargeType: recoveryCase.chargeType ?? recoveryCase.charge_type ?? null,
      chargeTitle:
        recoveryCase.chargeTitle ?? recoveryCase.charge_title ?? null,
      chargeDescription:
        recoveryCase.chargeDescription ??
        recoveryCase.charge_description ??
        null,
      referencePeriod:
        recoveryCase.referencePeriod ?? recoveryCase.reference_period ?? null,
      relatedEntityType:
        recoveryCase.relatedEntityType ??
        recoveryCase.related_entity_type ??
        null,
      relatedEntityId:
        recoveryCase.relatedEntityId ?? recoveryCase.related_entity_id ?? null,
      relatedEntityLabel:
        recoveryCase.relatedEntityLabel ??
        recoveryCase.related_entity_label ??
        null,
      amountDue:
        recoveryCase.amountDue == null
          ? recoveryCase.amount_due == null
            ? null
            : Number(recoveryCase.amount_due.toString()).toFixed(2)
          : Number(recoveryCase.amountDue.toString()).toFixed(2),
      dueDate: recoveryCase.dueDate ?? recoveryCase.due_date ?? null,
      status: recoveryCase.status,
      assignedTags: Array.isArray(recoveryCase.assignedTags)
        ? (recoveryCase.assignedTags as string[])
        : Array.isArray(recoveryCase.assigned_tags)
          ? (recoveryCase.assigned_tags as string[])
          : [],
      lastContactedAt:
        recoveryCase.lastContactedAt ?? recoveryCase.last_contacted_at ?? null,
      nextActionAt:
        recoveryCase.nextActionAt ?? recoveryCase.next_action_at ?? null,
      paidAt: recoveryCase.paidAt ?? recoveryCase.paid_at ?? null,
      suggestedReply:
        recoveryCase.suggestedReply ?? recoveryCase.suggested_reply ?? null,
      suggestedNextAction:
        recoveryCase.suggestedNextAction ??
        recoveryCase.suggested_next_action ??
        null,
      guidanceGeneratedAt:
        recoveryCase.guidanceGeneratedAt ??
        recoveryCase.guidance_generated_at ??
        null,
      playbookId: recoveryCase.playbookId ?? recoveryCase.playbook_id ?? null,
      playbookPhaseIndex:
        recoveryCase.playbookPhaseIndex ??
        recoveryCase.playbook_phase_index ??
        0,
      lastPlaybookPhaseExecutedAt:
        recoveryCase.lastPlaybookPhaseExecutedAt ??
        recoveryCase.last_playbook_phase_executed_at ??
        null,
      createdAt: recoveryCase.createdAt ?? recoveryCase.created_at,
      updatedAt: recoveryCase.updatedAt ?? recoveryCase.updated_at,
    };
  }

  private async requireCaseById(
    tenantId: string,
    caseId: string,
  ): Promise<RecoveryCaseRecord> {
    const recoveryCase = await this.findCaseById(tenantId, caseId);

    if (!recoveryCase) {
      throw new Error('Recovery case tenant mismatch');
    }

    return recoveryCase;
  }
}
