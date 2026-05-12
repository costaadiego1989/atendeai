import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { SearchCommerceCatalogUseCase } from '../../application/use-cases/SearchCommerceCatalogUseCase';
import { StartShoppingSessionUseCase } from '../../application/use-cases/StartShoppingSessionUseCase';
import { GetShoppingSessionUseCase } from '../../application/use-cases/GetShoppingSessionUseCase';
import { AddItemToShoppingSessionUseCase } from '../../application/use-cases/AddItemToShoppingSessionUseCase';
import { ApplyCouponToShoppingSessionUseCase } from '../../application/use-cases/ApplyCouponToShoppingSessionUseCase';
import { UpdateShoppingSessionFulfillmentUseCase } from '../../application/use-cases/UpdateShoppingSessionFulfillmentUseCase';
import { CheckoutShoppingSessionUseCase } from '../../application/use-cases/CheckoutShoppingSessionUseCase';
import {
  AddShoppingSessionItemDTO,
  ApplyCouponDTO,
  CheckoutShoppingSessionDTO,
  StartShoppingSessionDTO,
  UpdateShoppingSessionFulfillmentDTO,
} from '../dtos/CommerceDTOs';

@Controller('tenants/:tenantId/commerce')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
export class CommerceController {
  constructor(
    private readonly searchCommerceCatalogUseCase: SearchCommerceCatalogUseCase,
    private readonly startShoppingSessionUseCase: StartShoppingSessionUseCase,
    private readonly getShoppingSessionUseCase: GetShoppingSessionUseCase,
    private readonly addItemToShoppingSessionUseCase: AddItemToShoppingSessionUseCase,
    private readonly applyCouponToShoppingSessionUseCase: ApplyCouponToShoppingSessionUseCase,
    private readonly updateShoppingSessionFulfillmentUseCase: UpdateShoppingSessionFulfillmentUseCase,
    private readonly checkoutShoppingSessionUseCase: CheckoutShoppingSessionUseCase,
  ) {}

  @Get('catalog-search')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async searchCatalog(
    @Param('tenantId') tenantId: string,
    @Query('query') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchCommerceCatalogUseCase.execute({
      tenantId,
      query,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('sessions')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  @HttpCode(HttpStatus.CREATED)
  async startSession(
    @Param('tenantId') tenantId: string,
    @Body() body: StartShoppingSessionDTO,
  ) {
    return this.startShoppingSessionUseCase.execute({
      tenantId,
      conversationId: body.conversationId,
      contactId: body.contactId,
    });
  }

  @Get('sessions/:sessionId')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async getSession(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.getShoppingSessionUseCase.execute(tenantId, sessionId);
  }

  @Post('sessions/:sessionId/items')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async addItem(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: AddShoppingSessionItemDTO,
  ) {
    return this.addItemToShoppingSessionUseCase.execute({
      tenantId,
      sessionId,
      catalogItemId: body.catalogItemId,
      inventoryItemId: body.inventoryItemId,
      quantity: body.quantity,
    });
  }

  @Put('sessions/:sessionId/fulfillment')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async updateFulfillment(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: UpdateShoppingSessionFulfillmentDTO,
  ) {
    return this.updateShoppingSessionFulfillmentUseCase.execute({
      tenantId,
      sessionId,
      fulfillmentType: body.fulfillmentType,
      distanceKm: body.distanceKm,
      deliveryAddress: body.deliveryAddress,
      notes: body.notes,
    });
  }

  @Post('sessions/:sessionId/coupon')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async applyCoupon(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: ApplyCouponDTO,
  ) {
    return this.applyCouponToShoppingSessionUseCase.execute({
      tenantId,
      sessionId,
      code: body.code,
    });
  }

  @Post('sessions/:sessionId/checkout')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async checkout(
    @Param('tenantId') tenantId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: CheckoutShoppingSessionDTO,
  ) {
    return this.checkoutShoppingSessionUseCase.execute({
      tenantId,
      sessionId,
      billingType: body.billingType,
      paymentLinkName: body.paymentLinkName,
      paymentLinkDescription: body.paymentLinkDescription,
    });
  }
}
