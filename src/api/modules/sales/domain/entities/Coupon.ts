import { Entity } from '../../../../shared/domain/Entity';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';

export type CouponDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type CouponTargetType = 'ITEM' | 'CATEGORY';

export interface CouponTarget {
  targetType: CouponTargetType;
  targetId: string;
}

interface CouponProps {
  tenantId: string;
  promotionId?: string | null;
  code: string;
  description?: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  maxUses: number; // 0 = unlimited
  usedCount: number;
  startsAt: Date;
  expiresAt?: Date | null;
  active: boolean;
  catalogItemId?: string | null;
  targets?: CouponTarget[];
  createdAt: Date;
  updatedAt: Date;
}

export class Coupon extends Entity<CouponProps> {
  private constructor(props: CouponProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get tenantId(): string { return this.props.tenantId; }
  get promotionId(): string | null | undefined { return this.props.promotionId; }
  get code(): string { return this.props.code; }
  get description(): string | null | undefined { return this.props.description; }
  get discountType(): CouponDiscountType { return this.props.discountType; }
  get discountValue(): number { return this.props.discountValue; }
  get maxUses(): number { return this.props.maxUses; }
  get usedCount(): number { return this.props.usedCount; }
  get startsAt(): Date { return this.props.startsAt; }
  get expiresAt(): Date | null | undefined { return this.props.expiresAt; }
  get active(): boolean { return this.props.active; }
  get catalogItemId(): string | null | undefined { return this.props.catalogItemId; }
  get targets(): CouponTarget[] { return this.props.targets ?? []; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  get isUnlimited(): boolean {
    return this.props.maxUses === 0;
  }

  public canRedeem(): boolean {
    if (!this.props.active) return false;
    const now = new Date();
    if (now < this.props.startsAt) return false;
    if (this.props.expiresAt && now > this.props.expiresAt) return false;
    if (!this.isUnlimited && this.props.usedCount >= this.props.maxUses) return false;
    return true;
  }

  public appliesTo(target: CouponTarget): boolean {
    const targets = this.effectiveTargets();
    if (targets.length === 0) return true;
    return targets.some((candidate) =>
      candidate.targetType === target.targetType && candidate.targetId === target.targetId,
    );
  }

  public redeem(): void {
    if (!this.canRedeem()) {
      throw new Error('Coupon cannot be redeemed');
    }
    this.props.usedCount++;
    this.props.updatedAt = new Date();
  }

  public deactivate(): void {
    this.props.active = false;
    this.props.updatedAt = new Date();
  }

  private effectiveTargets(): CouponTarget[] {
    if (this.targets.length > 0) return this.targets;
    if (!this.props.catalogItemId) return [];
    return [{ targetType: 'ITEM', targetId: this.props.catalogItemId }];
  }

  public static create(
    props: Omit<CouponProps, 'createdAt' | 'updatedAt' | 'usedCount' | 'active'> & { active?: boolean },
    id?: UniqueEntityID,
  ): Coupon {
    return new Coupon(
      {
        ...props,
        usedCount: 0,
        active: props.active ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      id,
    );
  }

  public static reconstitute(props: CouponProps, id: UniqueEntityID): Coupon {
    return new Coupon(props, id);
  }
}
