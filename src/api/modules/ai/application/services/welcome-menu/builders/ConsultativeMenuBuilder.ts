import { IMenuBuilder, MenuBuilderInput } from './IMenuBuilder';
import { NicheCategory } from '../NicheClassifier';

const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export class ConsultativeMenuBuilder implements IMenuBuilder {
  supports(category: NicheCategory): boolean {
    return category === 'HOME_SERV';
  }

  build(input: MenuBuilderInput): string {
    const { conditions } = input;
    const options: string[] = [];

    options.push('Nossos serviços — áreas de atuação');
    options.push(
      'Solicitar orçamento — descreva sua necessidade para receber proposta',
    );
    options.push(
      'Acompanhar proposta — ver status de proposta/orçamento enviado',
    );

    if (conditions.hasSchedulingCategories) {
      options.push('Agendar reunião ou visita');
    }
    if (conditions.hasOperatingHours) {
      options.push('Horários de atendimento');
    }
    if (conditions.hasCatalogFiles) {
      options.push('Documentos e materiais — portfólio, tabela, contratos');
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
