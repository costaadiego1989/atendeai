import { HttpError } from '@/shared/api/client';

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase();
}

function mapPrismaLikeMessage(rawMessage: string): string | null {
  const normalized = normalizeMessage(rawMessage);

  if (
    normalized.includes('unique constraint failed') ||
    normalized.includes('already registered') ||
    normalized.includes('already exists')
  ) {
    if (normalized.includes('email')) {
      return 'Este email ja esta em uso.';
    }

    if (normalized.includes('cnpj')) {
      return 'Este CNPJ ja esta cadastrado.';
    }

    if (normalized.includes('cpf')) {
      return 'Este CPF ja esta cadastrado.';
    }

    return 'Esse registro ja existe.';
  }

  if (
    normalized.includes('invalid `prisma') ||
    normalized.includes('prismaclient') ||
    normalized.includes('foreign key constraint failed')
  ) {
    return 'não foi possível concluir a operação agora. Tente novamente em instantes.';
  }

  return null;
}

function mapHttpStatusMessage(
  status: number,
  context?: string,
): string | null {
  if (context === 'platform-admin') {
    if (status === 403) {
      return 'Acesso negado. Verifique se VITE_PLATFORM_ADMIN_API_KEY esta correta e autorizada.';
    }

    if (status === 401) {
      return 'Credencial invalida ou ausente para operação de plataforma.';
    }
  }

  return null;
}

function looksLikePortuguese(msg: string): boolean {
  return /[àáâãéêíóôõúç]|aguarde|tentativas|minutos|instantes/i.test(msg);
}

function mapAiQuotaAndRateLimitMessage(
  rawMessage: string,
  status: number,
): string | null {
  const normalized = normalizeMessage(rawMessage);

  if (status === 429) {
    if (rawMessage && looksLikePortuguese(rawMessage)) {
      return rawMessage;
    }
    return 'Muitas solicitacoes em pouco tempo. Aguarde um instante e tente novamente.';
  }

  if (status === 402) {
    return 'Creditos ou quota do plano indisponiveis para esta acao. Verifique Cobrança ou o uso de IA.';
  }

  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests')
  ) {
    return 'Limite de requisicoes atingido. Tente novamente em alguns instantes.';
  }

  if (
    normalized.includes('quota') ||
    normalized.includes('credit exhausted') ||
    normalized.includes('insufficient credits') ||
    normalized.includes('billing limit')
  ) {
    return 'Limite de uso ou creditos de IA esgotados. Ajuste o plano ou reduza o ritmo de solicitacoes.';
  }

  return null;
}

const validationTranslations: Array<[RegExp, string]> = [
  [/must be shorter than or equal to (\d+) characters/i, (_, n) => `deve ter no maximo ${n} caracteres.`],
  [/must be longer than or equal to (\d+) characters/i, (_, n) => `deve ter no minimo ${n} caracteres.`],
  [/must be one of the following values: (.+)/i, (_, v) => `deve ser um dos valores: ${v}.`],
  [/must be a string/i, () => 'deve ser um texto valido.'],
  [/must be a number/i, () => 'deve ser um numero valido.'],
  [/must be an email/i, () => 'deve ser um email valido.'],
  [/should not be empty/i, () => 'nao pode estar vazio.'],
  [/should not exist/i, () => 'contem campo nao permitido.'],
  [/must be an array/i, () => 'deve ser uma lista.'],
  [/deve ser snake_case/i, () => 'deve ser snake_case minusculo (ex.: messaging, catalog).'],
];

function translateValidationConstraint(msg: string): string {
  const fieldMatch = msg.match(/^(\w+)\s+(.+)$/);
  const field = fieldMatch?.[1] ?? '';
  const constraint = fieldMatch?.[2] ?? msg;

  for (const [pattern, replacer] of validationTranslations) {
    const match = constraint.match(pattern);
    if (match) {
      const translated = typeof replacer === 'function'
        ? (replacer as (...args: string[]) => string)(...match)
        : replacer;
      return field ? `${field}: ${translated}` : translated;
    }
  }

  return msg;
}

