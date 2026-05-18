import { IMenuBuilder, MenuBuilderInput } from './IMenuBuilder';
import { NicheCategory } from '../NicheClassifier';

const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export class RecoveryMenuBuilder implements IMenuBuilder {
  supports(category: NicheCategory): boolean {
    return category === 'RECOVERY';
  }

  build(_input: MenuBuilderInput): string {
    const options: string[] = [
      'Consultar pendências — ver valores em aberto',
      'Segunda via de boleto — gerar novo link de pagamento',
      'Negociar pagamento — parcelamento ou acordo',
      'Informar pagamento realizado — confirmar que já pagou',
      'Agendar data de pagamento — registrar promessa',
      'Falar com atendente',
    ];

    return this.formatMenu(options);
  }

  private formatMenu(options: string[]): string {
    return options
      .map((option, index) => `${EMOJI_NUMBERS[index]} ${option}`)
      .join('\n');
  }
}
