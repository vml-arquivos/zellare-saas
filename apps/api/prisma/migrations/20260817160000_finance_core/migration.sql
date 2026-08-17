-- Zelare — núcleo financeiro inicial
-- Esta migração somente cria estruturas novas. Não altera nem remove tabelas pedagógicas.
-- A aplicação deve executar em homologação antes de qualquer promoção.

CREATE TYPE "FinancePeriodStatus" AS ENUM ('ABERTA', 'EM_CONFERENCIA', 'APROVADA', 'FECHADA', 'REABERTA');
CREATE TYPE "FinanceEmploymentStatus" AS ENUM ('ATIVO', 'AFASTADO', 'FERIAS', 'ENCERRADO');
CREATE TYPE "FinanceTimeEntryStatus" AS ENUM ('RASCUNHO', 'ENVIADO', 'EM_ANALISE', 'APROVADO', 'REJEITADO');
CREATE TYPE "FinancePayrollStatus" AS ENUM ('RASCUNHO', 'CALCULADA', 'EM_CONFERENCIA', 'APROVADA', 'FECHADA', 'RETIFICADA');
CREATE TYPE "FinancePayrollItemKind" AS ENUM ('PROVENTO', 'DESCONTO', 'ENCARGO', 'BENEFICIO', 'AJUSTE');
CREATE TYPE "FinancePayableStatus" AS ENUM ('RASCUNHO', 'EM_APROVACAO', 'APROVADA', 'AGENDADA', 'PAGA', 'CONCILIADA', 'CANCELADA');
CREATE TYPE "FinanceApprovalStatus" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA', 'CANCELADA');
CREATE TYPE "FinanceStockMovementType" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE', 'TRANSFERENCIA');
CREATE TYPE "FinancePurchaseStatus" AS ENUM ('ABERTA', 'RECEBIDA', 'CANCELADA');

CREATE TABLE "financial_period" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "referenceMonth" VARCHAR(7) NOT NULL,
  "status" "FinancePeriodStatus" NOT NULL DEFAULT 'ABERTA',
  "closedAt" TIMESTAMP(3),
  "closedBy" TEXT,
  "reopenedAt" TIMESTAMP(3),
  "reopenedBy" TEXT,
  "reopenReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "financial_period_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "financial_period_mantenedoraId_referenceMonth_key" ON "financial_period"("mantenedoraId", "referenceMonth");
CREATE INDEX "financial_period_mantenedoraId_idx" ON "financial_period"("mantenedoraId");
CREATE INDEX "financial_period_status_idx" ON "financial_period"("status");

CREATE TABLE "employee_profile" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT,
  "userId" TEXT,
  "employeeCode" VARCHAR(50) NOT NULL,
  "firstName" VARCHAR(100) NOT NULL,
  "lastName" VARCHAR(100) NOT NULL,
  "cpf" VARCHAR(14),
  "roleType" VARCHAR(80),
  "employmentStatus" "FinanceEmploymentStatus" NOT NULL DEFAULT 'ATIVO',
  "hireDate" TIMESTAMP(3),
  "terminationDate" TIMESTAMP(3),
  "baseSalary" DECIMAL(12,2),
  "weeklyHours" DECIMAL(6,2),
  "costCenter" VARCHAR(100),
  "bankAccountMasked" VARCHAR(80),
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_profile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employee_profile_cpf_key" ON "employee_profile"("cpf");
CREATE UNIQUE INDEX "employee_profile_mantenedoraId_employeeCode_key" ON "employee_profile"("mantenedoraId", "employeeCode");
CREATE INDEX "employee_profile_mantenedoraId_idx" ON "employee_profile"("mantenedoraId");
CREATE INDEX "employee_profile_unitId_idx" ON "employee_profile"("unitId");
CREATE INDEX "employee_profile_userId_idx" ON "employee_profile"("userId");
CREATE INDEX "employee_profile_employmentStatus_idx" ON "employee_profile"("employmentStatus");

CREATE TABLE "work_schedule" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT,
  "employeeId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "breakMinutes" INTEGER NOT NULL DEFAULT 0,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_schedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "work_schedule_mantenedoraId_idx" ON "work_schedule"("mantenedoraId");
CREATE INDEX "work_schedule_unitId_idx" ON "work_schedule"("unitId");
CREATE INDEX "work_schedule_employeeId_idx" ON "work_schedule"("employeeId");
CREATE INDEX "work_schedule_effectiveFrom_idx" ON "work_schedule"("effectiveFrom");

CREATE TABLE "time_entry" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT,
  "periodId" TEXT,
  "employeeId" TEXT NOT NULL,
  "workDate" TIMESTAMP(3) NOT NULL,
  "clockIn" TIMESTAMP(3),
  "clockOut" TIMESTAMP(3),
  "breakMinutes" INTEGER NOT NULL DEFAULT 0,
  "workedMinutes" INTEGER,
  "status" "FinanceTimeEntryStatus" NOT NULL DEFAULT 'RASCUNHO',
  "source" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT,
  "createdBy" TEXT,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "time_entry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "time_entry_employeeId_workDate_clockIn_key" ON "time_entry"("employeeId", "workDate", "clockIn");
CREATE INDEX "time_entry_mantenedoraId_idx" ON "time_entry"("mantenedoraId");
CREATE INDEX "time_entry_unitId_idx" ON "time_entry"("unitId");
CREATE INDEX "time_entry_periodId_idx" ON "time_entry"("periodId");
CREATE INDEX "time_entry_employeeId_workDate_idx" ON "time_entry"("employeeId", "workDate");
CREATE INDEX "time_entry_status_idx" ON "time_entry"("status");

