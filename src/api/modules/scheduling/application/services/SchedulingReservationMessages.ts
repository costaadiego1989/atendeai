function getFirstName(name?: string) {
  return name?.trim().split(/\s+/)[0] ?? 'cliente';
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR');
}

function formatExpiry(expiresAt: string) {
  return new Date(expiresAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildSchedulingConfirmationMessage(input: {
  contactName?: string;
  professionalName?: string;
  categoryName?: string;
  date: string;
  startsAt?: string;
  endsAt?: string;
}) {
  const firstName = getFirstName(input.contactName);
  const formattedDate = formatDate(input.date);
  const professionalLine = input.professionalName
    ? ` com ${input.professionalName}`
    : '';
  const categoryLine = input.categoryName ? ` para ${input.categoryName}` : '';
  const timeLine =
    input.startsAt && input.endsAt
      ? `${input.startsAt} as ${input.endsAt}`
      : input.startsAt ?? 'horário combinado';

  return `Ola, ${firstName}! Seu agendamento foi confirmado${categoryLine}${professionalLine} para ${formattedDate}, as ${timeLine}. Se precisar ajustar o horário, e so responder por aqui.`;
}

export function buildSchedulingPaymentPendingMessage(input: {
  contactName?: string;
  professionalName?: string;
  categoryName?: string;
  date: string;
  startsAt?: string;
  endsAt?: string;
  paymentUrl: string;
  expiresAt: string;
}) {
  const firstName = getFirstName(input.contactName);
  const formattedDate = formatDate(input.date);
  const formattedExpiry = formatExpiry(input.expiresAt);
  const professionalLine = input.professionalName
    ? ` com ${input.professionalName}`
    : '';
  const categoryLine = input.categoryName ? ` para ${input.categoryName}` : '';
  const timeLine =
    input.startsAt && input.endsAt
      ? `${input.startsAt} as ${input.endsAt}`
      : input.startsAt ?? 'horário combinado';

  return `Ola, ${firstName}! Seu horário${categoryLine}${professionalLine} ficou pre-agendado para ${formattedDate}, as ${timeLine}. Para confirmar, conclua o pagamento por aqui: ${input.paymentUrl}. Esse pré-agendamento fica reservado ate ${formattedExpiry}.`;
}

export function buildSchedulingRescheduledMessage(input: {
  contactName?: string;
  professionalName?: string;
  categoryName?: string;
  date: string;
  startsAt?: string;
  endsAt?: string;
  paymentUrl?: string;
  paymentExpiresAt?: string;
  pendingPayment?: boolean;
}) {
  const firstName = getFirstName(input.contactName);
  const formattedDate = formatDate(input.date);
  const professionalLine = input.professionalName
    ? ` com ${input.professionalName}`
    : '';
  const categoryLine = input.categoryName ? ` para ${input.categoryName}` : '';
  const timeLine =
    input.startsAt && input.endsAt
      ? `${input.startsAt} as ${input.endsAt}`
      : input.startsAt ?? 'horário combinado';

  if (input.pendingPayment && input.paymentUrl) {
    const expiryLine = input.paymentExpiresAt
      ? ` Ele segue reservado ate ${formatExpiry(input.paymentExpiresAt)}.`
      : '';

    return `Ola, ${firstName}! Seu pré-agendamento${categoryLine}${professionalLine} foi remarcado para ${formattedDate}, as ${timeLine}. O mesmo link de pagamento continua valido: ${input.paymentUrl}.${expiryLine}`;
  }

  return `Ola, ${firstName}! Seu agendamento${categoryLine}${professionalLine} foi remarcado para ${formattedDate}, as ${timeLine}. Se precisar ajustar novamente, e so responder por aqui.`;
}
