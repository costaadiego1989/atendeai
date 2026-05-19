import { IMenuBuilder, MenuBuilderInput } from './IMenuBuilder';
import { NicheCategory } from '../NicheClassifier';

const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export class B2BMenuBuilder implements IMenuBuilder {
  supports(category: NicheCategory): boolean {
    return category === 'B2B';
  }

  build(input: MenuBuilderInput): string {
    const { conditions } = input;
    const options: string[] = [];

    options.push('Nossas soluções — serviços e diferenciais');
    options.push(
      'Solicitar proposta comercial — personalizada para sua empresa',
    );
    options.push('Acompanhar proposta — status de negociação em andamento');

    if (conditions.hasCatalogFiles) {
      options.push('Cases e resultados');
    }
    if (conditions.hasSchedulingCategories) {
      options.push('Agendar reunião');
    }

    options.push('Falar com consultor');

    return this.formatMenu(options);
  }

  private formatMenu(options: string[]): string {
    return options
      .map((option, index) => `${EMOJI_NUMBERS[index]} ${option}`)
      .join('\n');
  }
}
