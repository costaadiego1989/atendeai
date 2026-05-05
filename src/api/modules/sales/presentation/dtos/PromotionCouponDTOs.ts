import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PromotionCouponTargetDTO {
  @IsIn(['ITEM', 'CATEGORY']) targetType: 'ITEM' | 'CATEGORY';
  @IsString() @IsNotEmpty() targetId: string;
}

export class CreatePromotionDTO {
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() description: string;
  @IsIn(['PERCENTAGE', 'FIXED_AMOUNT']) discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  @IsNumber() discountValue: number;
  @IsOptional() @IsNumber() minimumOrder?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsString() @IsNotEmpty() startsAt: string;
  @IsOptional() @IsString() expiresAt?: string;
  @IsOptional() @IsString() catalogItemId?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PromotionCouponTargetDTO) targets?: PromotionCouponTargetDTO[];
}

export class UpdatePromotionDTO {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(['PERCENTAGE', 'FIXED_AMOUNT']) discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  @IsOptional() @IsNumber() discountValue?: number;
  @IsOptional() @IsNumber() minimumOrder?: number | null;
  @IsOptional() @IsString() imageUrl?: string | null;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() expiresAt?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() catalogItemId?: string | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PromotionCouponTargetDTO) targets?: PromotionCouponTargetDTO[];
}

export class CreateCouponDTO {
  @IsString() @IsNotEmpty() code: string;
  @IsOptional() @IsString() description?: string;
  @IsIn(['PERCENTAGE', 'FIXED_AMOUNT']) discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  @IsNumber() discountValue: number;
  @IsNumber() maxUses: number; // 0 = unlimited
  @IsString() @IsNotEmpty() startsAt: string;
  @IsOptional() @IsString() expiresAt?: string;
  @IsOptional() @IsString() catalogItemId?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PromotionCouponTargetDTO) targets?: PromotionCouponTargetDTO[];
  @IsOptional() @IsString() promotionId?: string;
}

export class UpdateCouponDTO {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsIn(['PERCENTAGE', 'FIXED_AMOUNT']) discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  @IsOptional() @IsNumber() discountValue?: number;
  @IsOptional() @IsNumber() maxUses?: number;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() expiresAt?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() catalogItemId?: string | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PromotionCouponTargetDTO) targets?: PromotionCouponTargetDTO[];
  @IsOptional() @IsString() promotionId?: string | null;
}

export class RedeemCouponDTO {
  @IsOptional() @IsString() code?: string;
}
