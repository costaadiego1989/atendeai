import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IRecoveryOutreachGenerator,
  RECOVERY_OUTREACH_GENERATOR,
} from '../ports/IRecoveryOutreachGenerator';
import {
  IRecoveryPlaybookRepository,
  RECOVERY_PLAYBOOK_REPOSITORY,
} from '../../domain/ports/IRecoveryPlaybookRepository';
import {
  IRecoveryRepository,
  RecoveryCaseRecord,
  RECOVERY_REPOSITORY,
} from '../../domain/ports/IRecoveryRepository';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { RecoveryCaseMessagingService } from '../services/RecoveryCaseMessagingService';
import {
  applyRecoveryPlaybookTemplate,
  daysPastDue,
} from '../services/recoveryPlaybookTemplate';

export interface TriggerRecoveryOutreachCommand {
  tenantId: string;
  caseId: string;
  messageText?: string;
  previewOnly?: boolean;
  generateWithAI?: boolean;
  /** Segue fase atual do playbook ligado ao caso (canal/conteúdo/regras da fase). */
  followPlaybook?: boolean;
}

@Injectable()
export class TriggerRecoveryOutreachUseCase {
  constructor(
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
    private readonly recoveryCaseMessagingService: RecoveryCaseMessagingService,
    @Inject(RECOVERY_OUTREACH_GENERATOR)
    private readonly recoveryOutreachGenerator: IRecoveryOutreachGenerator,
    @Inject(RECOVERY_PLAYBOOK_REPOSITORY)
    private readonly playbookRepository: IRecoveryPlaybookRepository,
  ) {}

  async execute(command: TriggerRecoveryOutreachCommand) {
    const recoveryCase = await this.recoveryRepository.findCaseById(
      command.tenantId,
      command.caseId,
    );

    if (!recoveryCase) {
      throw new EntityNotFoundException('RecoveryCase', command.caseId);
    }

    if (command.followPlaybook) {
      return this.executeFollowPlaybook(command, recoveryCase);
    }

    const messageText = command.messageText?.trim()
      ? command.messageText.trim()
      : command.generateWithAI
        ? await this.recoveryOutreachGenerator.generate({
            tenantId: command.tenantId,
            debtorName: recoveryCase.debtorName,
            debtorCompanyName: recoveryCase.debtorCompanyName,
            chargeType: recoveryCase.chargeType,
            chargeTitle: recoveryCase.chargeTitle,
            chargeDescription: recoveryCase.chargeDescription,
            referencePeriod: recoveryCase.referencePeriod,
            relatedEntityType: recoveryCase.relatedEntityType,
            relatedEntityLabel: recoveryCase.relatedEntityLabel,
            amountDue: recoveryCase.amountDue,
            dueDate: recoveryCase.dueDate,
            assignedTags: recoveryCase.assignedTags,
          })
        : null;

    if (!messageText) {
      throw new ValidationErrorException(
        'Informe messageText ou solicite generateWithAI para o outreach',
      );
    }

    if (command.previewOnly) {
      return {
        ...recoveryCase,
        outreachText: messageText,
        previewOnly: true,
      };
    }

    const queuedMessage = await this.recoveryCaseMessagingService.queueMessage({
      tenantId: command.tenantId,
      recoveryCase,
      text: messageText,
    });

    const updatedCase = await this.recoveryRepository.updateCaseStatus({
      tenantId: command.tenantId,
      caseId: command.caseId,
      status: 'CONTACTED',
      contactId: queuedMessage.contactId,
      lastContactedAt: new Date(),
    });

    return {
      ...updatedCase,
      outreachText: messageText,
      conversationId: queuedMessage.conversationId,
      messageId: queuedMessage.messageId,
    };
  }

