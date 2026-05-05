import { formatCurrency, formatDate } from '@/shared/lib/formatters';
export {
  PAYMENT_LINK_STATUS_OPTIONS,
  formatPaymentBillingType as formatSalesBillingType,
} from '@/shared/payment/payment-ui';

export function formatSalesCurrency(value?: number | null) {
  return formatCurrency(value) ?? 'R$ 0,00';
}

export function formatSalesDueDate(value?: string | null) {
  return formatDate(value) ?? 'Sem vencimento definido';
}

export function buildPaymentLinkStepItems(
  contactReady: boolean,
  chargeReady: boolean,
) {
  return [
    {
      step: 1 as const,
      title: 'Quem vai pagar?',
      description: 'Escolha o contato do CRM.',
      ready: contactReady,
    },
    {
      step: 2 as const,
      title: 'O que vai cobrar?',
      description: 'Defina valor, título e vencimento.',
      ready: chargeReady,
    },
    {
      step: 3 as const,
      title: 'Como enviar?',
      description: 'Revise e envie a cobrança.',
      ready: false,
    },
  ];
}

export async function copyTextWithFallback(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
