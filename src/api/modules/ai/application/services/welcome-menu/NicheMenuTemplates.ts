import { NicheCategory } from './NicheClassifier';

export interface NicheTemplate {
  tone: string;
  greeting: string;
}

const NICHE_TEMPLATES: Record<NicheCategory, NicheTemplate> = {
  FOOD: {
    tone: 'Casual, acolhedor, objetivo',
    greeting: 'Oi! Que bom ter você aqui 😊 Veja como posso ajudar:',
  },
  RETAIL: {
    tone: 'Prestativo, direto, simpático',
    greeting: 'Olá! Bem-vindo(a) à {companyName}! Como posso ajudar?',
  },
  ECOMMERCE: {
    tone: 'Ágil, prestativo',
    greeting: 'Oi! Tudo bem? Estou aqui para ajudar com sua compra:',
  },
  HEALTH: {
    tone: 'Profissional, empático, acolhedor',
    greeting: 'Olá! Seja bem-vindo(a) à {companyName}. Como posso ajudá-lo(a)?',
  },
  BEAUTY: {
    tone: 'Descontraído, simpático, cuidadoso',
    greeting: 'Oi! Tudo bem? Vamos cuidar de você! Veja o que posso fazer:',
  },
  RECOVERY: {
    tone: 'Respeitoso, neutro, sem pressão',
    greeting: 'Olá. Estou aqui para ajudar. Veja as opções:',
  },
  HOME_SERV: {
    tone: 'Consultivo, profissional, cordial',
    greeting:
      'Olá! Obrigado pelo contato com a {companyName}. Como posso ajudar?',
  },
  EDUCATION: {
    tone: 'Motivador, acessível, informativo',
    greeting: 'Olá! Que bom que você se interessou! Veja como posso ajudar:',
  },
  B2B: {
    tone: 'Formal, consultivo, objetivo',
    greeting: 'Olá! Obrigado por entrar em contato com a {companyName}.',
  },
  DEFAULT: {
    tone: 'Neutro, amigável',
    greeting: 'Olá! Como posso ajudar?',
  },
};

export const MENU_INSTRUCTIONS_TEMPLATE = `REGRAS:
- Quando o cliente digitar um número (1, 2, 3...) ou emoji de número (1️⃣, 2️⃣...), interprete como a opção correspondente do menu.
- Quando o cliente digitar "0", "voltar", "menu", "início" ou "opcoes", reapresente o menu principal completo.
- Quando o cliente digitar texto livre, use o contexto para identificar a intenção e direcionar ao fluxo correto.
- Não repita o menu inteiro a cada mensagem. Só reapresente se o cliente pedir explicitamente.
- Se o cliente pedir algo fora do menu, atenda normalmente usando os contextos disponíveis.
- Para opções com submenu, guie o cliente passo a passo sem despejar tudo de uma vez.
- Em TODOS os submenus, sempre ofereça "0️⃣ Voltar ao menu principal" como última opção.
- Sempre termine com uma pergunta ou CTA claro para manter a conversa fluindo.
- NUNCA liste, invente ou exemplifique produtos, categorias, preços ou serviços que não estejam fornecidos explicitamente no contexto da empresa. Se não houver dados de catálogo disponíveis, informe isso ao cliente e ofereça atendente humano.`;

export function getNicheTemplate(category: NicheCategory): NicheTemplate {
  return NICHE_TEMPLATES[category];
}

export function formatGreeting(
  category: NicheCategory,
  companyName: string,
): string {
  const template = NICHE_TEMPLATES[category];
  return template.greeting.replace(/{companyName}/g, companyName);
}

export function getToneDescription(category: NicheCategory): string {
  return NICHE_TEMPLATES[category].tone;
}
