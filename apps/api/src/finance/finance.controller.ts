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
  CreateTimeAdjustmentDto,
  CreateTimeEntryDto,
  DecideTimeAdjustmentDto,
  ListFinanceQueryDto,
  UpdateFinancialPeriodStatusDto,
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
  createTimeAdjustment(
    @Body() dto: CreateTimeAdjustmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
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
}
