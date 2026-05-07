import type { ProposalRecord } from '../types';
import {
  type CommercialTone,
  getCommercialToneClassName,
} from '@/shared/commercial/commercial-context';
import {
  getProposalApprovalStatus,
  getProposalPaymentStatus,
  getProposalPublicLink,
} from './proposal-finance';

type JourneyStep = {
  title: string;
  label: string;
  tone: CommercialTone;
  visible: boolean;
};

export type ProposalCommercialJourney = {
  contract: JourneyStep;
  approval: JourneyStep;
  payment: JourneyStep;
  summary: string;
};

export function getProposalCommercialJourney(
  proposal: Pick<ProposalRecord, 'metadata'>,
): ProposalCommercialJourney {
  const publicLink = getProposalPublicLink(proposal);
  const approvalStatus = getProposalApprovalStatus(proposal);
  const paymentStatus = getProposalPaymentStatus(proposal);

  const contract: JourneyStep = publicLink
    ? {
        title: 'Contrato',
        label: 'Pronto',
        tone: 'info',
        visible: true,
      }
    : {
        title: 'Contrato',
        label: 'Pendente',
        tone: 'muted',
        visible: false,
      };

  const approval: JourneyStep =
    approvalStatus === 'ACCEPTED'
      ? {
          title: 'Aceite',
          label: 'Aceito',
          tone: 'success',
          visible: true,
        }
      : approvalStatus === 'REJECTED'
        ? {
            title: 'Aceite',
            label: 'Recusado',
            tone: 'danger',
            visible: true,
        }
      : {
          title: 'Aceite',
          label: publicLink ? 'Aguardando' : 'Indisponivel',
          tone: publicLink ? 'warning' : 'muted',
          visible: true,
        };

  const payment: JourneyStep =
    paymentStatus === 'PAID'
      ? {
          title: 'Pagamento',
          label: 'Confirmado',
          tone: 'success',
          visible: true,
        }
      : approvalStatus === 'ACCEPTED'
        ? {
            title: 'Pagamento',
            label: 'Pendente',
            tone: 'warning',
            visible: true,
        }
      : {
          title: 'Pagamento',
          label: 'Aguardando',
          tone: 'muted',
          visible: true,
        };

  const summary =
    paymentStatus === 'PAID'
      ? 'Contrato enviado, aceite confirmado e pagamento registrado.'
      : approvalStatus === 'ACCEPTED'
        ? 'Contrato aceito pelo cliente. Falta apenas a confirmacao de pagamento.'
        : publicLink
          ? 'Contrato publicado e aguardando a resposta do cliente.'
          : 'Finalize a proposta e gere o contrato publico para iniciar o fluxo comercial.';

  return {
    contract,
    approval,
    payment,
    summary,
  };
}

export function getProposalJourneyToneClassName(tone: CommercialTone) {
  return getCommercialToneClassName(tone);
}