  private async executeFollowPlaybook(
    command: TriggerRecoveryOutreachCommand,
    recoveryCase: RecoveryCaseRecord,
  ) {
    if (!recoveryCase.playbookId) {
      throw new ValidationErrorException(
        'Este caso não está ligado a um playbook; crie o caso com playbooks activos ou associe um playbook.',
      );
    }

    const playbookWithPhases = await this.playbookRepository.findPlaybookWithPhases(
      command.tenantId,
      recoveryCase.playbookId,
    );

    if (!playbookWithPhases) {
      throw new ValidationErrorException('Playbook do caso não foi encontrado');
    }

    const phases = [...playbookWithPhases.phases].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    const nextIndex = recoveryCase.playbookPhaseIndex ?? 0;

    if (nextIndex >= phases.length) {
      throw new ValidationErrorException(
        'Todas as fases deste playbook já foram executadas para este caso',
      );
    }

    const phase = phases[nextIndex];

    if (phase.channel !== 'WHATSAPP') {
      throw new ValidationErrorException(
        `Canal da fase não suportado neste fluxo: ${phase.channel}`,
      );
    }

    const overdueDays = daysPastDue(recoveryCase.dueDate ?? null, new Date());
    if (overdueDays < phase.minDaysOverdue) {
      throw new ValidationErrorException(
        `Esta fase exige pelo menos ${phase.minDaysOverdue} dia(s) em atraso (actual: ${overdueDays}).`,
      );
    }

    if (nextIndex > 0 && phase.minDelayHoursSincePrevious > 0) {
      const lastAt = recoveryCase.lastPlaybookPhaseExecutedAt;
      if (!lastAt) {
        throw new ValidationErrorException(
          'Registo de execução da fase anterior em falta; não é possível aplicar o intervalo mínimo.',
        );
      }
      const hours =
        (Date.now() - new Date(lastAt).getTime()) / 3_600_000;
      if (hours < phase.minDelayHoursSincePrevious) {
        throw new ValidationErrorException(
          `Aguarde pelo menos ${phase.minDelayHoursSincePrevious} hora(s) desde a fase anterior (decorridas ~${Math.floor(hours)}h).`,
        );
      }
    }

    const already = await this.playbookRepository.hasDispatchedPhase(
      recoveryCase.id,
      phase.id,
    );
    if (already) {
      throw new ValidationErrorException(
        'Esta fase do playbook já foi enviada para este caso',
      );
    }

    let messageText: string | null = null;
    if (phase.mode === 'TEMPLATE') {
      if (!phase.templateBody?.trim()) {
        throw new ValidationErrorException('Fase TEMPLATE sem template_body configurado');
      }
      messageText = applyRecoveryPlaybookTemplate(
        phase.templateBody,
        recoveryCase,
      ).trim();
    } else {
      messageText = await this.recoveryOutreachGenerator.generate({
        tenantId: command.tenantId,
        debtorName: recoveryCase.debtorName,
        debtorCompanyName: recoveryCase.debtorCompanyName,
        chargeType: recoveryCase.chargeType,
        chargeTitle: recoveryCase.chargeTitle,
        chargeDescription: recoveryCase.chargeDescription,
        referencePeriod: recoveryCase.referencePeriod,
        relatedEntityType: recoveryCase.relatedEntityType,
        relatedEntityLabel: recoveryCase.relatedEntityLabel,
        amountDue: recoveryCase.amountDue,
        dueDate: recoveryCase.dueDate,
        assignedTags: recoveryCase.assignedTags,
      });
    }

    if (!messageText) {
      throw new ValidationErrorException('Não foi possível gerar a mensagem desta fase');
    }

    if (command.previewOnly) {
      return {
        ...recoveryCase,
        outreachText: messageText,
        previewOnly: true,
        playbookPhaseId: phase.id,
        playbookPhaseSortOrder: phase.sortOrder,
      };
    }

    const queuedMessage = await this.recoveryCaseMessagingService.queueMessage({
      tenantId: command.tenantId,
      recoveryCase,
      text: messageText,
    });

    await this.playbookRepository.recordPhaseDispatch({
      tenantId: command.tenantId,
      caseId: command.caseId,
      phaseId: phase.id,
    });

    const now = new Date();
    await this.recoveryRepository.updateCasePlaybookProgress({
      tenantId: command.tenantId,
      caseId: command.caseId,
      playbookPhaseIndex: nextIndex + 1,
      lastPlaybookPhaseExecutedAt: now,
    });

    const updatedCase = await this.recoveryRepository.updateCaseStatus({
      tenantId: command.tenantId,
      caseId: command.caseId,
      status: 'CONTACTED',
      contactId: queuedMessage.contactId,
      lastContactedAt: now,
    });

    return {
      ...updatedCase,
      outreachText: messageText,
      conversationId: queuedMessage.conversationId,
      messageId: queuedMessage.messageId,
      playbookPhaseId: phase.id,
      playbookPhaseSortOrder: phase.sortOrder,
    };
  }
}
