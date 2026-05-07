import {
  createCommercialContext,
  getCommercialToneClassName,
} from '@/shared/commercial/commercial-context';

type SaleAttributionShape = {
  commercialKind?: string | null;
  commercialStatus?: string | null;
  evidenceSource?: string | null;
};

type SaleAttributionToastInput = SaleAttributionShape & {
  approved: boolean;
};

export function getSaleAttributionMeta(input: SaleAttributionShape) {
  const commercialKind = input.commercialKind ?? null;
  const commercialStatus = input.commercialStatus ?? null;
  const isObjectiveEvidence = input.evidenceSource === 'PAYMENT_CONFIRMED';

  if (commercialKind === 'RECOVERY') {
    const context = createCommercialContext({
      kind: 'RECOVERY',
      statusLabel:
        commercialStatus === 'RECOVERED' ? 'Pagamento recuperado' : 'Recovery',
      summary:
        'O pagamento foi confirmado em um fluxo de recovery. Isso entra como receita recuperada, nao como nova venda.',
      tone: 'warning',
      evidenceSource: input.evidenceSource,
    });

    return {
      ...context,
      accentClassName: getCommercialToneClassName(context.tone),
    };
  }

  const context = createCommercialContext({
    kind: 'NEW_SALE',
    statusLabel:
      commercialStatus === 'PAYMENT_CONFIRMED'
        ? 'Pagamento confirmado'
        : commercialStatus === 'COMPLETED'
          ? 'Venda concluida'
          : 'Venda confirmada',
    summary: isObjectiveEvidence
      ? 'Esta conversa ja tem evidencia objetiva de pagamento confirmado no sistema.'
      : 'A venda foi validada pelo contexto da conversa.',
    tone: 'success',
    evidenceSource: input.evidenceSource,
  });

  return {
    ...context,
    accentClassName: getCommercialToneClassName(context.tone),
  };
}

export function getSaleAttributionDialogCopy(input: SaleAttributionShape) {
  const meta = getSaleAttributionMeta(input);

  if (meta.isObjectiveEvidence && !meta.isRecovery) {
    return {
      title: 'Confirmar venda',
      description:
        'Esta conversa ja tem pagamento confirmado no sistema. Revise o valor e confirme a atribuicao da venda.',
      submitLabel: 'Confirmar venda',
    };
  }

  return {
    title: 'Marcar como venda',
    description:
      'A IA analisa o historico desta conversa. A venda so e gravada se houver evidencia clara de fecho comercial com o cliente.',
    submitLabel: 'Pedir validacao IA',
  };
}

export function getSaleAttributionToastCopy(input: SaleAttributionToastInput) {
  const meta = getSaleAttributionMeta(input);

  if (!input.approved && meta.isRecovery) {
    return {
      title: 'Receita recuperada',
      description:
        'Esse pagamento foi contabilizado como recovery. Ele nao entra como nova venda.',
      variant: 'default' as const,
    };
  }

  if (input.approved && meta.isObjectiveEvidence && !meta.isRecovery) {
    return {
      title: 'Venda confirmada',
      description:
        'O pagamento ja foi confirmado pelo webhook e a venda foi atribuida com evidencia objetiva.',
      variant: 'default' as const,
    };
  }

  if (input.approved) {
    return {
      title: 'Venda registrada',
      description:
        'A conversa foi validada e a venda foi atribuida com sucesso.',
      variant: 'default' as const,
    };
  }

  return {
    title: 'Venda nao confirmada',
    description:
      'Ainda nao ha evidencia suficiente para registrar esta conversa como venda.',
    variant: 'default' as const,
  };
}
