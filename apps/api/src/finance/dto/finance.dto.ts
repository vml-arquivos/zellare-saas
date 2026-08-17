import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  FinanceApprovalStatus,
  FinanceEmploymentStatus,
  FinancePeriodStatus,
  FinanceTimeEntryStatus,
} from '@prisma/client';

export class CreateFinancialPeriodDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'referenceMonth deve estar no formato YYYY-MM',
  })
  referenceMonth!: string;
}

export class UpdateFinancialPeriodStatusDto {
  @IsEnum(FinancePeriodStatus)
  status!: FinancePeriodStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateEmployeeDto {
  @IsString()
  employeeCode!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  roleType?: string;

  @IsOptional()
  @IsEnum(FinanceEmploymentStatus)
  employmentStatus?: FinanceEmploymentStatus;

  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseSalary?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(168)
  weeklyHours?: number;

  @IsOptional()
  @IsString()
  costCenter?: string;

  @IsOptional()
  @IsString()
  bankAccountMasked?: string;
}

export class CreateTimeEntryDto {
  @IsString()
  employeeId!: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsDateString()
  workDate!: string;

  @IsOptional()
  @IsDateString()
  clockIn?: string;

  @IsOptional()
  @IsDateString()
  clockOut?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  breakMinutes?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTimeAdjustmentDto {
  @IsString()
  employeeId!: string;

  @IsOptional()
  @IsString()
  timeEntryId?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsString()
  reason!: string;

  proposedData!: Record<string, unknown>;
}

export class DecideTimeAdjustmentDto {
  @IsEnum(FinanceApprovalStatus)
  status!: FinanceApprovalStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class ListFinanceQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(FinanceTimeEntryStatus)
  status?: FinanceTimeEntryStatus;
}
