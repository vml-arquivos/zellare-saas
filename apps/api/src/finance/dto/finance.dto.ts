import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  FinanceApprovalStatus,
  FinanceEmploymentStatus,
  FinancePayrollItemKind,
  FinancePayrollStatus,
  FinancePayableStatus,
  FinancePeriodStatus,
  FinancePurchaseStatus,
  FinanceStockMovementType,
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

  @IsObject()
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

export class ListPayableQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsEnum(FinancePayableStatus)
  status?: FinancePayableStatus;
}

export class ListStockQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;
}

export class ListPurchaseQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsEnum(FinancePurchaseStatus)
  status?: FinancePurchaseStatus;
}

export class CreatePayrollDto {
  @IsString()
  periodId!: string;
}

export class UpdatePayrollStatusDto {
  @IsEnum(FinancePayrollStatus)
  status!: FinancePayrollStatus;
}

export class ListPayrollQueryDto {
  @IsOptional()
  @IsString()
  periodId?: string;
}

export class CreatePayableDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsString()
  beneficiary!: string;

  @IsString()
  description!: string;

  @IsString()
  category!: string;

  @IsString()
  sourceType!: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsDateString()
  dueDate!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  documentRef?: string;
}

export class UpdatePayableStatusDto {
  @IsEnum(FinancePayableStatus)
  status!: FinancePayableStatus;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  paymentRef?: string;
}

export class CreateStockItemDto {
  @IsString()
  unitId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumQuantity?: number;

  @IsOptional()
  @IsString()
  location?: string;
}

export class CreateStockMovementDto {
  @IsString()
  unitId!: string;

  @IsString()
  stockItemId!: string;

  @IsEnum(FinanceStockMovementType)
  movementType!: FinanceStockMovementType;

  @IsInt()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;

  @IsString()
  sourceType!: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreatePurchaseQuoteDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  purchaseId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsEnum(FinancePurchaseStatus)
  status!: FinancePurchaseStatus;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  documentRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GoodsReceiptItemDto {
  @IsString()
  stockItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;
}

export class CreateGoodsReceiptDto {
  @IsString()
  unitId!: string;

  @IsString()
  purchaseId!: string;

  @IsOptional()
  @IsEnum(FinancePurchaseStatus)
  status?: FinancePurchaseStatus;

  @IsArray()
  items!: GoodsReceiptItemDto[];

  @IsOptional()
  @IsString()
  documentRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
