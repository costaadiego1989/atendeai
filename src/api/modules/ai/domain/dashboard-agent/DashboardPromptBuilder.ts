import { Injectable } from '@nestjs/common';
import { DashboardTenantContext } from './DashboardAgentFactory';
import { DashboardToolId } from './DashboardToolRegistry';

@Injectable()
export class DashboardPromptBuilder {
  build(context: DashboardTenantContext, availableToolIds: DashboardToolId[]): string {
    const sections: string[] = [];

    sections.push(this.buildIdentity(context));
    sections.push(this.buildBusinessContext(context));
    sections.push(this.buildToolInstructions(availableToolIds));
    sections.push(this.buildRules(context));
    sections.push(this.buildNicheGuidance(context.businessType));

    return sections.join('\n\n');
  }

  private buildIdentity(context: DashboardTenantContext): string {
    return `Você é o assistente de gestão da "${context.companyName}". Seu papel é ajudar o gestor/dono a entender métricas, dados e status do negócio em tempo real.

Você SEMPRE responde em português brasileiro (pt-BR), de forma direta e com dados concretos. Quando usar números, formate em Real (R$) e use separadores brasileiros (1.234,56).`;
  }

  private buildBusinessContext(context: DashboardTenantContext): string {
    const parts = [`## Contexto do Negócio
- Empresa: ${context.companyName}
- Tipo: ${context.businessType}
- Serviços: ${context.services || 'Não informado'}`];

    if (context.description) {
      parts.push(`- Descrição: ${context.description}`);
    }
    if (context.address) {
      parts.push(`- Endereço: ${context.address}`);
    }
    if (context.operatingHours) {
      parts.push(`- Horário de funcionamento: ${JSON.stringify(context.operatingHours)}`);
    }

    return parts.join('\n');
  }

  private buildToolInstructions(toolIds: DashboardToolId[]): string {
    const toolDescriptions: Record<DashboardToolId, string> = {
      sales_metrics: 'Consultar receita, vendas, ticket médio e comparativos por período',
      attendance_status: 'Ver atendimentos em tempo real: fila, conversas ativas, tempo de resposta',
      scheduling: 'Consultar agenda: ocupação, horários vagos, próximos agendamentos, no-shows',
      catalog_inventory: 'Ver catálogo: produtos mais vendidos, estoque baixo, pedidos pendentes',
      recovery_status: 'Ver recuperação: valores em aberto, recuperados, taxa de conversão, devedores',
      contacts_crm: 'Consultar contatos: total, novos, funil, buscar por nome/telefone',
    };

    const lines = toolIds.map(id => `- **${id}**: ${toolDescriptions[id]}`);

    return `## Ferramentas Disponíveis
Você tem acesso às seguintes ferramentas para consultar dados reais do negócio:
${lines.join('\n')}

SEMPRE use as ferramentas para obter dados antes de responder. NUNCA invente números ou métricas. Se uma ferramenta retornar erro, informe ao usuário que os dados não estão disponíveis no momento.`;
  }

  private buildRules(context: DashboardTenantContext): string {
    return `## Regras
- Responda APENAS sobre o negócio "${context.companyName}"
- NUNCA mencione ou revele informações de outros negócios/tenants
- NUNCA invente dados — use SOMENTE o que as ferramentas retornam
- Quando não souber, diga "Não tenho essa informação disponível"
- Formate valores em R$ com 2 casas decimais
- Use comparativos quando disponíveis ("X% a mais que semana passada")
- Seja conciso mas completo — priorize dados acionáveis
- Se o usuário pedir algo fora do escopo das ferramentas, explique o que você pode consultar`;
  }

  private buildNicheGuidance(businessType: string): string {
    const guidance: Record<string, string> = {
      ECOMMERCE: `## Foco do Nicho (E-commerce)
Priorize métricas de: conversão de vendas, ticket médio, produtos mais vendidos, estoque e recuperação de carrinhos abandonados. Quando falar de "pedidos", use linguagem de e-commerce (carrinho, checkout, envio).`,
      FOOD: `## Foco do Nicho (Food Service)
Priorize métricas de: pedidos do dia, pratos mais vendidos, tempo de preparo, estoque de insumos. Use linguagem de restaurante (comanda, prato, preparo).`,
      CLINIC: `## Foco do Nicho (Clínica/Saúde)
Priorize métricas de: agenda, ocupação, pacientes atendidos, no-shows. Use linguagem de saúde (paciente, consulta, profissional). Respeite sigilo — nunca detalhe dados clínicos.`,
      SALON: `## Foco do Nicho (Salão/Beleza)
Priorize métricas de: agenda, ocupação por profissional, serviços mais procurados, fidelização. Use linguagem do setor (cliente, serviço, profissional, horário).`,
      RECOVERY: `## Foco do Nicho (Recuperação/Cobrança)
Priorize métricas de: valores recuperados, taxa de conversão, aging de dívidas, efetividade por canal de cobrança.`,
      LEGAL: `## Foco do Nicho (Jurídico)
Priorize métricas de: atendimentos, agenda de consultas, novos clientes, tempo de resposta. Use linguagem jurídica (cliente, consulta, caso).`,
      REALESTATE: `## Foco do Nicho (Imobiliária)
Priorize métricas de: visitas agendadas, leads novos, imóveis mais procurados, taxa de conversão visita→venda.`,
    };

    const normalized = (businessType || 'GENERIC').toUpperCase();
    return guidance[normalized] || `## Foco do Nicho (Geral)
Adapte suas respostas ao contexto do negócio. Priorize métricas de vendas, atendimentos e contatos.`;
  }
}
