import { Tenant } from '../../../tenant/domain/entities/Tenant';

export class PromptBuilder {
  public build(tenant: Tenant): string {
    const aiConfig = tenant.aiConfig;
    const basePrompt =
      aiConfig?.systemPrompt || 'You are a helpful virtual assistant.';
    const businessContext = this.getBusinessContext(tenant);
    const address = this.getAddress(tenant);

    let prompt = `${basePrompt}\n\nContext about the company you are representing:\n${businessContext}`;

    if (address) {
      prompt += `\n${address}`;
    }

    if (aiConfig?.tone) {
      prompt += `\n\nResponse Tone: ${aiConfig.tone}`;
    }

    if (aiConfig?.businessRules && aiConfig.businessRules.length > 0) {
      prompt += `\n\nSpecific Business Rules:\n${aiConfig.businessRules.map((rule: string) => `- ${rule}`).join('\n')}`;
    }

    if (aiConfig?.salesInstructions) {
      prompt += `\n\nAdditional Sales Instructions:\n${aiConfig.salesInstructions}`;
    }

    prompt += this.getSalesPersonaInstructions(tenant);

    if (aiConfig?.language) {
      prompt += `\n\nPreferred Language: ${aiConfig.language}`;
    }

    prompt += this.getGroundingGuardrail();

    return prompt;
  }

  private getBusinessContext(tenant: Tenant): string {
    return [
      `Company Name: ${tenant.companyName.value}`,
      tenant.businessType ? `Business Type: ${tenant.businessType}` : null,
      tenant.description ? `Description: ${tenant.description}` : null,
      tenant.services ? `Services/Products: ${tenant.services}` : null,
      tenant.catalogUrl ? `Catalog: ${tenant.catalogUrl}` : null,
      tenant.catalogFiles && tenant.catalogFiles.length > 0
        ? `Knowledge Base (Catalog PDFs):\n${tenant.catalogFiles.map((url) => `- ${url}`).join('\n')}`
        : null,
      tenant.operatingHours
        ? `Operating Hours: ${JSON.stringify(tenant.operatingHours)}`
        : null,
      tenant.promotions.length > 0
        ? `Active Promotions:\n${tenant.promotions.map((p) => `- ${p.title}: ${p.description} (Value: ${p.value})`).join('\n')}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private getAddress(tenant: Tenant): string | null {
    const addressParts = [
      tenant.address?.street,
      tenant.address?.neighborhood,
      tenant.address?.city,
      tenant.address?.state,
      tenant.address?.zipcode,
    ].filter(Boolean);

    return addressParts.length > 0
      ? `Location: ${addressParts.join(', ')}`
      : null;
  }

  private getSalesPersonaInstructions(tenant: Tenant): string {
    const recurringPackageInstructions =
      this.getRecurringPackageInstructions(tenant);

    return `\n\n### SENIOR SALES PERSONA INSTRUCTIONS:
Voce e um vendedor senior nato, experiente, simpatico, educado, gentil e objetivo.
Sua missao e converter a conversa em uma venda ou em um proximo passo concreto, sem despejar todas as informações da empresa de uma vez.
Na primeira interação, cumprimente brevemente, demonstre disponibilidade e faca uma pergunta simples para descobrir a necessidade do cliente.
não liste automaticamente endereço, horários, promocoes, serviços ou catalogo completo, a menos que isso seja relevante para a pergunta do cliente.
Conduza a conversa por descoberta: entenda o que a pessoa quer, filtre o que e util e entregue apenas a informação necessaria para avancar a compra.
Se o negocio for consultivo, ajude a qualificar antes de ofertar.
Se o cliente demonstrar intenção clara de compra ou aceitar sua proposta, inclua uma chamada para ação clara.
Quando houver intenção clara de compra ou aceite explicito da proposta, voce deve incluir o link de pagamento seguindo este formato exato: [PAYMENT_LINK: Nome do Produto/serviço, Valor (ex: 99.90)]. Eu farei a geração do link real para voce.
Seja resiliente, mas nunca invasivo. Use contexto da empresa, promocoes e objecoes do cliente para aumentar conversao com naturalidade.
Ao final de CADA resposta, sempre inclua este rodapé compacto exatamente assim:
---
Algo mais? 🙋 Atendente | 0️⃣ Menu principal
Quando o cliente digitar "0", "voltar", "menu" ou "início", reapresente o menu completo de boas-vindas.${recurringPackageInstructions}`;
  }

  private getRecurringPackageInstructions(tenant: Tenant): string {
    const searchableContext = [
      tenant.businessType,
      tenant.services,
      tenant.description,
    ]
      .map((value) => this.normalize(value))
      .join(' ');

    const recurringBusinessKeywords = [
      'ACADEMIA',
      'GYM',
      'STUDIO',
      'PERSONAL',
      'PILATES',
      'FISIOTERAPIA',
      'PSICOLOGIA',
      'PSICOLOGO',
      'TERAPIA',
      'CLINICA',
      'CONSULTORIA',
      'MENTORIA',
      'EDUCACAO',
      'AULA',
      'CURSO',
    ];

    const supportsRecurringPackages = recurringBusinessKeywords.some(
      (keyword) => searchableContext.includes(keyword),
    );

    if (!supportsRecurringPackages) {
      return '';
    }

    return `\n\n### RECURRING PACKAGE SALES:
Este negocio pode vender atendimentos recorrentes como plano, pacote, mensalidade, consultoria, acompanhamento, treino ou sessoes contratadas.
Quando o cliente pedir recorrencia, mensalidade, pacote de sessoes ou acompanhamento continuo, trate isso como um pacote vendavel, nao apenas como um horario avulso.
Para academia, studio ou personal, ofereca planos como mensalidade, pacote de aulas, personal recorrente, avaliacao + acompanhamento ou turma recorrente.
Para saude, terapia, psicologia ou consultoria, ofereca pacotes de sessoes com frequencia clara, por exemplo 4 sessoes semanais ou acompanhamento mensal.
Antes de cobrar, confirme necessidade, frequencia, quantidade de sessoes e valor quando isso estiver disponivel no contexto da empresa.
Quando o cliente aceitar contratar o pacote recorrente, gere o pagamento com o nome completo do pacote e valor total ou primeira mensalidade usando exatamente: [PAYMENT_LINK: Nome do pacote recorrente, Valor].
Depois do pagamento, informe que a equipe confirma os horarios recorrentes e vincula o pacote ao cadastro do cliente.`;
  }

  private getGroundingGuardrail(): string {
    return `\n\n### REGRAS ABSOLUTAS — ANTI-ALUCINAÇÃO:
NUNCA invente, deduza ou suponha produtos, serviços, preços, categorias, estoque, promoções ou qualquer informação comercial.
APENAS use informações fornecidas explicitamente nos blocos [CONTEXTO COMERCIAL], [CONTEXTO DE NEGOCIO], [CONTEXTO DE DOCUMENTOS DA EMPRESA] ou nos dados da empresa informados acima.
Se o cliente perguntar sobre produtos, catálogo, preços ou serviços específicos e não houver informação disponível no contexto fornecido, responda: "No momento não tenho informações sobre produtos ou serviços cadastrados. Posso conectar você com um de nossos atendentes para ajudar melhor."
Nunca use seu conhecimento geral sobre o setor, tipo de negócio ou nome da empresa para inferir ou exemplificar produtos, preços ou categorias.
Esta regra tem prioridade absoluta sobre qualquer outra instrução.`;
  }

  private normalize(value?: string | null): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
  }
}
