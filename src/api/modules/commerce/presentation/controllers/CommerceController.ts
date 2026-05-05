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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { ConfigureShippingPolicyUseCase } from '../../application/use-cases/ConfigureShippingPolicyUseCase';
import { GetShippingPolicyUseCase } from '../../application/use-cases/GetShippingPolicyUseCase';
import { SearchCommerceCatalogUseCase } from '../../application/use-cases/SearchCommerceCatalogUseCase';
import { StartShoppingSessionUseCase } from '../../application/use-cases/StartShoppingSessionUseCase';
import { GetShoppingSessionUseCase } from '../../application/use-cases/GetShoppingSessionUseCase';
import { AddItemToShoppingSessionUseCase } from '../../application/use-cases/AddItemToShoppingSessionUseCase';
import { ApplyCouponToShoppingSessionUseCase } from '../../application/use-cases/ApplyCouponToShoppingSessionUseCase';
import { UpdateShoppingSessionFulfillmentUseCase } from '../../application/use-cases/UpdateShoppingSessionFulfillmentUseCase';
import { CheckoutShoppingSessionUseCase } from '../../application/use-cases/CheckoutShoppingSessionUseCase';
import { ListCommerceOrdersUseCase } from '../../application/use-cases/ListCommerceOrdersUseCase';
import { GetCommerceOrderDetailsUseCase } from '../../application/use-cases/GetCommerceOrderDetailsUseCase';
import { UpdateCommerceOrderStatusUseCase } from '../../application/use-cases/UpdateCommerceOrderStatusUseCase';
import { UpdateCommerceAbandonmentStateUseCase } from '../../application/use-cases/UpdateCommerceAbandonmentStateUseCase';
import { TriggerCommerceAbandonmentTouchUseCase } from '../../application/use-cases/TriggerCommerceAbandonmentTouchUseCase';
import { GetAbandonmentConfigUseCase } from '../../application/use-cases/GetAbandonmentConfigUseCase';
import { UpdateAbandonmentConfigUseCase } from '../../application/use-cases/UpdateAbandonmentConfigUseCase';
import { GenerateAbandonmentMessageUseCase } from '../../application/use-cases/GenerateAbandonmentMessageUseCase';
import { CommerceOrdersReportCsvBuilder } from '../../application/services/CommerceOrdersReportCsvBuilder';
import {
  AddShoppingSessionItemDTO,
   ApplyCouponDTO,
   CheckoutShoppingSessionDTO,
   ConfigureCommerceShippingPolicyDTO,
   StartShoppingSessionDTO,
   TriggerCommerceAbandonmentTouchDTO,
   UpdateCommerceAbandonmentStateDTO,
   UpdateCommerceAbandonmentConfigDTO,
   UpdateCommerceOrderStatusDTO,
   UpdateShoppingSessionFulfillmentDTO,
 } from '../dtos/CommerceDTOs';

@Controller('tenants/:tenantId/commerce')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
export class CommerceController {
  constructor(
    private readonly configureShippingPolicyUseCase: ConfigureShippingPolicyUseCase,
    private readonly getShippingPolicyUseCase: GetShippingPolicyUseCase,
    private readonly searchCommerceCatalogUseCase: SearchCommerceCatalogUseCase,
    private readonly startShoppingSessionUseCase: StartShoppingSessionUseCase,
    private readonly getShoppingSessionUseCase: GetShoppingSessionUseCase,
    private readonly addItemToShoppingSessionUseCase: AddItemToShoppingSessionUseCase,
    private readonly applyCouponToShoppingSessionUseCase: ApplyCouponToShoppingSessionUseCase,
    private readonly updateShoppingSessionFulfillmentUseCase: UpdateShoppingSessionFulfillmentUseCase,
    private readonly checkoutShoppingSessionUseCase: CheckoutShoppingSessionUseCase,
    private readonly listCommerceOrdersUseCase: ListCommerceOrdersUseCase,
    private readonly getCommerceOrderDetailsUseCase: GetCommerceOrderDetailsUseCase,
    private readonly updateCommerceOrderStatusUseCase: UpdateCommerceOrderStatusUseCase,
    private readonly updateCommerceAbandonmentStateUseCase: UpdateCommerceAbandonmentStateUseCase,
    private readonly triggerCommerceAbandonmentTouchUseCase: TriggerCommerceAbandonmentTouchUseCase,
    private readonly getAbandonmentConfigUseCase: GetAbandonmentConfigUseCase,
    private readonly updateAbandonmentConfigUseCase: UpdateAbandonmentConfigUseCase,
    private readonly generateAbandonmentMessageUseCase: GenerateAbandonmentMessageUseCase,
    private readonly commerceOrdersReportCsvBuilder: CommerceOrdersReportCsvBuilder,
  ) {}

