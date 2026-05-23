import { IMenuBuilder, MenuBuilderInput } from './IMenuBuilder';
import { NicheCategory } from '../NicheClassifier';

const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export class CommerceMenuBuilder implements IMenuBuilder {
  private static readonly SUPPORTED: NicheCategory[] = [
    'RETAIL',
    'ECOMMERCE',
    'FOOD',
  ];

  supports(category: NicheCategory): boolean {
    return CommerceMenuBuilder.SUPPORTED.includes(category);
  }

  build(input: MenuBuilderInput): string {
    switch (input.category) {
      case 'RETAIL':
        return this.buildRetailMenu(input);
      case 'ECOMMERCE':
        return this.buildEcommerceMenu(input);
      case 'FOOD':
        return this.buildFoodMenu(input);
      default:
        return this.buildRetailMenu(input);
    }
  }

  private buildRetailMenu(input: MenuBuilderInput): string {
    const { conditions } = input;
    const options: string[] = [];

    if (conditions.hasCommerceCatalog) {
      options.push(
        'Pesquisar produtos — busca no catálogo por nome, mostra preço e estoque',
      );
    } else {
      options.push(
        'Falar com atendente sobre produtos — sem catálogo cadastrado no momento',
      );
    }
    options.push(
      'Meu carrinho — ver itens no carrinho atual ou continuar compra',
    );
    options.push('Acompanhar pedido — status do pedido e código de rastreio');
    options.push('Repetir último pedido — refaz o pedido anterior');

    if (conditions.hasPromotions) {
      options.push('Promoções e cupons — ofertas ativas');
    }
    if (conditions.hasOperatingHours) {
      options.push('Horários de funcionamento');
    }

    options.push('Política de entrega — frete, prazo e área de cobertura');
    options.push('Falar com atendente');

    return this.formatMenu(options);
  }

  private buildEcommerceMenu(input: MenuBuilderInput): string {
    const { conditions } = input;
    const options: string[] = [];

    if (conditions.hasCommerceCatalog) {
      options.push('Pesquisar produtos — busca por nome ou categoria');
    } else {
      options.push(
        'Falar com atendente sobre produtos — sem catálogo cadastrado no momento',
      );
    }
    options.push('Meu carrinho — ver ou continuar compra');
    options.push('Acompanhar pedido — rastreio e status');
    options.push('Repetir último pedido');

    if (conditions.hasPromotions) {
      options.push('Promoções');
    }

    options.push('Entrega e frete — prazo, valor e área');
    options.push('Formas de pagamento');
    options.push('Falar com atendente');

    return this.formatMenu(options);
  }

  private buildFoodMenu(input: MenuBuilderInput): string {
    const { conditions } = input;
    const options: string[] = [];

    if (conditions.hasCatalogFiles) {
      options.push('Ver cardápio — consultar cardápio completo');
    } else {
      options.push('Ver cardápio — pesquisar itens');
    }

    options.push('Fazer pedido — montar pedido com itens do cardápio');
    options.push('Acompanhar pedido — status e previsão de entrega');
    options.push('Repetir último pedido — refazer pedido anterior');

    if (conditions.hasPromotions) {
      options.push('Promoções do dia');
    }
    if (conditions.hasOperatingHours) {
      options.push('Horários de funcionamento');
    }

    options.push('Entrega e retirada — área, taxa e tempo estimado');
    options.push('Falar com atendente');

    return this.formatMenu(options);
  }

  private formatMenu(options: string[]): string {
    return options
      .map((option, index) => `${EMOJI_NUMBERS[index]} ${option}`)
      .join('\n');
  }
}
