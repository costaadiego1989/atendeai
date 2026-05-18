import { IMenuBuilder, MenuBuilderInput } from './IMenuBuilder';
import { NicheCategory } from '../NicheClassifier';

const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export class DefaultMenuBuilder implements IMenuBuilder {
  supports(category: NicheCategory): boolean {
    return category === 'DEFAULT';
  }

  build(input: MenuBuilderInput): string {
    const { conditions } = input;
    const options: string[] = [];

    if (conditions.hasServices) {
      options.push('Conhecer nossos serviços');
    }
    if (conditions.hasSchedulingCategories) {
      options.push('Agendar atendimento');
    }
    if (conditions.hasCommerceCatalog) {
      options.push('Fazer um pedido');
    }
    if (conditions.hasOperatingHours) {
      options.push('Horários');
    }
    if (conditions.hasPromotions) {
      options.push('Promoções');
    }

    options.push('Falar com atendente');

    return this.formatMenu(options);
  }

  private formatMenu(options: string[]): string {
    return options
      .map((option, index) => `${EMOJI_NUMBERS[index]} ${option}`)
      .join('\n');
  }
}
