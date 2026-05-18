import {
  Body,
  Controller,
  Get,
  Param,
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
import { ListCommerceOrdersUseCase } from '../../application/use-cases/ListCommerceOrdersUseCase';
import { GetCommerceOrderDetailsUseCase } from '../../application/use-cases/GetCommerceOrderDetailsUseCase';
import { UpdateCommerceOrderStatusUseCase } from '../../application/use-cases/UpdateCommerceOrderStatusUseCase';
import { SetOrderTrackingCodeUseCase } from '../../application/use-cases/SetOrderTrackingCodeUseCase';
import { CommerceOrdersReportCsvBuilder } from '../../application/services/CommerceOrdersReportCsvBuilder';
import {
  UpdateCommerceOrderStatusDTO,
  SetOrderTrackingCodeDTO,
} from '../dtos/CommerceDTOs';

@Controller('tenants/:tenantId/commerce')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
export class CommerceOrdersController {
  constructor(
    private readonly listCommerceOrdersUseCase: ListCommerceOrdersUseCase,
    private readonly getCommerceOrderDetailsUseCase: GetCommerceOrderDetailsUseCase,
    private readonly updateCommerceOrderStatusUseCase: UpdateCommerceOrderStatusUseCase,
    private readonly setOrderTrackingCodeUseCase: SetOrderTrackingCodeUseCase,
    private readonly commerceOrdersReportCsvBuilder: CommerceOrdersReportCsvBuilder,
  ) {}

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

  @Put('orders/:orderId/tracking')
  @Roles('OWNER', 'ADMIN')
  async setTrackingCode(
    @Param('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
    @Body() body: SetOrderTrackingCodeDTO,
  ) {
    return this.setOrderTrackingCodeUseCase.execute({
      tenantId,
      orderId,
      trackingCode: body.trackingCode,
      trackingUrl: body.trackingUrl,
    });
  }

  @Get('orders/:orderId/tracking')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async getTrackingInfo(
    @Param('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    const result = await this.getCommerceOrderDetailsUseCase.execute(
      tenantId,
      orderId,
    );
    return {
      orderId: result.order.id,
      status: result.order.status,
      trackingCode: result.order.trackingCode,
      trackingUrl: result.order.trackingUrl,
      trackingNotifiedAt: result.order.trackingNotifiedAt,
    };
  }

  private parseOptionalDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
}