CREATE TABLE "time_adjustment" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT,
  "periodId" TEXT,
  "employeeId" TEXT NOT NULL,
  "timeEntryId" TEXT,
  "requestedBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "status" "FinanceApprovalStatus" NOT NULL DEFAULT 'PENDENTE',
  "previousData" JSONB NOT NULL,
  "proposedData" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "time_adjustment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "time_adjustment_mantenedoraId_idx" ON "time_adjustment"("mantenedoraId");
CREATE INDEX "time_adjustment_unitId_idx" ON "time_adjustment"("unitId");
CREATE INDEX "time_adjustment_periodId_idx" ON "time_adjustment"("periodId");
CREATE INDEX "time_adjustment_employeeId_idx" ON "time_adjustment"("employeeId");
CREATE INDEX "time_adjustment_status_idx" ON "time_adjustment"("status");

CREATE TABLE "payroll_run" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "status" "FinancePayrollStatus" NOT NULL DEFAULT 'RASCUNHO',
  "rulesVersion" VARCHAR(50) NOT NULL DEFAULT 'initial',
  "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalCharges" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "snapshot" JSONB,
  "createdBy" TEXT NOT NULL,
  "computedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "closedBy" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_run_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_run_periodId_key" ON "payroll_run"("periodId");
CREATE INDEX "payroll_run_mantenedoraId_idx" ON "payroll_run"("mantenedoraId");
CREATE INDEX "payroll_run_status_idx" ON "payroll_run"("status");

CREATE TABLE "payroll_employee" (
  "id" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "net" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "employerCharges" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_employee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_employee_payrollRunId_employeeId_key" ON "payroll_employee"("payrollRunId", "employeeId");
CREATE INDEX "payroll_employee_employeeId_idx" ON "payroll_employee"("employeeId");

CREATE TABLE "payroll_item" (
  "id" TEXT NOT NULL,
  "payrollEmployeeId" TEXT NOT NULL,
  "kind" "FinancePayrollItemKind" NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "description" VARCHAR(255) NOT NULL,
  "quantity" DECIMAL(12,4),
  "rate" DECIMAL(12,6),
  "amount" DECIMAL(14,2) NOT NULL,
  "reference" VARCHAR(100),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_item_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payroll_item_payrollEmployeeId_idx" ON "payroll_item"("payrollEmployeeId");
CREATE INDEX "payroll_item_kind_idx" ON "payroll_item"("kind");

CREATE TABLE "payable" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT,
  "periodId" TEXT,
  "supplierId" TEXT,
  "beneficiary" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "sourceType" VARCHAR(50) NOT NULL,
  "sourceId" TEXT,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" "FinancePayableStatus" NOT NULL DEFAULT 'RASCUNHO',
  "documentRef" VARCHAR(100),
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "paidBy" TEXT,
  "paidAt" TIMESTAMP(3),
  "paymentRef" VARCHAR(150),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payable_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payable_mantenedoraId_idx" ON "payable"("mantenedoraId");
CREATE INDEX "payable_unitId_idx" ON "payable"("unitId");
CREATE INDEX "payable_periodId_idx" ON "payable"("periodId");
CREATE INDEX "payable_supplierId_idx" ON "payable"("supplierId");
CREATE INDEX "payable_dueDate_idx" ON "payable"("dueDate");
CREATE INDEX "payable_status_idx" ON "payable"("status");

CREATE TABLE "payable_approval" (
  "id" TEXT NOT NULL,
  "payableId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "status" "FinanceApprovalStatus" NOT NULL DEFAULT 'PENDENTE',
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payable_approval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payable_approval_payableId_idx" ON "payable_approval"("payableId");
CREATE INDEX "payable_approval_actorId_idx" ON "payable_approval"("actorId");
CREATE INDEX "payable_approval_status_idx" ON "payable_approval"("status");

CREATE TABLE "stock_movement" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "stockItemId" TEXT NOT NULL,
  "movementType" "FinanceStockMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2),
  "sourceType" VARCHAR(50) NOT NULL,
  "sourceId" TEXT,
  "reason" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_movement_mantenedoraId_idx" ON "stock_movement"("mantenedoraId");
CREATE INDEX "stock_movement_unitId_idx" ON "stock_movement"("unitId");
CREATE INDEX "stock_movement_stockItemId_createdAt_idx" ON "stock_movement"("stockItemId", "createdAt");
CREATE INDEX "stock_movement_movementType_idx" ON "stock_movement"("movementType");

CREATE TABLE "purchase_quote" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "purchaseId" TEXT,
  "supplierId" TEXT,
  "status" "FinancePurchaseStatus" NOT NULL DEFAULT 'ABERTA',
  "quotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "documentRef" VARCHAR(150),
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_quote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "purchase_quote_mantenedoraId_idx" ON "purchase_quote"("mantenedoraId");
CREATE INDEX "purchase_quote_unitId_idx" ON "purchase_quote"("unitId");
CREATE INDEX "purchase_quote_purchaseId_idx" ON "purchase_quote"("purchaseId");
CREATE INDEX "purchase_quote_supplierId_idx" ON "purchase_quote"("supplierId");
CREATE INDEX "purchase_quote_status_idx" ON "purchase_quote"("status");

CREATE TABLE "goods_receipt" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "status" "FinancePurchaseStatus" NOT NULL DEFAULT 'ABERTA',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedBy" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "documentRef" VARCHAR(150),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goods_receipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "goods_receipt_mantenedoraId_idx" ON "goods_receipt"("mantenedoraId");
CREATE INDEX "goods_receipt_unitId_idx" ON "goods_receipt"("unitId");
CREATE INDEX "goods_receipt_purchaseId_idx" ON "goods_receipt"("purchaseId");
CREATE INDEX "goods_receipt_status_idx" ON "goods_receipt"("status");
