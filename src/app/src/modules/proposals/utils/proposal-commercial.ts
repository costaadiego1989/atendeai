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
        label: 'Contrato publico pronto',
        tone: 'info',
        visible: true,
      }
    : {
        title: 'Contrato',
        label: 'Contrato ainda nao gerado',
        tone: 'muted',
        visible: false,
      };

  const approval: JourneyStep =
    approvalStatus === 'ACCEPTED'
      ? {
          title: 'Aceite',
          label: 'Aceita pelo cliente',
          tone: 'success',
          visible: true,
        }
      : approvalStatus === 'REJECTED'
        ? {
            title: 'Aceite',
            label: 'Recusada pelo cliente',
            tone: 'danger',
            visible: true,
          }
        : {
            title: 'Aceite',
            label: publicLink ? 'Aguardando aceite' : 'Aceite ainda indisponivel',
            tone: publicLink ? 'warning' : 'muted',
            visible: true,
          };

  const payment: JourneyStep =
    paymentStatus === 'PAID'
      ? {
          title: 'Pagamento',
          label: 'Pagamento confirmado',
          tone: 'success',
          visible: true,
        }
      : approvalStatus === 'ACCEPTED'
        ? {
            title: 'Pagamento',
            label: 'Pagamento pendente',
            tone: 'warning',
            visible: true,
          }
        : {
            title: 'Pagamento',
            label: 'Pagamento pendente',
            tone: 'muted',
            visible: true,
          };

  const summary =
    paymentStatus === 'PAID'
      ? 'Contrato enviado, aceite confirmado e pagamento registrado.'
      : approvalStatus === 'ACCEPTED'
        ? 'Contrato aceito pelo cliente. Falta apenas a confirmacao de pagamento.'
        : publicLink
          ? 'Contrato pronto para envio e aguardando a resposta do cliente.'
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
