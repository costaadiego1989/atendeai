import { BadRequestException } from '@nestjs/common';

export class DiscountExceedsTotalException extends BadRequestException {
  constructor(discount: number, gross: number) {
    super(`Discount (${discount}) cannot exceed subtotal + freight (${gross})`);
  }
}
