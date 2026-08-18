-- Zelare — trilha imutável de aprovação e fechamento da folha
-- Somente adiciona uma tabela; não altera nem remove dados existentes.

CREATE TABLE "payroll_approval" (
  "id" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "fromStatus" "FinancePayrollStatus" NOT NULL,
  "toStatus" "FinancePayrollStatus" NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_approval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payroll_approval_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId") REFERENCES "payroll_run"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "payroll_approval_payrollRunId_createdAt_idx"
  ON "payroll_approval"("payrollRunId", "createdAt");
CREATE INDEX "payroll_approval_actorId_idx"
  ON "payroll_approval"("actorId");
CREATE INDEX "payroll_approval_toStatus_idx"
  ON "payroll_approval"("toStatus");
