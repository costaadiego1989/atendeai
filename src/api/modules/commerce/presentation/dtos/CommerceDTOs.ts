import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import type { CommerceDeliveryWeekday } from '../../domain/ports/ICommerceRepository';

class ConfigureCommerceDeliveryScheduleDTO {
  @IsString()
  @IsIn([
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ])
  weekday: CommerceDeliveryWeekday;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;
}

export class ConfigureCommerceShippingPolicyDTO {
  @IsString()
  @IsIn(['FIXED', 'PER_KM'])
  mode: 'FIXED' | 'PER_KM';

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxRadiusKm?: number;

  @IsOptional()
  servicedNeighborhoods?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigureCommerceDeliveryScheduleDTO)
  deliverySchedule?: ConfigureCommerceDeliveryScheduleDTO[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class StartShoppingSessionDTO {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsOptional()
  @IsString()
  contactId?: string;
}

export class AddShoppingSessionItemDTO {
  @IsOptional()
  @IsString()
  catalogItemId?: string;

  @IsOptional()
  @IsString()
  inventoryItemId?: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class UpdateShoppingSessionFulfillmentDTO {
  @IsString()
  @IsIn(['PICKUP', 'DELIVERY'])
  fulfillmentType: 'PICKUP' | 'DELIVERY';

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckoutShoppingSessionDTO {
  @IsOptional()
  @IsString()
  @IsIn(['PIX', 'UNDEFINED', 'BOLETO', 'CREDIT_CARD'])
  billingType?: 'PIX' | 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD';

  @IsOptional()
  @IsString()
  paymentLinkName?: string;

  @IsOptional()
  @IsString()
  paymentLinkDescription?: string;
}

export class UpdateCommerceOrderStatusDTO {
  @IsString()
  @IsIn([
    'AWAITING_PAYMENT',
    'PAID',
    'PREPARING',
    'READY_FOR_PICKUP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ])
  status:
    | 'AWAITING_PAYMENT'
    | 'PAID'
    | 'PREPARING'
    | 'READY_FOR_PICKUP'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED';

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userName?: string;
}

export class UpdateCommerceAbandonmentStateDTO {
  @IsBoolean()
  paused: boolean;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userName?: string;
}

export class TriggerCommerceAbandonmentTouchDTO {
  @IsOptional()
  @IsString()
  interval?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userName?: string;
}

export class UpdateCommerceAbandonmentConfigDTO {
  @IsBoolean()
  active: boolean;

  @IsOptional()
  @IsString()
  message?: string;

  @IsBoolean()
  useAiMessage: boolean;

  @IsString()
  @IsIn(['SINGLE', 'QUEUE'])
  mode: 'SINGLE' | 'QUEUE';

  @IsNumber()
  @Min(1)
  maxTouches: number;

  @IsNumber()
  @Min(30)
  intervalMinutes: number;
}

export class SetOrderTrackingCodeDTO {
  @IsString()
  @IsNotEmpty()
  trackingCode: string;

  @IsOptional()
  @IsString()
  trackingUrl?: string;
}

export class ApplyCouponDTO {
  @IsString()
  @IsNotEmpty()
  code: string;
}
