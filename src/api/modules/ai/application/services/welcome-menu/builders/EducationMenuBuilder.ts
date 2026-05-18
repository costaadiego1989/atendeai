import { IMenuBuilder, MenuBuilderInput } from './IMenuBuilder';
import { NicheCategory } from '../NicheClassifier';

const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export class EducationMenuBuilder implements IMenuBuilder {
  supports(category: NicheCategory): boolean {
    return category === 'EDUCATION';
  }

  build(input: MenuBuilderInput): string {
    const { conditions } = input;
    const options: string[] = [];

    options.push('Cursos disponíveis — ver opções, turmas e valores');

    if (conditions.hasSchedulingCategories) {
      options.push('Agendar aula experimental');
    }

    options.push('Matrícula e pacotes — informações sobre inscrição');

    if (conditions.hasOperatingHours) {
      options.push('Horários das turmas');
    }
    if (conditions.hasCatalogFiles) {
      options.push('Material didático');
    }
    if (conditions.hasPromotions) {
      options.push('Promoções e bolsas');
    }

    options.push('Acompanhar matrícula — status da inscrição');
    options.push('Falar com atendente');

    return this.formatMenu(options);
  }

  private formatMenu(options: string[]): string {
    return options
      .map((option, index) => `${EMOJI_NUMBERS[index]} ${option}`)
      .join('\n');
  }
}
