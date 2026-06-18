import { ConflictException } from '@nestjs/common';

export class InsufficientStockException extends ConflictException {
  constructor(inventoryItemId: string) {
    super(`Insufficient stock for item ${inventoryItemId}`);
  }
}
