import { NicheWelcomeMenuService, NicheWelcomeMenuInput } from '../../application/services/welcome-menu/NicheWelcomeMenuService';

describe('NicheWelcomeMenu Integration', () => {
  let service: NicheWelcomeMenuService;

  beforeEach(() => {
    service = new NicheWelcomeMenuService();
  });

  describe('full flow — FOOD niche with all conditions', () => {
    it('should produce a complete welcome prompt for a restaurant', () => {
      const input: NicheWelcomeMenuInput = {
        companyName: 'Pizzaria do João',
        businessType: 'FOOD',
        operatingHours: {
          monday: { open: '11:00', close: '23:00' },
          tuesday: { open: '11:00', close: '23:00' },
          sunday: { open: '11:00', close: '23:00', closed: false },
        },
        promotions: [
          { title: 'Pizza 2 por 1', description: 'Terça-feira', value: '50%' },
        ],
        catalogFiles: ['cardapio.pdf'],
        catalogUrl: null,
        services: null,
        schedulingCategories: [],
        commerceCatalogItemCount: 35,
        hasRecoveryCases: false,
      };

      const result = service.buildWelcomePrompt(input);

      // Header
      expect(result).toContain('[MENU DE BOAS-VINDAS]');

      // Greeting (FOOD tone)
      expect(result).toContain('Oi! Que bom ter você aqui');

      // Menu items
      expect(result).toContain('1️⃣ Ver cardápio — consultar cardápio completo');
      expect(result).toContain('2️⃣ Fazer pedido');
      expect(result).toContain('3️⃣ Acompanhar pedido');
      expect(result).toContain('4️⃣ Repetir último pedido');
      expect(result).toContain('5️⃣ Promoções do dia');
      expect(result).toContain('6️⃣ Horários de funcionamento');
      expect(result).toContain('7️⃣ Entrega e retirada');
      expect(result).toContain('8️⃣ Falar com atendente');

      // Back to menu option
      expect(result).toContain('0️⃣ Voltar ao menu principal');

      // Rules
      expect(result).toContain('REGRAS:');

      // Tone
      expect(result).toContain('Tom: Casual, acolhedor, objetivo');
    });
  });

  describe('full flow — HEALTH niche minimal conditions', () => {
    it('should produce a welcome prompt for a clinic with scheduling', () => {
      const input: NicheWelcomeMenuInput = {
        companyName: 'Clínica Vida',
        businessType: 'CLINIC',
        operatingHours: null,
        promotions: [],
        catalogFiles: [],
        catalogUrl: null,
        services: null,
        schedulingCategories: [
          { id: '1', name: 'Consulta Geral' },
          { id: '2', name: 'Retorno' },
        ],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = service.buildWelcomePrompt(input);

      // Greeting (HEALTH tone)
      expect(result).toContain('Clínica Vida');
      expect(result).toContain('Seja bem-vindo');

      // Core scheduling options
      expect(result).toContain('Agendar consulta');
      expect(result).toContain('Remarcar ou cancelar');
      expect(result).toContain('Especialidades e serviços');
      expect(result).toContain('Valores e formas de pagamento');

      // Should NOT include options for missing conditions
      expect(result).not.toContain('Horários de atendimento');
      expect(result).not.toContain('Informações sobre procedimentos');

      // Tone
      expect(result).toContain('Tom: Profissional, empático, acolhedor');
    });
  });

  describe('full flow — BEAUTY niche with GYM businessType', () => {
    it('should include packages for GYM', () => {
      const input: NicheWelcomeMenuInput = {
        companyName: 'Academia Power',
        businessType: 'GYM',
        operatingHours: { monday: { open: '06:00', close: '22:00' } },
        promotions: [{ title: 'Matrícula grátis', description: 'Maio', value: '100%' }],
        catalogFiles: [],
        catalogUrl: null,
        services: null,
        schedulingCategories: [],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = service.buildWelcomePrompt(input);

      expect(result).toContain('Agendar horário');
      expect(result).toContain('Pacotes e planos');
      expect(result).toContain('Promoções');
      expect(result).toContain('Horários de funcionamento');
      expect(result).toContain('Tom: Descontraído, simpático, cuidadoso');
    });
  });

  describe('full flow — RECOVERY niche', () => {
    it('should produce recovery-specific menu', () => {
      const input: NicheWelcomeMenuInput = {
        companyName: 'Cobranças Seguras',
        businessType: 'RECOVERY',
        operatingHours: null,
        promotions: [],
        catalogFiles: [],
        catalogUrl: null,
        services: null,
        schedulingCategories: [],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: true,
      };

      const result = service.buildWelcomePrompt(input);

      expect(result).toContain('Consultar pendências');
      expect(result).toContain('Segunda via de boleto');
      expect(result).toContain('Negociar pagamento');
      expect(result).toContain('Informar pagamento realizado');
      expect(result).toContain('Agendar data de pagamento');
      expect(result).toContain('Tom: Respeitoso, neutro, sem pressão');
    });
  });

  describe('full flow — HOME_SERV niche (LEGAL)', () => {
    it('should produce consultative menu for law firm', () => {
      const input: NicheWelcomeMenuInput = {
        companyName: 'Advocacia Silva & Associados',
        businessType: 'LEGAL',
        operatingHours: { monday: { open: '08:00', close: '18:00' } },
        promotions: [],
        catalogFiles: ['portfolio.pdf'],
        catalogUrl: null,
        services: 'Direito Civil, Trabalhista, Empresarial',
        schedulingCategories: [{ id: '1', name: 'Reunião presencial' }],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = service.buildWelcomePrompt(input);

      expect(result).toContain('Advocacia Silva & Associados');
      expect(result).toContain('Nossos serviços');
      expect(result).toContain('Solicitar orçamento');
      expect(result).toContain('Acompanhar proposta');
      expect(result).toContain('Agendar reunião ou visita');
      expect(result).toContain('Horários de atendimento');
      expect(result).toContain('Documentos e materiais');
      expect(result).toContain('Tom: Consultivo, profissional, cordial');
    });
  });

  describe('full flow — B2B niche', () => {
    it('should produce B2B menu', () => {
      const input: NicheWelcomeMenuInput = {
        companyName: 'TechCorp Solutions',
        businessType: 'B2B',
        operatingHours: null,
        promotions: [],
        catalogFiles: ['cases.pdf'],
        catalogUrl: null,
        services: 'Consultoria, Desenvolvimento, Suporte',
        schedulingCategories: [{ id: '1', name: 'Call comercial' }],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = service.buildWelcomePrompt(input);

      expect(result).toContain('TechCorp Solutions');
      expect(result).toContain('Nossas soluções');
      expect(result).toContain('Solicitar proposta comercial');
      expect(result).toContain('Acompanhar proposta');
      expect(result).toContain('Cases e resultados');
      expect(result).toContain('Agendar reunião');
      expect(result).toContain('Falar com consultor');
      expect(result).toContain('Tom: Formal, consultivo, objetivo');
    });
  });

  describe('full flow — EDUCATION niche', () => {
    it('should produce education menu', () => {
      const input: NicheWelcomeMenuInput = {
        companyName: 'Escola de Idiomas Global',
        businessType: 'EDUCATION',
        operatingHours: { monday: { open: '07:00', close: '21:00' } },
        promotions: [{ title: 'Bolsa 30%', description: 'Novos alunos', value: '30%' }],
        catalogFiles: ['material.pdf'],
        catalogUrl: null,
        services: null,
        schedulingCategories: [{ id: '1', name: 'Aula experimental' }],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = service.buildWelcomePrompt(input);

      expect(result).toContain('Cursos disponíveis');
      expect(result).toContain('Agendar aula experimental');
      expect(result).toContain('Matrícula e pacotes');
      expect(result).toContain('Horários das turmas');
      expect(result).toContain('Material didático');
      expect(result).toContain('Promoções e bolsas');
      expect(result).toContain('Acompanhar matrícula');
      expect(result).toContain('Tom: Motivador, acessível, informativo');
    });
  });

  describe('full flow — DEFAULT (unknown businessType)', () => {
    it('should produce minimal default menu', () => {
      const input: NicheWelcomeMenuInput = {
        companyName: 'Empresa Genérica',
        businessType: null,
        operatingHours: null,
        promotions: [],
        catalogFiles: [],
        catalogUrl: null,
        services: null,
        schedulingCategories: [],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = service.buildWelcomePrompt(input);

      expect(result).toContain('[MENU DE BOAS-VINDAS]');
      expect(result).toContain('Falar com atendente');
      expect(result).toContain('Tom: Neutro, amigável');
      expect(result).toContain('REGRAS:');
    });
  });

  describe('prompt structure consistency', () => {
    it('should always have the same structure regardless of niche', () => {
      const niches = ['RETAIL', 'FOOD', 'HEALTH', 'BEAUTY', 'RECOVERY', 'LEGAL', 'EDUCATION', 'B2B', null];

      for (const businessType of niches) {
        const input: NicheWelcomeMenuInput = {
          companyName: 'Test',
          businessType,
          operatingHours: null,
          promotions: [],
          catalogFiles: [],
          catalogUrl: null,
          services: null,
          schedulingCategories: [],
          commerceCatalogItemCount: 0,
          hasRecoveryCases: false,
        };

        const result = service.buildWelcomePrompt(input);

        // All prompts must have these structural elements
        expect(result).toContain('[MENU DE BOAS-VINDAS]');
        expect(result).toContain('Saudação:');
        expect(result).toContain('0️⃣ Voltar ao menu principal');
        expect(result).toContain('REGRAS:');
        expect(result).toContain('Tom:');
      }
    });
  });
});
