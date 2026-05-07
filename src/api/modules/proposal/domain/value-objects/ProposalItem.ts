import { ValueObject } from '@shared/domain/ValueObject';
import { ProposalItemNameRequiredError } from '../errors/ProposalItemNameRequiredError';
import { ProposalItemQuantityInvalidError } from '../errors/ProposalItemQuantityInvalidError';
import { ProposalItemUnitPriceInvalidError } from '../errors/ProposalItemUnitPriceInvalidError';

export interface ProposalItemProps {
  name: string;
  quantity: number;
  unitPrice: number;
  description?: string;
}

export class ProposalItem extends ValueObject<ProposalItemProps> {
  private constructor(props: ProposalItemProps) {
    super(props);
  }

  public static create(props: ProposalItemProps): ProposalItem {
    if (!props.name || props.name.trim().length === 0) {
      throw new ProposalItemNameRequiredError();
    }
    if (props.quantity <= 0) {
      throw new ProposalItemQuantityInvalidError();
    }
    if (props.unitPrice < 0) {
      throw new ProposalItemUnitPriceInvalidError();
    }

    return new ProposalItem({
      ...props,
      name: props.name.trim(),
    });
  }

  get name(): string { return this.props.name; }
  get quantity(): number { return this.props.quantity; }
  get unitPrice(): number { return this.props.unitPrice; }
  get description(): string | undefined { return this.props.description; }
  get subtotal(): number { return this.props.unitPrice * this.props.quantity; }
}
