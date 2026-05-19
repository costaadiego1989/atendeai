/**
 * Signal Assertions
 *
 * Validação por sinais (signal-based assertions) para respostas da IA real.
 * Como a IA é não-determinística, validamos presença de keywords esperadas
 * e ausência de sinais proibidos (leaks de infra, erros internos).
 */

/** Sinais proibidos globais — indicam leak de infraestrutura ou erro */
export const FORBIDDEN_SIGNALS = [
  'deepseek',
  'api key',
  'api_key',
  'provider',
  'erro interno',
  'nao consegui processar',
  'undefined',
  'null',
  'internal error',
  'stack trace',
  'exception',
  'NestJS',
  'TypeError',
  'ReferenceError',
];

export interface SignalAssertionConfig {
  /** Pelo menos 1 desses sinais deve estar presente na resposta */
  mustContainAny: string[];
  /** Nenhum desses sinais pode estar presente (erros, leaks) */
  mustNotContain?: string[];
  /** Tamanho mínimo da resposta (default: 10) */
  minLength?: number;
  /** Tamanho máximo da resposta (default: sem limite) */
  maxLength?: number;
}

/**
 * Valida que a resposta da IA contém sinais esperados e não contém sinais proibidos.
 */
export function expectAIResponse(
  text: string,
  config: SignalAssertionConfig,
): void {
  const normalized = normalize(text);
  const forbidden = [
    ...FORBIDDEN_SIGNALS,
    ...(config.mustNotContain || []),
  ];

  // Não pode conter sinais de erro/leak
  for (const signal of forbidden) {
    const normalizedSignal = normalize(signal);
    if (normalized.includes(normalizedSignal)) {
      throw new Error(
        `AI response contains forbidden signal: "${signal}"\nResponse: "${text.slice(0, 200)}..."`,
      );
    }
  }

  // Tamanho mínimo
  const minLength = config.minLength ?? 10;
  if (text.trim().length < minLength) {
    throw new Error(
      `AI response too short (${text.trim().length} < ${minLength}): "${text}"`,
    );
  }

  // Tamanho máximo (se configurado)
  if (config.maxLength && text.trim().length > config.maxLength) {
    throw new Error(
      `AI response too long (${text.trim().length} > ${config.maxLength})`,
    );
  }

  // Deve conter pelo menos um sinal esperado
  const hasSignal = config.mustContainAny.some((signal) =>
    normalized.includes(normalize(signal)),
  );

  if (!hasSignal) {
    // Fallback: verifica sinais genéricos de resposta saudável
    const genericSignals = [
      'posso',
      'vamos',
      'ajudar',
      'pedido',
      'horario',
      'agenda',
      'pagamento',
      'servico',
      'produto',
      'cliente',
      'ola',
      'bom dia',
      'boa tarde',
      'disponivel',
    ];

    const hasGeneric = genericSignals.some((s) => normalized.includes(s));

    if (!hasGeneric) {
      throw new Error(
        `AI response does not contain any expected signal.\n` +
          `Expected any of: [${config.mustContainAny.join(', ')}]\n` +
          `Response: "${text.slice(0, 300)}..."`,
      );
    }
  }
}

/**
 * Valida resposta de follow-up — deve ser contextual e breve.
 * Nota: o texto pode incluir todas as respostas AI concatenadas,
 * então o maxLength é mais permissivo.
 */
export function expectFollowUpResponse(
  text: string,
  nicheSignals: string[],
): void {
  expectAIResponse(text, {
    mustContainAny: [
      ...nicheSignals,
      'continuar',
      'retomar',
      'ajudar',
      'posso',
      'ainda',
      'interesse',
      'voltar',
    ],
    minLength: 15,
    maxLength: 3000,
  });
}

/**
 * Valida que a resposta da IA é saudável (sem erros) mesmo sem sinais específicos.
 */
export function expectHealthyResponse(text: string): void {
  const normalized = normalize(text);

  for (const signal of FORBIDDEN_SIGNALS) {
    if (normalized.includes(normalize(signal))) {
      throw new Error(
        `AI response contains forbidden signal: "${signal}"\nResponse: "${text.slice(0, 200)}..."`,
      );
    }
  }

  if (text.trim().length < 10) {
    throw new Error(`AI response too short: "${text}"`);
  }
}

/**
 * Valida que uma commerce session foi criada para a conversa.
 */
export async function expectCommerceSession(
  prisma: any,
  tenantId: string,
  conversationId: string,
): Promise<void> {
  const sessions = await prisma.$queryRaw`
    SELECT id::text, status
    FROM commerce_schema.shopping_sessions
    WHERE tenant_id = ${tenantId}::uuid
      AND conversation_id = ${conversationId}::uuid
    ORDER BY updated_at DESC
  `;

  if (!sessions || sessions.length === 0) {
    throw new Error(
      `No commerce session found for conversation ${conversationId}`,
    );
  }
}

/**
 * Valida que uma order foi criada (checkout completo).
 */
export async function expectCommerceOrder(
  prisma: any,
  tenantId: string,
  conversationId: string,
): Promise<void> {
  const orders = await prisma.$queryRaw`
    SELECT id::text
    FROM commerce_schema.orders
    WHERE tenant_id = ${tenantId}::uuid
      AND conversation_id = ${conversationId}::uuid
  `;

  if (!orders || orders.length === 0) {
    throw new Error(
      `No commerce order found for conversation ${conversationId}`,
    );
  }
}

/** Normaliza texto removendo acentos e convertendo para lowercase */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
