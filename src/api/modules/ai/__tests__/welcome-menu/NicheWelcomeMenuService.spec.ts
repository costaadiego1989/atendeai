import { NicheWelcomeMenuService, NicheWelcomeMenuInput } from '../../application/services/welcome-menu/NicheWelcomeMenuService';
import { MenuConditions } from '../../application/services/welcome-menu/MenuConditionEvaluator';

describe('NicheWelcomeMenuService', () => {
  let service: NicheWelcomeMenuService;

  beforeEach(() => {
    service = new NicheWelcomeMenuService();
  });

  describe('buildWelcomePrompt', () => {
    const baseInput: NicheWelcomeMenuInput = {
      companyName: 'Loja Teste',
      businessType: 'RETAIL',
      operatingHours: null,
      promotions: [],
      catalogFiles: [],
      catalogUrl: null,
      services: null,
      schedulingCategories: [],
      commerceCatalogItemCount: 0,
      hasRecoveryCases: false,
    };

    it('should return a formatted welcome prompt with menu header', () => {
      const result = service.buildWelcomePrompt(baseInput);
      expect(result).toContain('[MENU DE BOAS-VINDAS]');
    });

    it('should include greeting with company name for RETAIL', () => {
      const result = service.buildWelcomePrompt(baseInput);
      expect(result).toContain('Loja Teste');
    });

    it('should include menu options for RETAIL', () => {
      const result = service.buildWelcomePrompt({
        ...baseInput,
        commerceCatalogItemCount: 10,
      });
      expect(result).toContain('Pesquisar produtos');
      expect(result).toContain('Falar com atendente');
    });

    it('should include tone instruction', () => {
      const result = service.buildWelcomePrompt(baseInput);
      expect(result).toContain('Tom:');
      expect(result).toContain('Prestativo, direto, simpático');
    });

    it('should include menu rules/instructions', () => {
      const result = service.buildWelcomePrompt(baseInput);
      expect(result).toContain('REGRAS:');
      expect(result).toContain('Voltar ao menu principal');
    });

    it('should include "0️⃣ Voltar ao menu principal" instruction', () => {
      const result = service.buildWelcomePrompt(baseInput);
      expect(result).toContain('0️⃣ Voltar ao menu principal');
    });

    it('should build FOOD menu for FOOD businessType', () => {
      const result = service.buildWelcomePrompt({
        ...baseInput,
        businessType: 'FOOD',
        companyName: 'Restaurante Bom',
        commerceCatalogItemCount: 5,
      });
      expect(result).toContain('cardápio');
      expect(result).toContain('Fazer pedido');
      expect(result).toContain('Casual, acolhedor, objetivo');
    });

    it('should build HEALTH menu for CLINIC businessType', () => {
      const result = service.buildWelcomePrompt({
        ...baseInput,
        businessType: 'CLINIC',
        companyName: 'Clínica Saúde',
        schedulingCategories: [{ id: '1', name: 'Consulta' }],
      });
      expect(result).toContain('Agendar consulta');
      expect(result).toContain('Profissional, empático, acolhedor');
    });

    it('should build RECOVERY menu for RECOVERY businessType', () => {
      const result = service.buildWelcomePrompt({
        ...baseInput,
        businessType: 'RECOVERY',
        companyName: 'Cobranças XYZ',
        hasRecoveryCases: true,
      });
      expect(result).toContain('Consultar pendências');
      expect(result).toContain('Respeitoso, neutro, sem pressão');
    });

    it('should build HOME_SERV menu for LEGAL businessType', () => {
      const result = service.buildWelcomePrompt({
        ...baseInput,
        businessType: 'LEGAL',
        companyName: 'Advocacia Silva',
        services: 'Direito Civil, Trabalhista',
      });
      expect(result).toContain('Nossos serviços');
      expect(result).toContain('Solicitar orçamento');
    });

    it('should build EDUCATION menu for EDUCATION businessType', () => {
      const result = service.buildWelcomePrompt({
        ...baseInput,
        businessType: 'EDUCATION',
        companyName: 'Escola ABC',
      });
      expect(result).toContain('Cursos disponíveis');
      expect(result).toContain('Matrícula e pacotes');
    });

    it('should build B2B menu for B2B businessType', () => {
      const result = service.buildWelcomePrompt({
        ...baseInput,
        businessType: 'B2B',
        companyName: 'Tech Solutions',
        services: 'Consultoria, Desenvolvimento',
      });
      expect(result).toContain('Nossas soluções');
      expect(result).toContain('Solicitar proposta comercial');
    });

    it('should build DEFAULT menu for null businessType', () => {
      const result = service.buildWelcomePrompt({
        ...baseInput,
        businessType: null,
        companyName: 'Empresa X',
      });
      expect(result).toContain('Falar com atendente');
      expect(result).toContain('Neutro, amigável');
    });

    it('should build DEFAULT menu for unknown businessType', () => {
      const result = service.buildWelcomePrompt({
        ...baseInput,
        businessType: 'UNKNOWN_TYPE',
        companyName: 'Empresa Y',
      });
      expect(result).toContain('Falar com atendente');
    });

    it('should include conditional options based on tenant data', () => {
      const result = service.buildWelcomePrompt({
        ...baseInput,
        businessType: 'RETAIL',
        promotions: [{ title: 'Promo', description: '10%', value: '10%' }],
        operatingHours: { monday: { open: '08:00', close: '18:00' } },
        commerceCatalogItemCount: 20,
      });
      expect(result).toContain('Promoções e cupons');
      expect(result).toContain('Horários de funcionamento');
    });
  });
});
