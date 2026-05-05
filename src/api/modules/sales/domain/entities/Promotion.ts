import { Entity } from '../../../../shared/domain/Entity';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';

export type PromotionDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type PromotionTargetType = 'ITEM' | 'CATEGORY';

export interface PromotionTarget {
  targetType: PromotionTargetType;
  targetId: string;
}

interface PromotionProps {
  tenantId: string;
  title: string;
  description: string;
  discountType: PromotionDiscountType;
  discountValue: number;
  minimumOrder?: number | null;
  imageUrl?: string | null;
  startsAt: Date;
  expiresAt?: Date | null;
  active: boolean;
  catalogItemId?: string | null;
  targets?: PromotionTarget[];
  createdAt: Date;
  updatedAt: Date;
}

export class Promotion extends Entity<PromotionProps> {
  private constructor(props: PromotionProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get tenantId(): string { return this.props.tenantId; }
  get title(): string { return this.props.title; }
  get description(): string { return this.props.description; }
  get discountType(): PromotionDiscountType { return this.props.discountType; }
  get discountValue(): number { return this.props.discountValue; }
  get minimumOrder(): number | null | undefined { return this.props.minimumOrder; }
  get imageUrl(): string | null | undefined { return this.props.imageUrl; }
  get startsAt(): Date { return this.props.startsAt; }
  get expiresAt(): Date | null | undefined { return this.props.expiresAt; }
  get active(): boolean { return this.props.active; }
  get catalogItemId(): string | null | undefined { return this.props.catalogItemId; }
  get targets(): PromotionTarget[] { return this.props.targets ?? []; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public appliesTo(target: PromotionTarget): boolean {
    const targets = this.effectiveTargets();
    if (targets.length === 0) return true;
    return targets.some((candidate) =>
      candidate.targetType === target.targetType && candidate.targetId === target.targetId,
    );
  }

  public isCurrentlyActive(): boolean {
    if (!this.props.active) return false;
    const now = new Date();
    if (now < this.props.startsAt) return false;
    if (this.props.expiresAt && now > this.props.expiresAt) return false;
    return true;
  }

  public deactivate(): void {
    this.props.active = false;
    this.props.updatedAt = new Date();
  }

  private effectiveTargets(): PromotionTarget[] {
    if (this.targets.length > 0) return this.targets;
    if (!this.props.catalogItemId) return [];
    return [{ targetType: 'ITEM', targetId: this.props.catalogItemId }];
  }

  public static create(
    props: Omit<PromotionProps, 'createdAt' | 'updatedAt' | 'active'> & { active?: boolean },
    id?: UniqueEntityID,
  ): Promotion {
    return new Promotion(
      {
        ...props,
        active: props.active ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      id,
    );
  }

  public static reconstitute(props: PromotionProps, id: UniqueEntityID): Promotion {
    return new Promotion(props, id);
  }
}
