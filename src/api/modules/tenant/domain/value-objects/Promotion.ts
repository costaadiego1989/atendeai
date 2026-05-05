import { randomUUID } from 'crypto';
import { ValueObject } from '../../../../shared/domain/ValueObject.js';

interface PromotionProps {
  id: string;
  title: string;
  description: string;
  value: string;
  imageUrl?: string;
  expiresAt?: string;
  assignedUserId?: string;
  assignedUserName?: string;
}

type CreatePromotionProps = Omit<PromotionProps, 'id'> & { id?: string };

export class Promotion extends ValueObject<PromotionProps> {
  private constructor(props: PromotionProps) {
    super(props);
  }

  get id(): string {
    return this.props.id;
  }

  get title(): string {
    return this.props.title;
  }
  get description(): string {
    return this.props.description;
  }
  get value(): string {
    return this.props.value;
  }
  get imageUrl(): string | undefined {
    return this.props.imageUrl;
  }
  get expiresAt(): string | undefined {
    return this.props.expiresAt;
  }
  get assignedUserId(): string | undefined {
    return this.props.assignedUserId;
  }
  get assignedUserName(): string | undefined {
    return this.props.assignedUserName;
  }

  public static create(props: CreatePromotionProps): Promotion {
    if (!props.title || props.title.length < 3) {
      throw new Error('Promotion title must be at least 3 characters long');
    }
    if (!props.description || props.description.length < 10) {
      throw new Error(
        'Promotion description must be at least 10 characters long',
      );
    }
    if (props.expiresAt && Number.isNaN(Date.parse(props.expiresAt))) {
      throw new Error('Promotion expiresAt must be a valid date');
    }
    return new Promotion({
      ...props,
      id: props.id ?? randomUUID(),
    });
  }
}
