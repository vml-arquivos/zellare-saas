-- Reconciliação gerada a partir do drift do schema histórico no Gate 0.2.
-- NÃO aplicar em produção sem revisão e autorização humana explícitas: o diff inclui
-- alterações de enums, defaults, constraints, índices, colunas e a tabela Fornecedor.
-- Esta migration existe para tornar o estado canônico reprodutível; nenhum deploy foi executado.
-- CreateEnum
CREATE TYPE "TaxIdType" AS ENUM ('CNPJ', 'CPF', 'EIN', 'NIF', 'VAT', 'OTHER', 'NONE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditLogAction" ADD VALUE 'SUBMIT_REVIEW';
ALTER TYPE "AuditLogAction" ADD VALUE 'APPROVE_PLANNING';
ALTER TYPE "AuditLogAction" ADD VALUE 'RETURN_PLANNING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditLogEntity" ADD VALUE 'PEDAGOGICAL_FRAMEWORK';
ALTER TYPE "AuditLogEntity" ADD VALUE 'TENANT_BRANDING';
ALTER TYPE "AuditLogEntity" ADD VALUE 'FEATURE_FLAG';
ALTER TYPE "AuditLogEntity" ADD VALUE 'INSTITUTION_CONTENT_UPLOAD';

-- AlterEnum
BEGIN;
CREATE TYPE "PlanningType_new" AS ENUM ('SEMANAL', 'MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');
ALTER TABLE "Planning" ALTER COLUMN "type" TYPE "PlanningType_new" USING ("type"::text::"PlanningType_new");
ALTER TYPE "PlanningType" RENAME TO "PlanningType_old";
ALTER TYPE "PlanningType_new" RENAME TO "PlanningType";
DROP TYPE "PlanningType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StatusSolicitacaoCorrecao_new" AS ENUM ('PENDENTE', 'EM_REVISAO', 'RESOLVIDA', 'CANCELADA');
ALTER TABLE "SolicitacaoCorrecao" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SolicitacaoCorrecao" ALTER COLUMN "status" TYPE "StatusSolicitacaoCorrecao_new" USING ("status"::text::"StatusSolicitacaoCorrecao_new");
ALTER TYPE "StatusSolicitacaoCorrecao" RENAME TO "StatusSolicitacaoCorrecao_old";
ALTER TYPE "StatusSolicitacaoCorrecao_new" RENAME TO "StatusSolicitacaoCorrecao";
DROP TYPE "StatusSolicitacaoCorrecao_old";
ALTER TABLE "SolicitacaoCorrecao" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TipoAlvoCorrecao_new" AS ENUM ('DIARIO', 'PLANEJAMENTO', 'RELATORIO', 'CADASTRO_ALUNO', 'OUTRO');
ALTER TABLE "SolicitacaoCorrecao" ALTER COLUMN "tipoAlvo" TYPE "TipoAlvoCorrecao_new" USING ("tipoAlvo"::text::"TipoAlvoCorrecao_new");
ALTER TYPE "TipoAlvoCorrecao" RENAME TO "TipoAlvoCorrecao_old";
ALTER TYPE "TipoAlvoCorrecao_new" RENAME TO "TipoAlvoCorrecao";
DROP TYPE "TipoAlvoCorrecao_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "RDIXInstancia" DROP CONSTRAINT "RDIXInstancia_templateId_fkey";

-- DropForeignKey
ALTER TABLE "cardapio" DROP CONSTRAINT "cardapio_mantenedoraId_fkey";

-- DropForeignKey
ALTER TABLE "cardapio" DROP CONSTRAINT "cardapio_unitId_fkey";

-- DropForeignKey
ALTER TABLE "cardapio_item" DROP CONSTRAINT "cardapio_item_refeicaoId_fkey";

-- DropForeignKey
ALTER TABLE "cardapio_refeicao" DROP CONSTRAINT "cardapio_refeicao_cardapioId_fkey";

-- DropForeignKey
ALTER TABLE "ia_feedback" DROP CONSTRAINT "ia_feedback_responseId_fkey";

-- DropForeignKey
ALTER TABLE "ia_log" DROP CONSTRAINT "ia_log_requestId_fkey";

-- DropForeignKey
ALTER TABLE "ia_request" DROP CONSTRAINT "ia_request_mantenedoraId_fkey";

-- DropForeignKey
ALTER TABLE "ia_request" DROP CONSTRAINT "ia_request_promptId_fkey";

-- DropForeignKey
ALTER TABLE "ia_request" DROP CONSTRAINT "ia_request_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "ia_request" DROP CONSTRAINT "ia_request_unitId_fkey";

-- DropForeignKey
ALTER TABLE "ia_response" DROP CONSTRAINT "ia_response_requestId_fkey";

-- DropIndex
DROP INDEX "Planning_anoLetivo_idx";

-- DropIndex
DROP INDEX "Planning_professorId_idx";

-- DropIndex
DROP INDEX "Unit_rdicProfileId_idx";

-- DropIndex
DROP INDEX "ClassroomPost_createdAt_idx";

-- DropIndex
DROP INDEX "RecadoTurma_criadoEm_idx";

-- AlterTable
ALTER TABLE "AIContext" ALTER COLUMN "mantenedoraId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ChildEvidence" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CurriculumMatrixEntry" ADD COLUMN     "frameworkObjectiveId" TEXT,
ALTER COLUMN "campoDeExperiencia" DROP NOT NULL,
ALTER COLUMN "objetivoBNCC" DROP NOT NULL,
ALTER COLUMN "objetivoCurriculo" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EmpresaTransporte" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Mantenedora" ADD COLUMN     "country" VARCHAR(2) NOT NULL DEFAULT 'BR',
ADD COLUMN     "taxId" VARCHAR(50),
ADD COLUMN     "taxIdType" "TaxIdType" NOT NULL DEFAULT 'CNPJ',
ALTER COLUMN "cnpj" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Material" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MaterialRequestItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PedidoCompra" ADD COLUMN     "fornecedorId" TEXT;

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
ALTER TABLE "classroom_post" RENAME CONSTRAINT "ClassroomPost_pkey" TO "classroom_post_pkey";
ALTER TABLE "classroom_post" DROP COLUMN "type",
ADD COLUMN     "type" VARCHAR(50) NOT NULL DEFAULT 'TAREFA',
DROP COLUMN "status",
ADD COLUMN     "status" VARCHAR(50) NOT NULL DEFAULT 'PUBLICADO',
ALTER COLUMN "content" DROP NOT NULL,
ALTER COLUMN "created_by" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "classroom_post_file" RENAME CONSTRAINT "ClassroomPostFile_pkey" TO "classroom_post_file_pkey";
ALTER TABLE "classroom_post_file" DROP COLUMN "tamanho_bytes",
ALTER COLUMN "url" SET DATA TYPE VARCHAR(1024),
ALTER COLUMN "mime_type" DROP DEFAULT;

-- AlterTable
ALTER TABLE "development_observation" RENAME CONSTRAINT "ci_development_observation_pkey" TO "development_observation_pkey";
ALTER TABLE "development_observation" DROP COLUMN "diary_event_id",
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "development_report" RENAME CONSTRAINT "DevelopmentReport_pkey" TO "development_report_pkey";

-- AlterTable
ALTER TABLE "ia_config" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "prompt_template" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rdic_document_event" RENAME CONSTRAINT "RdicDocumentEvent_pkey" TO "rdic_document_event_pkey";

-- AlterTable
ALTER TABLE "recado_leitura" RENAME CONSTRAINT "RecadoLeitura_pkey" TO "recado_leitura_pkey";
ALTER TABLE "recado_leitura" ALTER COLUMN "user_id" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "recado_turma" RENAME CONSTRAINT "RecadoTurma_pkey" TO "recado_turma_pkey";
ALTER TABLE "recado_turma" DROP COLUMN "destinatario",
ADD COLUMN     "destinatario" VARCHAR(50) NOT NULL DEFAULT 'TODAS_PROFESSORAS',
ALTER COLUMN "professor_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "criado_por_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "atualizado_em" DROP DEFAULT;

-- AlterTable
ALTER TABLE "student_post_performance" RENAME CONSTRAINT "StudentPostPerformance_pkey" TO "student_post_performance_pkey";
ALTER TABLE "student_post_performance" ALTER COLUMN "performance" DROP NOT NULL,
ALTER COLUMN "performance" DROP DEFAULT,
ALTER COLUMN "created_by" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "updated_at" DROP DEFAULT;

-- DropEnum
DROP TYPE "observation_category";

-- DropEnum
DROP TYPE "post_status";

-- DropEnum
DROP TYPE "post_type";

-- DropEnum
DROP TYPE "recado_destinatario";

-- DropEnum
DROP TYPE "report_type";

-- CreateTable
CREATE TABLE "Fornecedor" (
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
CREATE INDEX "Fornecedor_mantenedoraId_idx" ON "Fornecedor"("mantenedoraId");

-- CreateIndex
CREATE INDEX "Fornecedor_cnpj_idx" ON "Fornecedor"("cnpj");

-- CreateIndex
CREATE INDEX "CurriculumMatrixEntry_frameworkObjectiveId_idx" ON "CurriculumMatrixEntry"("frameworkObjectiveId");

-- CreateIndex
CREATE INDEX "ItemPedidoCompra_categoria_idx" ON "ItemPedidoCompra"("categoria");

-- CreateIndex
CREATE INDEX "SolicitacaoCorrecao_criadoPorId_idx" ON "SolicitacaoCorrecao"("criadoPorId");

-- CreateIndex
CREATE INDEX "SolicitacaoCorrecao_responsavelId_idx" ON "SolicitacaoCorrecao"("responsavelId");

-- CreateIndex
CREATE INDEX "SolicitacaoCorrecao_status_idx" ON "SolicitacaoCorrecao"("status");

-- CreateIndex
CREATE INDEX "SolicitacaoCorrecao_tipoAlvo_alvoId_idx" ON "SolicitacaoCorrecao"("tipoAlvo", "alvoId");

-- CreateIndex
CREATE INDEX "classroom_post_unit_id_idx" ON "classroom_post"("unit_id");

-- CreateIndex
CREATE INDEX "classroom_post_created_by_idx" ON "classroom_post"("created_by");

-- CreateIndex
CREATE INDEX "classroom_post_type_idx" ON "classroom_post"("type");

-- CreateIndex
CREATE INDEX "classroom_post_status_idx" ON "classroom_post"("status");

-- CreateIndex
CREATE INDEX "classroom_post_due_date_idx" ON "classroom_post"("due_date");

-- CreateIndex
CREATE INDEX "recado_turma_destinatario_idx" ON "recado_turma"("destinatario");

-- RenameForeignKey
ALTER TABLE "classroom_post_file" RENAME CONSTRAINT "ClassroomPostFile_postId_fkey" TO "classroom_post_file_post_id_fkey";

-- RenameForeignKey
ALTER TABLE "development_report" RENAME CONSTRAINT "DevelopmentReport_authorId_fkey" TO "development_report_authorId_fkey";

-- RenameForeignKey
ALTER TABLE "development_report" RENAME CONSTRAINT "DevelopmentReport_childId_fkey" TO "development_report_childId_fkey";

-- RenameForeignKey
ALTER TABLE "development_report" RENAME CONSTRAINT "DevelopmentReport_classroomId_fkey" TO "development_report_classroomId_fkey";

-- RenameForeignKey
ALTER TABLE "development_report" RENAME CONSTRAINT "DevelopmentReport_unitId_fkey" TO "development_report_unitId_fkey";

-- RenameForeignKey
ALTER TABLE "rdic_document_event" RENAME CONSTRAINT "RdicDocumentEvent_instanciaId_fkey" TO "rdic_document_event_instanciaId_fkey";

-- RenameForeignKey
ALTER TABLE "rdic_document_event" RENAME CONSTRAINT "RdicDocumentEvent_mantenedoraId_fkey" TO "rdic_document_event_mantenedoraId_fkey";

-- RenameForeignKey
ALTER TABLE "rdic_document_event" RENAME CONSTRAINT "RdicDocumentEvent_unitId_fkey" TO "rdic_document_event_unitId_fkey";

-- RenameForeignKey
ALTER TABLE "recado_leitura" RENAME CONSTRAINT "RecadoLeitura_recadoId_fkey" TO "recado_leitura_recado_id_fkey";

-- RenameForeignKey
ALTER TABLE "recado_turma" RENAME CONSTRAINT "RecadoTurma_mantenedoraId_fkey" TO "recado_turma_mantenedora_id_fkey";

-- RenameForeignKey
ALTER TABLE "student_post_performance" RENAME CONSTRAINT "StudentPostPerformance_postId_fkey" TO "student_post_performance_post_id_fkey";

-- AddForeignKey
ALTER TABLE "CurriculumMatrixEntry" ADD CONSTRAINT "CurriculumMatrixEntry_frameworkObjectiveId_fkey" FOREIGN KEY ("frameworkObjectiveId") REFERENCES "FrameworkObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RDIXInstancia" ADD CONSTRAINT "RDIXInstancia_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RDIXTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_post" ADD CONSTRAINT "classroom_post_mantenedora_id_fkey" FOREIGN KEY ("mantenedora_id") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_post" ADD CONSTRAINT "classroom_post_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_post_performance" ADD CONSTRAINT "student_post_performance_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_observation" ADD CONSTRAINT "development_observation_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardapio" ADD CONSTRAINT "cardapio_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardapio" ADD CONSTRAINT "cardapio_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardapio_refeicao" ADD CONSTRAINT "cardapio_refeicao_cardapioId_fkey" FOREIGN KEY ("cardapioId") REFERENCES "cardapio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardapio_item" ADD CONSTRAINT "cardapio_item_refeicaoId_fkey" FOREIGN KEY ("refeicaoId") REFERENCES "cardapio_refeicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acompanhamento_nutricional" ADD CONSTRAINT "acompanhamento_nutricional_mantenedora_id_fkey" FOREIGN KEY ("mantenedora_id") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acompanhamento_nutricional" ADD CONSTRAINT "acompanhamento_nutricional_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_request" ADD CONSTRAINT "ia_request_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_request" ADD CONSTRAINT "ia_request_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_request" ADD CONSTRAINT "ia_request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_request" ADD CONSTRAINT "ia_request_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompt_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_response" ADD CONSTRAINT "ia_response_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ia_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_log" ADD CONSTRAINT "ia_log_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ia_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_feedback" ADD CONSTRAINT "ia_feedback_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ia_response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

