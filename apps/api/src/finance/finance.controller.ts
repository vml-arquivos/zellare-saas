import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleLevel } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  CreateEmployeeDto,
  CreateFinancialPeriodDto,
  CreateGoodsReceiptDto,
  CreatePayableDto,
  CreatePayrollDto,
  CreatePurchaseQuoteDto,
  CreateStockItemDto,
  CreateStockMovementDto,
  CreateTimeAdjustmentDto,
  CreateTimeEntryDto,
  DecideTimeAdjustmentDto,
  GoodsReceiptItemDto,
  ListFinanceQueryDto,
  ListPayableQueryDto,
  ListPayrollQueryDto,
  ListPurchaseQueryDto,
  ListStockQueryDto,
  UpdateFinancialPeriodStatusDto,
  UpdatePayableStatusDto,
  UpdatePayrollStatusDto,
} from './dto/finance.dto';
import { FinanceService } from './finance.service';

const FINANCE_READ_ROLES = [
  RoleLevel.PROFESSOR,
  RoleLevel.UNIDADE,
  RoleLevel.STAFF_CENTRAL,
  RoleLevel.MANTENEDORA,
  RoleLevel.DEVELOPER,
];

const FINANCE_MANAGE_ROLES = [
  RoleLevel.UNIDADE,
  RoleLevel.STAFF_CENTRAL,
  RoleLevel.MANTENEDORA,
  RoleLevel.DEVELOPER,
];

const FINANCE_EMPLOYEE_ROLES = [
  RoleLevel.UNIDADE,
  RoleLevel.STAFF_CENTRAL,
  RoleLevel.MANTENEDORA,
  RoleLevel.DEVELOPER,
];

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('periods')
  @RequireRoles(...FINANCE_READ_ROLES)
  listPeriods(@CurrentUser() user: JwtPayload) {
    return this.service.listPeriods(user);
  }

  @Post('periods')
  @RequireRoles(RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createPeriod(@Body() dto: CreateFinancialPeriodDto, @CurrentUser() user: JwtPayload) {
    return this.service.createPeriod(dto, user);
  }

  @Patch('periods/:id/status')
  @RequireRoles(RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  updatePeriodStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialPeriodStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updatePeriodStatus(id, dto, user);
  }

  @Get('employees')
  @RequireRoles(...FINANCE_EMPLOYEE_ROLES)
  listEmployees(@Query() query: ListFinanceQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.listEmployees(user, query);
  }

  @Post('employees')
  @RequireRoles(...FINANCE_MANAGE_ROLES)
  createEmployee(@Body() dto: CreateEmployeeDto, @CurrentUser() user: JwtPayload) {
    return this.service.createEmployee(dto, user);
  }

  @Get('time-entries')
  @RequireRoles(...FINANCE_READ_ROLES)
  listTimeEntries(@Query() query: ListFinanceQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.listTimeEntries(user, query);
  }

  @Post('time-entries')
  @RequireRoles(...FINANCE_READ_ROLES)
  createTimeEntry(@Body() dto: CreateTimeEntryDto, @CurrentUser() user: JwtPayload) {
    return this.service.createTimeEntry(dto, user);
  }

  @Patch('time-entries/:id/submit')
  @RequireRoles(...FINANCE_READ_ROLES)
  submitTimeEntry(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.submitTimeEntry(id, user);
  }

  @Post('time-adjustments')
  @RequireRoles(...FINANCE_READ_ROLES)
  createTimeAdjustment(@Body() dto: CreateTimeAdjustmentDto, @CurrentUser() user: JwtPayload) {
    return this.service.createTimeAdjustment(dto, user);
  }

  @Patch('time-adjustments/:id/decision')
  @RequireRoles(...FINANCE_MANAGE_ROLES)
  decideTimeAdjustment(
    @Param('id') id: string,
    @Body() dto: DecideTimeAdjustmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.decideTimeAdjustment(id, dto, user);
  }

  @Get('payrolls')
  @RequireRoles(...FINANCE_READ_ROLES)
  listPayrolls(@Query() query: ListPayrollQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.listPayrolls(user, query);
  }

  @Post('payrolls')
  @RequireRoles(...FINANCE_MANAGE_ROLES)
  calculatePayroll(@Body() dto: CreatePayrollDto, @CurrentUser() user: JwtPayload) {
    return this.service.calculatePayroll(dto, user);
  }

  @Patch('payrolls/:id/status')
  @RequireRoles(...FINANCE_MANAGE_ROLES)
  updatePayrollStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updatePayrollStatus(id, dto, user);
  }

  @Get('payables')
  @RequireRoles(...FINANCE_READ_ROLES)
  listPayables(@Query() query: ListPayableQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.listPayables(user, query);
  }

  @Post('payables')
  @RequireRoles(...FINANCE_MANAGE_ROLES)
  createPayable(@Body() dto: CreatePayableDto, @CurrentUser() user: JwtPayload) {
    return this.service.createPayable(dto, user);
  }

  @Patch('payables/:id/status')
  @RequireRoles(...FINANCE_MANAGE_ROLES)
  updatePayableStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePayableStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updatePayableStatus(id, dto, user);
  }

  @Get('stock-items')
  @RequireRoles(...FINANCE_READ_ROLES)
  listStockItems(@Query() query: ListStockQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.listStockItems(user, query);
  }

  @Post('stock-items')
  @RequireRoles(...FINANCE_MANAGE_ROLES)
  createStockItem(@Body() dto: CreateStockItemDto, @CurrentUser() user: JwtPayload) {
    return this.service.createStockItem(dto, user);
  }

  @Get('stock-movements')
  @RequireRoles(...FINANCE_READ_ROLES)
  listStockMovements(@Query() query: ListStockQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.listStockMovements(user, query);
  }

  @Post('stock-movements')
  @RequireRoles(...FINANCE_MANAGE_ROLES)
  createStockMovement(@Body() dto: CreateStockMovementDto, @CurrentUser() user: JwtPayload) {
    return this.service.createStockMovement(dto, user);
  }

  @Get('purchase-quotes')
  @RequireRoles(...FINANCE_READ_ROLES)
  listPurchaseQuotes(@Query() query: ListPurchaseQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.listPurchaseQuotes(user, query);
  }

  @Post('purchase-quotes')
  @RequireRoles(...FINANCE_MANAGE_ROLES)
  createPurchaseQuote(@Body() dto: CreatePurchaseQuoteDto, @CurrentUser() user: JwtPayload) {
    return this.service.createPurchaseQuote(dto, user);
  }

  @Get('goods-receipts')
  @RequireRoles(...FINANCE_READ_ROLES)
  listGoodsReceipts(@Query() query: ListStockQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.listGoodsReceipts(user, query);
  }

  @Post('goods-receipts')
  @RequireRoles(...FINANCE_MANAGE_ROLES)
  createGoodsReceipt(@Body() dto: CreateGoodsReceiptDto, @CurrentUser() user: JwtPayload) {
    return this.service.createGoodsReceipt(dto, user);
  }
}
