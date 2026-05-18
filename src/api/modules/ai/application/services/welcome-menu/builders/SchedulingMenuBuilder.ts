import { IMenuBuilder, MenuBuilderInput } from './IMenuBuilder';
import { NicheCategory } from '../NicheClassifier';

const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

const RECURRING_BUSINESS_TYPES = ['GYM', 'STUDIO', 'PERSONAL'];

export class SchedulingMenuBuilder implements IMenuBuilder {
  private static readonly SUPPORTED: NicheCategory[] = ['HEALTH', 'BEAUTY'];

  supports(category: NicheCategory): boolean {
    return SchedulingMenuBuilder.SUPPORTED.includes(category);
  }

  build(input: MenuBuilderInput): string {
    switch (input.category) {
      case 'HEALTH':
        return this.buildHealthMenu(input);
      case 'BEAUTY':
        return this.buildBeautyMenu(input);
      default:
        return this.buildHealthMenu(input);
    }
  }

  private buildHealthMenu(input: MenuBuilderInput): string {
    const { conditions } = input;
    const options: string[] = [];

    options.push('Agendar consulta — ver horários disponíveis e marcar');
    options.push('Remarcar ou cancelar — alterar agendamento existente');
    options.push('Especialidades e serviços');

    if (conditions.hasSchedulingCategories) {
      options.push('Valores e formas de pagamento');
    }
    if (conditions.hasCatalogFiles) {
      options.push('Informações sobre procedimentos');
    }
    if (conditions.hasOperatingHours) {
      options.push('Horários de atendimento');
    }

    options.push('Falar com atendente');

    return this.formatMenu(options);
  }

  private buildBeautyMenu(input: MenuBuilderInput): string {
    const { conditions, businessType } = input;
    const options: string[] = [];

    options.push('Agendar horário — ver disponibilidade e reservar');
    options.push('Remarcar ou cancelar');
    options.push('Serviços e preços');
    options.push('Nossos profissionais — quem atende e especialidades');

    if (this.isRecurringBusiness(businessType)) {
      options.push('Pacotes e planos');
    }
    if (conditions.hasPromotions) {
      options.push('Promoções');
    }
    if (conditions.hasOperatingHours) {
      options.push('Horários de funcionamento');
    }

    options.push('Falar com atendente');

    return this.formatMenu(options);
  }

  private isRecurringBusiness(businessType?: string | null): boolean {
    if (!businessType) return false;
    return RECURRING_BUSINESS_TYPES.includes(businessType.toUpperCase());
  }

  private formatMenu(options: string[]): string {
    return options
      .map((option, index) => `${EMOJI_NUMBERS[index]} ${option}`)
      .join('\n');
  }
}