function mapValidationMessage(error: HttpError): string | null {
  if (error.status !== 400) return null;

  const details = error.details as Record<string, unknown> | undefined;
  const rawMessages = details?.message;

  if (Array.isArray(rawMessages) && rawMessages.length > 0) {
    const translated = rawMessages
      .slice(0, 3)
      .map((m: unknown) => translateValidationConstraint(String(m)));
    return translated.join('\n');
  }

  const msg = error.message || '';
  if (
    msg.includes('must be') ||
    msg.includes('should not') ||
    msg.includes('deve ser')
  ) {
    return translateValidationConstraint(msg);
  }

  return null;
}

function mapDomainMessage(rawMessage: string): string | null {
  const normalized = normalizeMessage(rawMessage);

  if (normalized.includes('invalid credentials') || normalized.includes('invalid email or password')) {
    return 'Email ou senha invalidos.';
  }

  if (normalized.includes('invalid email') && !normalized.includes('password')) {
    return 'Informe um email valido.';
  }

  if (normalized.includes('invalid cpf') || normalized.includes('cpf must')) {
    return 'Informe um CPF valido.';
  }

  if (normalized.includes('invalid cnpj') || normalized.includes('cnpj must')) {
    return 'Informe um CNPJ valido.';
  }

  if (normalized.includes('invalid phone')) {
    return 'Informe um telefone valido.';
  }

  if (normalized.includes('platform credentials are not configured')) {
    return 'Faltam as credenciais da plataforma nesta integração. Depois de preencher as envs, o fluxo fica disponivel.';
  }

  if (normalized.includes('token')) {
    return 'Esse link não e mais valido. Solicite uma nova redefinição.';
  }

  // Alerts domain messages
  if (normalized.includes('reminder limit exceeded') || normalized.includes('active reminder limit')) {
    return 'Limite de alertas ativos atingido. Desative ou exclua um alerta antes de criar outro.';
  }

  if (normalized.includes('reminder time must use hh:mm')) {
    return 'O horario do lembrete deve estar no formato HH:mm (ex.: 08:30).';
  }

  if (normalized.includes('invalid iana timezone')) {
    return 'Fuso horario invalido. Verifique as configuracoes do dispositivo.';
  }

  if (normalized.includes('scheduled date is required')) {
    return 'A data de agendamento e obrigatoria para lembretes unicos.';
  }

  if (normalized.includes('scheduled date is invalid')) {
    return 'A data de agendamento e invalida.';
  }

  if (normalized.includes('scheduled date must be in the future')) {
    return 'A data de agendamento deve ser no futuro.';
  }

  if (normalized.includes('reminder time is required')) {
    return 'O horario e obrigatorio para lembretes recorrentes.';
  }

  // Generic entity not found
  if (normalized.includes('not found')) {
    return 'Registro nao encontrado. Ele pode ter sido removido.';
  }

  return null;
}

interface FriendlyErrorOptions {
  fallbackMessage: string;
  context?: string;
}

export function getFriendlyErrorMessage(
  error: unknown,
  options?: FriendlyErrorOptions,
): string {
  if (error instanceof Error && !(error instanceof HttpError)) {
    console.error('[Unexpected Error]', error);
    return 'Ocorreu um erro inesperado no processamento dos dados.';
  }

  if (!(error instanceof HttpError)) {
    return options.fallbackMessage;
  }

  const rawMessage = error.message || '';

  if (error.status >= 500) {
    return (
      mapPrismaLikeMessage(rawMessage) ??
      'Algo deu errado no servidor. Tente novamente em instantes.'
    );
  }

  return (
    mapHttpStatusMessage(error.status, options?.context) ??
    mapAiQuotaAndRateLimitMessage(rawMessage, error.status) ??
    mapDomainMessage(rawMessage) ??
    mapValidationMessage(error) ??
    mapPrismaLikeMessage(rawMessage) ??
    rawMessage ??
    options.fallbackMessage
  );
}
