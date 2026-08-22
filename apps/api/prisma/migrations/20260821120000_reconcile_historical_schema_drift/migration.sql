-- Reconciliação gerada a partir do drift do schema histórico no Gate 0.2.
-- NÃO aplicar em produção sem revisão e autorização humana explícitas: o diff inclui
-- alterações de enums, defaults, constraints, índices, colunas e a tabela Fornecedor.
-- Esta migration existe para tornar o estado canônico reprodutível; nenhum deploy foi executado.
-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "TaxIdType" AS ENUM ('CNPJ', 'CPF', 'EIN', 'NIF', 'VAT', 'OTHER', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


DO $$
BEGIN
  ALTER TYPE "AuditLogAction" ADD VALUE 'SUBMIT_REVIEW';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
DO $$
BEGIN
  ALTER TYPE "AuditLogAction" ADD VALUE 'APPROVE_PLANNING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
DO $$
BEGIN
  ALTER TYPE "AuditLogAction" ADD VALUE 'RETURN_PLANNING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


DO $$
BEGIN
  ALTER TYPE "AuditLogEntity" ADD VALUE 'PEDAGOGICAL_FRAMEWORK';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
DO $$
BEGIN
  ALTER TYPE "AuditLogEntity" ADD VALUE 'TENANT_BRANDING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
DO $$
BEGIN
  ALTER TYPE "AuditLogEntity" ADD VALUE 'FEATURE_FLAG';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
DO $$
BEGIN
  ALTER TYPE "AuditLogEntity" ADD VALUE 'INSTITUTION_CONTENT_UPLOAD';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AlterEnum
BEGIN;
CREATE TYPE "PlanningType_new" AS ENUM ('SEMANAL', 'MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');
ALTER TABLE "Planning" ALTER COLUMN "type" TYPE "PlanningType_new" USING ("type"::text::"PlanningType_new");
ALTER TYPE "PlanningType" RENAME TO "PlanningType_old";
ALTER TYPE "PlanningType_new" RENAME TO "PlanningType";
DROP TYPE IF EXISTS "PlanningType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StatusSolicitacaoCorrecao_new" AS ENUM ('PENDENTE', 'EM_REVISAO', 'RESOLVIDA', 'CANCELADA');
ALTER TABLE "SolicitacaoCorrecao" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SolicitacaoCorrecao" ALTER COLUMN "status" TYPE "StatusSolicitacaoCorrecao_new" USING ("status"::text::"StatusSolicitacaoCorrecao_new");
ALTER TYPE "StatusSolicitacaoCorrecao" RENAME TO "StatusSolicitacaoCorrecao_old";
ALTER TYPE "StatusSolicitacaoCorrecao_new" RENAME TO "StatusSolicitacaoCorrecao";
DROP TYPE IF EXISTS "StatusSolicitacaoCorrecao_old";
ALTER TABLE "SolicitacaoCorrecao" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TipoAlvoCorrecao_new" AS ENUM ('DIARIO', 'PLANEJAMENTO', 'RELATORIO', 'CADASTRO_ALUNO', 'OUTRO');
ALTER TABLE "SolicitacaoCorrecao" ALTER COLUMN "tipoAlvo" TYPE "TipoAlvoCorrecao_new" USING ("tipoAlvo"::text::"TipoAlvoCorrecao_new");
ALTER TYPE "TipoAlvoCorrecao" RENAME TO "TipoAlvoCorrecao_old";
ALTER TYPE "TipoAlvoCorrecao_new" RENAME TO "TipoAlvoCorrecao";
DROP TYPE IF EXISTS "TipoAlvoCorrecao_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "RDIXInstancia" DROP CONSTRAINT IF EXISTS "RDIXInstancia_templateId_fkey";

-- DropForeignKey
ALTER TABLE "cardapio" DROP CONSTRAINT IF EXISTS "cardapio_mantenedoraId_fkey";

-- DropForeignKey
ALTER TABLE "cardapio" DROP CONSTRAINT IF EXISTS "cardapio_unitId_fkey";

-- DropForeignKey
ALTER TABLE "cardapio_item" DROP CONSTRAINT IF EXISTS "cardapio_item_refeicaoId_fkey";

-- DropForeignKey
ALTER TABLE "cardapio_refeicao" DROP CONSTRAINT IF EXISTS "cardapio_refeicao_cardapioId_fkey";

-- DropForeignKey
ALTER TABLE "ia_feedback" DROP CONSTRAINT IF EXISTS "ia_feedback_responseId_fkey";

-- DropForeignKey
ALTER TABLE "ia_log" DROP CONSTRAINT IF EXISTS "ia_log_requestId_fkey";

-- DropForeignKey
ALTER TABLE "ia_request" DROP CONSTRAINT IF EXISTS "ia_request_mantenedoraId_fkey";

-- DropForeignKey
ALTER TABLE "ia_request" DROP CONSTRAINT IF EXISTS "ia_request_promptId_fkey";

-- DropForeignKey
ALTER TABLE "ia_request" DROP CONSTRAINT IF EXISTS "ia_request_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "ia_request" DROP CONSTRAINT IF EXISTS "ia_request_unitId_fkey";

-- DropForeignKey
ALTER TABLE "ia_response" DROP CONSTRAINT IF EXISTS "ia_response_requestId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Planning_anoLetivo_idx";

-- DropIndex
DROP INDEX IF EXISTS "Planning_professorId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Unit_rdicProfileId_idx";

-- DropIndex
DROP INDEX IF EXISTS "ClassroomPost_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "RecadoTurma_criadoEm_idx";

-- AlterTable
ALTER TABLE "AIContext" ALTER COLUMN "mantenedoraId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ChildEvidence" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CurriculumMatrixEntry" ADD COLUMN IF NOT EXISTS     "frameworkObjectiveId" TEXT,
ALTER COLUMN "campoDeExperiencia" DROP NOT NULL,
ALTER COLUMN "objetivoBNCC" DROP NOT NULL,
ALTER COLUMN "objetivoCurriculo" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EmpresaTransporte" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Mantenedora" ADD COLUMN IF NOT EXISTS     "country" VARCHAR(2) NOT NULL DEFAULT 'BR',
ADD COLUMN IF NOT EXISTS     "taxId" VARCHAR(50),
ADD COLUMN IF NOT EXISTS     "taxIdType" "TaxIdType" NOT NULL DEFAULT 'CNPJ',
ALTER COLUMN "cnpj" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Material" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MaterialRequestItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PedidoCompra" ADD COLUMN IF NOT EXISTS     "fornecedorId" TEXT;

-- AlterTable
ALTER TABLE "Planning" ALTER COLUMN "reviewedBy" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "professorId" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "PlanningConferencia" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RdicDocumentProfile" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReportBase" ALTER COLUMN "mantenedoraId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SolicitacaoCorrecao" ALTER COLUMN "mantenedoraId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "acompanhamento_nutricional" ALTER COLUMN "atualizado_em" DROP DEFAULT;

-- AlterTable
ALTER TABLE "alerta_aluno" ALTER COLUMN "mantenedoraId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "alimento" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."classroom_post"') AND conname = 'ClassroomPost_pkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."classroom_post"') AND conname = 'classroom_post_pkey') THEN
    ALTER TABLE "classroom_post" RENAME CONSTRAINT "ClassroomPost_pkey" TO "classroom_post_pkey";
  END IF;
END
$$;
ALTER TABLE "classroom_post" DROP COLUMN IF EXISTS "type",
ADD COLUMN IF NOT EXISTS     "type" VARCHAR(50) NOT NULL DEFAULT 'TAREFA',
DROP COLUMN IF EXISTS "status",
ADD COLUMN IF NOT EXISTS     "status" VARCHAR(50) NOT NULL DEFAULT 'PUBLICADO',
ALTER COLUMN "content" DROP NOT NULL,
ALTER COLUMN "created_by" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."classroom_post_file"') AND conname = 'ClassroomPostFile_pkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."classroom_post_file"') AND conname = 'classroom_post_file_pkey') THEN
    ALTER TABLE "classroom_post_file" RENAME CONSTRAINT "ClassroomPostFile_pkey" TO "classroom_post_file_pkey";
  END IF;
END
$$;
ALTER TABLE "classroom_post_file" DROP COLUMN IF EXISTS "tamanho_bytes",
ALTER COLUMN "url" SET DATA TYPE VARCHAR(1024),
ALTER COLUMN "mime_type" DROP DEFAULT;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_observation"') AND conname = 'ci_development_observation_pkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_observation"') AND conname = 'development_observation_pkey') THEN
    ALTER TABLE "development_observation" RENAME CONSTRAINT "ci_development_observation_pkey" TO "development_observation_pkey";
  END IF;
END
$$;
ALTER TABLE "development_observation" DROP COLUMN IF EXISTS "diary_event_id",
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_report"') AND conname = 'DevelopmentReport_pkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_report"') AND conname = 'development_report_pkey') THEN
    ALTER TABLE "development_report" RENAME CONSTRAINT "DevelopmentReport_pkey" TO "development_report_pkey";
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "ia_config" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "prompt_template" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."rdic_document_event"') AND conname = 'RdicDocumentEvent_pkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."rdic_document_event"') AND conname = 'rdic_document_event_pkey') THEN
    ALTER TABLE "rdic_document_event" RENAME CONSTRAINT "RdicDocumentEvent_pkey" TO "rdic_document_event_pkey";
  END IF;
END
$$;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."recado_leitura"') AND conname = 'RecadoLeitura_pkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."recado_leitura"') AND conname = 'recado_leitura_pkey') THEN
    ALTER TABLE "recado_leitura" RENAME CONSTRAINT "RecadoLeitura_pkey" TO "recado_leitura_pkey";
  END IF;
END
$$;
ALTER TABLE "recado_leitura" ALTER COLUMN "user_id" SET DATA TYPE VARCHAR(255);

-- AlterTable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."recado_turma"') AND conname = 'RecadoTurma_pkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."recado_turma"') AND conname = 'recado_turma_pkey') THEN
    ALTER TABLE "recado_turma" RENAME CONSTRAINT "RecadoTurma_pkey" TO "recado_turma_pkey";
  END IF;
END
$$;
ALTER TABLE "recado_turma" DROP COLUMN IF EXISTS "destinatario",
ADD COLUMN IF NOT EXISTS     "destinatario" VARCHAR(50) NOT NULL DEFAULT 'TODAS_PROFESSORAS',
ALTER COLUMN "professor_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "criado_por_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "atualizado_em" DROP DEFAULT;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."student_post_performance"') AND conname = 'StudentPostPerformance_pkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."student_post_performance"') AND conname = 'student_post_performance_pkey') THEN
    ALTER TABLE "student_post_performance" RENAME CONSTRAINT "StudentPostPerformance_pkey" TO "student_post_performance_pkey";
  END IF;
END
$$;
ALTER TABLE "student_post_performance" ALTER COLUMN "performance" DROP NOT NULL,
ALTER COLUMN "performance" DROP DEFAULT,
ALTER COLUMN "created_by" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "updated_at" DROP DEFAULT;

-- DropEnum
DROP TYPE IF EXISTS "observation_category";

-- DropEnum
DROP TYPE IF EXISTS "post_status";

-- DropEnum
DROP TYPE IF EXISTS "post_type";

-- DropEnum
DROP TYPE IF EXISTS "recado_destinatario";

-- DropEnum
DROP TYPE IF EXISTS "report_type";

-- CreateTable
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fornecedor_mantenedoraId_idx" ON "Fornecedor"("mantenedoraId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fornecedor_cnpj_idx" ON "Fornecedor"("cnpj");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CurriculumMatrixEntry_frameworkObjectiveId_idx" ON "CurriculumMatrixEntry"("frameworkObjectiveId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ItemPedidoCompra_categoria_idx" ON "ItemPedidoCompra"("categoria");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SolicitacaoCorrecao_criadoPorId_idx" ON "SolicitacaoCorrecao"("criadoPorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SolicitacaoCorrecao_responsavelId_idx" ON "SolicitacaoCorrecao"("responsavelId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SolicitacaoCorrecao_status_idx" ON "SolicitacaoCorrecao"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SolicitacaoCorrecao_tipoAlvo_alvoId_idx" ON "SolicitacaoCorrecao"("tipoAlvo", "alvoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "classroom_post_unit_id_idx" ON "classroom_post"("unit_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "classroom_post_created_by_idx" ON "classroom_post"("created_by");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "classroom_post_type_idx" ON "classroom_post"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "classroom_post_status_idx" ON "classroom_post"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "classroom_post_due_date_idx" ON "classroom_post"("due_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recado_turma_destinatario_idx" ON "recado_turma"("destinatario");

-- RenameForeignKey
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."classroom_post_file"') AND conname = 'ClassroomPostFile_postId_fkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."classroom_post_file"') AND conname = 'classroom_post_file_post_id_fkey') THEN
    ALTER TABLE "classroom_post_file" RENAME CONSTRAINT "ClassroomPostFile_postId_fkey" TO "classroom_post_file_post_id_fkey";
  END IF;
END
$$;

-- RenameForeignKey
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_report"') AND conname = 'DevelopmentReport_authorId_fkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_report"') AND conname = 'development_report_authorId_fkey') THEN
    ALTER TABLE "development_report" RENAME CONSTRAINT "DevelopmentReport_authorId_fkey" TO "development_report_authorId_fkey";
  END IF;
END
$$;

-- RenameForeignKey
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_report"') AND conname = 'DevelopmentReport_childId_fkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_report"') AND conname = 'development_report_childId_fkey') THEN
    ALTER TABLE "development_report" RENAME CONSTRAINT "DevelopmentReport_childId_fkey" TO "development_report_childId_fkey";
  END IF;
END
$$;

-- RenameForeignKey
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_report"') AND conname = 'DevelopmentReport_classroomId_fkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_report"') AND conname = 'development_report_classroomId_fkey') THEN
    ALTER TABLE "development_report" RENAME CONSTRAINT "DevelopmentReport_classroomId_fkey" TO "development_report_classroomId_fkey";
  END IF;
END
$$;

-- RenameForeignKey
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_report"') AND conname = 'DevelopmentReport_unitId_fkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_report"') AND conname = 'development_report_unitId_fkey') THEN
    ALTER TABLE "development_report" RENAME CONSTRAINT "DevelopmentReport_unitId_fkey" TO "development_report_unitId_fkey";
  END IF;
END
$$;

-- RenameForeignKey
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."rdic_document_event"') AND conname = 'RdicDocumentEvent_instanciaId_fkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."rdic_document_event"') AND conname = 'rdic_document_event_instanciaId_fkey') THEN
    ALTER TABLE "rdic_document_event" RENAME CONSTRAINT "RdicDocumentEvent_instanciaId_fkey" TO "rdic_document_event_instanciaId_fkey";
  END IF;
END
$$;

-- RenameForeignKey
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."rdic_document_event"') AND conname = 'RdicDocumentEvent_mantenedoraId_fkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."rdic_document_event"') AND conname = 'rdic_document_event_mantenedoraId_fkey') THEN
    ALTER TABLE "rdic_document_event" RENAME CONSTRAINT "RdicDocumentEvent_mantenedoraId_fkey" TO "rdic_document_event_mantenedoraId_fkey";
  END IF;
END
$$;

-- RenameForeignKey
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."rdic_document_event"') AND conname = 'RdicDocumentEvent_unitId_fkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."rdic_document_event"') AND conname = 'rdic_document_event_unitId_fkey') THEN
    ALTER TABLE "rdic_document_event" RENAME CONSTRAINT "RdicDocumentEvent_unitId_fkey" TO "rdic_document_event_unitId_fkey";
  END IF;
END
$$;

-- RenameForeignKey
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."recado_leitura"') AND conname = 'RecadoLeitura_recadoId_fkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."recado_leitura"') AND conname = 'recado_leitura_recado_id_fkey') THEN
    ALTER TABLE "recado_leitura" RENAME CONSTRAINT "RecadoLeitura_recadoId_fkey" TO "recado_leitura_recado_id_fkey";
  END IF;
END
$$;

-- RenameForeignKey
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."recado_turma"') AND conname = 'RecadoTurma_mantenedoraId_fkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."recado_turma"') AND conname = 'recado_turma_mantenedora_id_fkey') THEN
    ALTER TABLE "recado_turma" RENAME CONSTRAINT "RecadoTurma_mantenedoraId_fkey" TO "recado_turma_mantenedora_id_fkey";
  END IF;
END
$$;

-- RenameForeignKey
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."student_post_performance"') AND conname = 'StudentPostPerformance_postId_fkey') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."student_post_performance"') AND conname = 'student_post_performance_post_id_fkey') THEN
    ALTER TABLE "student_post_performance" RENAME CONSTRAINT "StudentPostPerformance_postId_fkey" TO "student_post_performance_post_id_fkey";
  END IF;
END
$$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."CurriculumMatrixEntry"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."CurriculumMatrixEntry"') AND conname = 'CurriculumMatrixEntry_frameworkObjectiveId_fkey') THEN ALTER TABLE "CurriculumMatrixEntry" ADD CONSTRAINT "CurriculumMatrixEntry_frameworkObjectiveId_fkey" FOREIGN KEY ("frameworkObjectiveId") REFERENCES "FrameworkObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."PedidoCompra"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."PedidoCompra"') AND conname = 'PedidoCompra_fornecedorId_fkey') THEN ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."RDIXInstancia"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."RDIXInstancia"') AND conname = 'RDIXInstancia_templateId_fkey') THEN ALTER TABLE "RDIXInstancia" ADD CONSTRAINT "RDIXInstancia_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RDIXTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."Fornecedor"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."Fornecedor"') AND conname = 'Fornecedor_mantenedoraId_fkey') THEN ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."classroom_post"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."classroom_post"') AND conname = 'classroom_post_mantenedora_id_fkey') THEN ALTER TABLE "classroom_post" ADD CONSTRAINT "classroom_post_mantenedora_id_fkey" FOREIGN KEY ("mantenedora_id") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."classroom_post"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."classroom_post"') AND conname = 'classroom_post_classroom_id_fkey') THEN ALTER TABLE "classroom_post" ADD CONSTRAINT "classroom_post_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."student_post_performance"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."student_post_performance"') AND conname = 'student_post_performance_child_id_fkey') THEN ALTER TABLE "student_post_performance" ADD CONSTRAINT "student_post_performance_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."development_observation"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."development_observation"') AND conname = 'development_observation_child_id_fkey') THEN ALTER TABLE "development_observation" ADD CONSTRAINT "development_observation_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."cardapio"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."cardapio"') AND conname = 'cardapio_mantenedoraId_fkey') THEN ALTER TABLE "cardapio" ADD CONSTRAINT "cardapio_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."cardapio"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."cardapio"') AND conname = 'cardapio_unitId_fkey') THEN ALTER TABLE "cardapio" ADD CONSTRAINT "cardapio_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."cardapio_refeicao"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."cardapio_refeicao"') AND conname = 'cardapio_refeicao_cardapioId_fkey') THEN ALTER TABLE "cardapio_refeicao" ADD CONSTRAINT "cardapio_refeicao_cardapioId_fkey" FOREIGN KEY ("cardapioId") REFERENCES "cardapio"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."cardapio_item"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."cardapio_item"') AND conname = 'cardapio_item_refeicaoId_fkey') THEN ALTER TABLE "cardapio_item" ADD CONSTRAINT "cardapio_item_refeicaoId_fkey" FOREIGN KEY ("refeicaoId") REFERENCES "cardapio_refeicao"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."acompanhamento_nutricional"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."acompanhamento_nutricional"') AND conname = 'acompanhamento_nutricional_mantenedora_id_fkey') THEN ALTER TABLE "acompanhamento_nutricional" ADD CONSTRAINT "acompanhamento_nutricional_mantenedora_id_fkey" FOREIGN KEY ("mantenedora_id") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."acompanhamento_nutricional"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."acompanhamento_nutricional"') AND conname = 'acompanhamento_nutricional_child_id_fkey') THEN ALTER TABLE "acompanhamento_nutricional" ADD CONSTRAINT "acompanhamento_nutricional_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."ia_request"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."ia_request"') AND conname = 'ia_request_mantenedoraId_fkey') THEN ALTER TABLE "ia_request" ADD CONSTRAINT "ia_request_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."ia_request"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."ia_request"') AND conname = 'ia_request_unitId_fkey') THEN ALTER TABLE "ia_request" ADD CONSTRAINT "ia_request_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."ia_request"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."ia_request"') AND conname = 'ia_request_requesterId_fkey') THEN ALTER TABLE "ia_request" ADD CONSTRAINT "ia_request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."ia_request"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."ia_request"') AND conname = 'ia_request_promptId_fkey') THEN ALTER TABLE "ia_request" ADD CONSTRAINT "ia_request_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompt_template"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."ia_response"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."ia_response"') AND conname = 'ia_response_requestId_fkey') THEN ALTER TABLE "ia_response" ADD CONSTRAINT "ia_response_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ia_request"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."ia_log"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."ia_log"') AND conname = 'ia_log_requestId_fkey') THEN ALTER TABLE "ia_log" ADD CONSTRAINT "ia_log_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ia_request"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF to_regclass('public."ia_feedback"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public."ia_feedback"') AND conname = 'ia_feedback_responseId_fkey') THEN ALTER TABLE "ia_feedback" ADD CONSTRAINT "ia_feedback_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ia_response"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