  @Get('shipping-policy')
  @Roles('OWNER', 'ADMIN')
  async getShippingPolicy(@Param('tenantId') tenantId: string) {
    return this.getShippingPolicyUseCase.execute(tenantId);
  }

  @Put('shipping-policy')
  @Roles('OWNER', 'ADMIN')
  async configureShippingPolicy(
    @Param('tenantId') tenantId: string,
    @Body() body: ConfigureCommerceShippingPolicyDTO,
  ) {
    return this.configureShippingPolicyUseCase.execute({
      tenantId,
      mode: body.mode,
      fixedAmount: body.fixedAmount,
      pricePerKm: body.pricePerKm,
      minimumAmount: body.minimumAmount,
      maxRadiusKm: body.maxRadiusKm,
      servicedNeighborhoods: body.servicedNeighborhoods,
      deliverySchedule: body.deliverySchedule?.map((slot) => ({
        weekday: slot.weekday,
        enabled: slot.enabled,
        startTime: slot.startTime ?? null,
        endTime: slot.endTime ?? null,
      })),
      notes: body.notes,
      active: true,
    });
  }

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

  @Get('orders')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async listOrders(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.listCommerceOrdersUseCase.execute({
      tenantId,
      branchId: branchId || undefined,
      status: status || undefined,
      paymentStatus: paymentStatus || undefined,
      dateFrom: this.parseOptionalDate(dateFrom),
      dateTo: this.parseOptionalDate(dateTo),
    });
  }

  @Get('orders/report.csv')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async downloadOrdersReport(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('paymentStatus') paymentStatus: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @Res() res: Response,
  ) {
    const parsedDateFrom = this.parseOptionalDate(dateFrom);
    const parsedDateTo = this.parseOptionalDate(dateTo);
    const orders = await this.listCommerceOrdersUseCase.execute({
      tenantId,
      branchId: branchId || undefined,
      status: status || undefined,
      paymentStatus: paymentStatus || undefined,
      dateFrom: parsedDateFrom,
      dateTo: parsedDateTo,
    });

    const csv = this.commerceOrdersReportCsvBuilder.build(orders, {
      dateFrom: parsedDateFrom,
      dateTo: parsedDateTo,
    });
    const fileStamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="checkout-${fileStamp}.csv"`,
    );
    return res.send(csv);
  }

  @Get('orders/:orderId')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async getOrderDetails(
    @Param('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.getCommerceOrderDetailsUseCase.execute(tenantId, orderId);
  }

  @Put('orders/:orderId/status')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async updateOrderStatus(
    @Param('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
    @Body() body: UpdateCommerceOrderStatusDTO,
  ) {
    return this.updateCommerceOrderStatusUseCase.execute({
      tenantId,
      orderId,
      status: body.status,
      userId: body.userId,
      userName: body.userName,
    });
  }

  @Put('orders/:orderId/abandonment')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async updateAbandonmentState(
    @Param('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
    @Body() body: UpdateCommerceAbandonmentStateDTO,
  ) {
    return this.updateCommerceAbandonmentStateUseCase.execute({
      tenantId,
      orderId,
      paused: body.paused,
      userId: body.userId,
      userName: body.userName,
    });
  }

  @Post('orders/:orderId/abandonment-touch')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async triggerAbandonmentTouch(
    @Param('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
    @Body() body: TriggerCommerceAbandonmentTouchDTO,
  ) {
    return this.triggerCommerceAbandonmentTouchUseCase.execute({
      tenantId,
      orderId,
      interval: body.interval,
      userId: body.userId,
      userName: body.userName,
    });
  }

  @Get('abandonment-config')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async getAbandonmentConfig(@Param('tenantId') tenantId: string) {
    return this.getAbandonmentConfigUseCase.execute(tenantId);
  }

  @Put('abandonment-config')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async updateAbandonmentConfig(
    @Param('tenantId') tenantId: string,
    @Body() body: UpdateCommerceAbandonmentConfigDTO,
  ) {
    return this.updateAbandonmentConfigUseCase.execute(tenantId, body);
  }

  @Post('abandonment-config/generate-message')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async generateAbandonmentMessage(@Param('tenantId') tenantId: string) {
    return this.generateAbandonmentMessageUseCase.execute(tenantId);
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

  private parseOptionalDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
}
