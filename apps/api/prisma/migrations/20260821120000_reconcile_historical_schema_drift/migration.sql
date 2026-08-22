-- Reconciliação compatível do schema histórico.
-- Esta migration é expand-only: cria somente objetos ausentes e amplia o schema
-- quando a tabela/enum de origem existir. Nenhum dado é apagado ou reescrito.

DO $$
BEGIN
  IF to_regtype('public."TaxIdType"') IS NULL THEN
    CREATE TYPE "TaxIdType" AS ENUM ('CNPJ', 'CPF', 'EIN', 'NIF', 'VAT', 'OTHER', 'NONE');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('public."AuditLogAction"') IS NOT NULL THEN
    BEGIN ALTER TYPE "AuditLogAction" ADD VALUE 'SUBMIT_REVIEW'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE "AuditLogAction" ADD VALUE 'APPROVE_PLANNING'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE "AuditLogAction" ADD VALUE 'RETURN_PLANNING'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('public."AuditLogEntity"') IS NOT NULL THEN
    BEGIN ALTER TYPE "AuditLogEntity" ADD VALUE 'PEDAGOGICAL_FRAMEWORK'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE "AuditLogEntity" ADD VALUE 'TENANT_BRANDING'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE "AuditLogEntity" ADD VALUE 'FEATURE_FLAG'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE "AuditLogEntity" ADD VALUE 'INSTITUTION_CONTENT_UPLOAD'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."Mantenedora"') IS NOT NULL THEN
    ALTER TABLE "Mantenedora" ADD COLUMN IF NOT EXISTS "country" VARCHAR(2) NOT NULL DEFAULT 'BR';
    ALTER TABLE "Mantenedora" ADD COLUMN IF NOT EXISTS "taxId" VARCHAR(50);
    ALTER TABLE "Mantenedora" ADD COLUMN IF NOT EXISTS "taxIdType" "TaxIdType" NOT NULL DEFAULT 'CNPJ';
  END IF;

  IF to_regclass('public."CurriculumMatrixEntry"') IS NOT NULL THEN
    ALTER TABLE "CurriculumMatrixEntry" ADD COLUMN IF NOT EXISTS "frameworkObjectiveId" TEXT;
  END IF;

  IF to_regclass('public."PedidoCompra"') IS NOT NULL THEN
    ALTER TABLE "PedidoCompra" ADD COLUMN IF NOT EXISTS "fornecedorId" TEXT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Fornecedor" (
  "id" TEXT NOT NULL,
  "razaoSocial" TEXT NOT NULL,
  "nomeFantasia" TEXT,
  "cnpj" TEXT NOT NULL,
  "inscricaoEstadual" TEXT,
  "email" TEXT,
  "telefone" TEXT,
  "celular" TEXT,
  "endereco" TEXT,
  "cidade" TEXT,
  "estado" TEXT,
  "cep" TEXT,
  "contato" TEXT,
  "observacoes" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "mantenedoraId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Fornecedor_mantenedoraId_idx" ON "Fornecedor"("mantenedoraId");
CREATE INDEX IF NOT EXISTS "Fornecedor_cnpj_idx" ON "Fornecedor"("cnpj");
CREATE INDEX IF NOT EXISTS "CurriculumMatrixEntry_frameworkObjectiveId_idx" ON "CurriculumMatrixEntry"("frameworkObjectiveId");

DO $$
BEGIN
  IF to_regclass('public."Fornecedor"') IS NOT NULL AND to_regclass('public."Mantenedora"') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."Fornecedor"') AND conname = 'Fornecedor_mantenedoraId_fkey') THEN
      ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_mantenedoraId_fkey"
        FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public."PedidoCompra"') IS NOT NULL AND to_regclass('public."Fornecedor"') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."PedidoCompra"') AND conname = 'PedidoCompra_fornecedorId_fkey') THEN
      ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_fornecedorId_fkey"
        FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public."CurriculumMatrixEntry"') IS NOT NULL AND to_regclass('public."FrameworkObjective"') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."CurriculumMatrixEntry"') AND conname = 'CurriculumMatrixEntry_frameworkObjectiveId_fkey') THEN
      ALTER TABLE "CurriculumMatrixEntry" ADD CONSTRAINT "CurriculumMatrixEntry_frameworkObjectiveId_fkey"
        FOREIGN KEY ("frameworkObjectiveId") REFERENCES "FrameworkObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
