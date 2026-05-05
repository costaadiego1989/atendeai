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
    return 'não foi possivel concluir a operação agora. Tente novamente em instantes.';
  }

  return null;
}

function mapHttpStatusMessage(status: number): string | null {
  if (status === 403) {
    return 'Acesso negado. Verifique se VITE_PLATFORM_ADMIN_API_KEY esta correta e autorizada.';
  }

  if (status === 401) {
    return 'Credencial invalida ou ausente para operação de plataforma.';
  }

  return null;
}

function mapAiQuotaAndRateLimitMessage(
  rawMessage: string,
  status: number,
): string | null {
  const normalized = normalizeMessage(rawMessage);

  if (status === 429) {
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

function mapDomainMessage(rawMessage: string): string | null {
  const normalized = normalizeMessage(rawMessage);

  if (normalized.includes('invalid credentials')) {
    return 'Email ou senha invalidos.';
  }

  if (normalized.includes('invalid email')) {
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

  return null;
}

interface FriendlyErrorOptions {
  fallbackMessage: string;
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
    mapHttpStatusMessage(error.status) ??
    mapAiQuotaAndRateLimitMessage(rawMessage, error.status) ??
    mapPrismaLikeMessage(rawMessage) ??
    mapDomainMessage(rawMessage) ??
    rawMessage ??
    options.fallbackMessage
  );
}
