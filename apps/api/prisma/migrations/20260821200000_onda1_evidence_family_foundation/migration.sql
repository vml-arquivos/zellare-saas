-- CreateEnum
CREATE TYPE "Onda1ReviewTaskStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_REVIEW', 'NEEDS_CONTEXT', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Onda1ReviewPriority" AS ENUM ('NORMAL', 'IMPORTANTE', 'URGENTE');

-- CreateEnum
CREATE TYPE "Onda1GoalType" AS ENUM ('PEDAGOGICO', 'CUIDADO');

-- CreateEnum
CREATE TYPE "Onda1GoalStatus" AS ENUM ('ATIVO', 'EM_PAUSA', 'ALCANCADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "Onda1SupportStatus" AS ENUM ('PLANEJADO', 'EXECUTADO', 'REVISADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "Onda1ConversationStatus" AS ENUM ('ABERTA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "Onda1MessageStatus" AS ENUM ('ENVIADA', 'ENTREGUE', 'LIDA', 'CORRIGIDA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "Onda1MessagePriority" AS ENUM ('NORMAL', 'IMPORTANTE');

-- CreateEnum
CREATE TYPE "Onda1ContributionType" AS ENUM ('CONTEXTO_CASA', 'INTERESSE', 'ROTINA', 'RESPOSTA_SUPORTE', 'ASPIRACAO', 'COMENTARIO_PUBLICACAO');

-- CreateEnum
CREATE TYPE "Onda1ConsentPurpose" AS ENUM ('VINCULO_ACESSO', 'DESENVOLVIMENTO', 'SAUDE_CUIDADO', 'MIDIA_IMAGEM', 'COMUNICACAO', 'TRADUCAO_IA_EXTERNA', 'ANALYTICS_PESQUISA');

-- CreateEnum
CREATE TYPE "Onda1ConsentDecision" AS ENUM ('CONCEDIDO', 'RECUSADO', 'REVOGADO');

-- CreateEnum
CREATE TYPE "Onda1PublicationStatus" AS ENUM ('RASCUNHO', 'PUBLICADA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "Onda1AttachmentStatus" AS ENUM ('PENDENTE', 'PRONTA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "Onda1OutboxStatus" AS ENUM ('PENDENTE', 'PROCESSANDO', 'PUBLICADO', 'FALHOU');

-- CreateTable
CREATE TABLE "evidence_review_task" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "assignedTo" VARCHAR(255),
    "createdBy" VARCHAR(255) NOT NULL,
    "resolvedBy" VARCHAR(255),
    "status" "Onda1ReviewTaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Onda1ReviewPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestNote" TEXT,
    "decisionNote" TEXT,
    "actionTaken" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_review_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_link" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "targetType" VARCHAR(60) NOT NULL,
    "targetId" VARCHAR(255) NOT NULL,
    "relationType" VARCHAR(60) NOT NULL,
    "context" JSONB,
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_goal" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "goalType" "Onda1GoalType" NOT NULL DEFAULT 'PEDAGOGICO',
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "frameworkId" VARCHAR(255),
    "frameworkObjectiveId" VARCHAR(255),
    "criteria" JSONB,
    "status" "Onda1GoalStatus" NOT NULL DEFAULT 'ATIVO',
    "familyVisible" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdBy" VARCHAR(255) NOT NULL,
    "closedBy" VARCHAR(255),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_action" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "action" TEXT NOT NULL,
    "context" TEXT,
    "executor" VARCHAR(255) NOT NULL,
    "observedResponse" TEXT,
    "status" "Onda1SupportStatus" NOT NULL DEFAULT 'PLANEJADO',
    "attemptedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" VARCHAR(255),
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_conversation" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "status" "Onda1ConversationStatus" NOT NULL DEFAULT 'ABERTA',
    "priority" "Onda1MessagePriority" NOT NULL DEFAULT 'NORMAL',
    "createdBy" VARCHAR(255) NOT NULL,
    "closedBy" VARCHAR(255),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_message_v2" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "Onda1MessageStatus" NOT NULL DEFAULT 'ENVIADA',
    "priority" "Onda1MessagePriority" NOT NULL DEFAULT 'NORMAL',
    "clientMutationId" VARCHAR(120),
    "version" INTEGER NOT NULL DEFAULT 1,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_message_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_attachment" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "publicationId" TEXT,
    "storageKey" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" VARCHAR(128),
    "status" "Onda1AttachmentStatus" NOT NULL DEFAULT 'PENDENTE',
    "metadata" JSONB,
    "createdBy" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_contribution" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "authorUserId" VARCHAR(255) NOT NULL,
    "contributionType" "Onda1ContributionType" NOT NULL,
    "content" TEXT NOT NULL,
    "structuredData" JSONB,
    "visibility" "EvidenceVisibility" NOT NULL DEFAULT 'FAMILIA_AUTORIZADA',
    "status" "Onda1ReviewTaskStatus" NOT NULL DEFAULT 'OPEN',
    "goalId" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_grant" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "responsibleUserId" VARCHAR(255) NOT NULL,
    "purpose" "Onda1ConsentPurpose" NOT NULL,
    "decision" "Onda1ConsentDecision" NOT NULL,
    "policyVersion" VARCHAR(80) NOT NULL,
    "textPresented" TEXT NOT NULL,
    "origin" VARCHAR(80) NOT NULL,
    "proof" JSONB,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_record" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "sourceType" VARCHAR(80) NOT NULL,
    "sourceId" VARCHAR(255) NOT NULL,
    "audienceType" VARCHAR(80) NOT NULL,
    "audienceUserId" VARCHAR(255),
    "snapshot" JSONB NOT NULL,
    "sensitivity" "EvidenceSensitivity" NOT NULL DEFAULT 'ORDINARIA',
    "consentGrantId" TEXT,
    "status" "Onda1PublicationStatus" NOT NULL DEFAULT 'RASCUNHO',
    "createdBy" VARCHAR(255) NOT NULL,
    "reviewedBy" VARCHAR(255),
    "publishedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publication_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acknowledgment" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "recordType" VARCHAR(60) NOT NULL,
    "recordId" VARCHAR(255) NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "kind" VARCHAR(60) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_preference" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "locale" VARCHAR(20) NOT NULL DEFAULT 'pt-BR',
    "channels" JSONB,
    "quietHoursStart" VARCHAR(5),
    "quietHoursEnd" VARCHAR(5),
    "importantAlerts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_outbox_event" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "aggregateType" VARCHAR(80) NOT NULL,
    "aggregateId" VARCHAR(255) NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "correlationId" VARCHAR(120),
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "Onda1OutboxStatus" NOT NULL DEFAULT 'PENDENTE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidence_review_task_mantenedoraId_unitId_status_idx" ON "evidence_review_task"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "evidence_review_task_childId_status_dueAt_idx" ON "evidence_review_task"("childId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "evidence_review_task_evidenceId_idx" ON "evidence_review_task"("evidenceId");

-- CreateIndex
CREATE INDEX "evidence_review_task_assignedTo_status_idx" ON "evidence_review_task"("assignedTo", "status");

-- CreateIndex
CREATE INDEX "evidence_link_mantenedoraId_unitId_childId_idx" ON "evidence_link"("mantenedoraId", "unitId", "childId");

-- CreateIndex
CREATE INDEX "evidence_link_targetType_targetId_idx" ON "evidence_link"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "evidence_link_evidenceId_createdAt_idx" ON "evidence_link"("evidenceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_link_evidenceId_targetType_targetId_relationType_key" ON "evidence_link"("evidenceId", "targetType", "targetId", "relationType");

-- CreateIndex
CREATE INDEX "child_goal_mantenedoraId_unitId_status_idx" ON "child_goal"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "child_goal_childId_status_startDate_idx" ON "child_goal"("childId", "status", "startDate");

-- CreateIndex
CREATE INDEX "child_goal_frameworkId_frameworkObjectiveId_idx" ON "child_goal"("frameworkId", "frameworkObjectiveId");

-- CreateIndex
CREATE INDEX "support_action_mantenedoraId_unitId_status_idx" ON "support_action"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "support_action_childId_goalId_attemptedAt_idx" ON "support_action"("childId", "goalId", "attemptedAt");

-- CreateIndex
CREATE INDEX "support_action_evidenceId_idx" ON "support_action"("evidenceId");

-- CreateIndex
CREATE INDEX "family_conversation_mantenedoraId_unitId_status_idx" ON "family_conversation"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "family_conversation_childId_updatedAt_idx" ON "family_conversation"("childId", "updatedAt");

-- CreateIndex
CREATE INDEX "family_message_v2_conversationId_createdAt_idx" ON "family_message_v2"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "family_message_v2_senderUserId_createdAt_idx" ON "family_message_v2"("senderUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "family_message_v2_conversationId_clientMutationId_key" ON "family_message_v2"("conversationId", "clientMutationId");

-- CreateIndex
CREATE INDEX "family_attachment_mantenedoraId_unitId_childId_idx" ON "family_attachment"("mantenedoraId", "unitId", "childId");

-- CreateIndex
CREATE INDEX "family_attachment_conversationId_idx" ON "family_attachment"("conversationId");

-- CreateIndex
CREATE INDEX "family_attachment_publicationId_idx" ON "family_attachment"("publicationId");

-- CreateIndex
CREATE INDEX "family_contribution_mantenedoraId_unitId_status_idx" ON "family_contribution"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "family_contribution_childId_createdAt_idx" ON "family_contribution"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "family_contribution_authorUserId_createdAt_idx" ON "family_contribution"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "consent_grant_mantenedoraId_unitId_purpose_decision_idx" ON "consent_grant"("mantenedoraId", "unitId", "purpose", "decision");

-- CreateIndex
CREATE INDEX "consent_grant_childId_responsibleUserId_purpose_decidedAt_idx" ON "consent_grant"("childId", "responsibleUserId", "purpose", "decidedAt");

-- CreateIndex
CREATE INDEX "publication_record_mantenedoraId_unitId_status_idx" ON "publication_record"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "publication_record_childId_publishedAt_idx" ON "publication_record"("childId", "publishedAt");

-- CreateIndex
CREATE INDEX "publication_record_sourceType_sourceId_idx" ON "publication_record"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "publication_record_audienceUserId_status_idx" ON "publication_record"("audienceUserId", "status");

-- CreateIndex
CREATE INDEX "acknowledgment_mantenedoraId_unitId_childId_idx" ON "acknowledgment"("mantenedoraId", "unitId", "childId");

-- CreateIndex
CREATE INDEX "acknowledgment_userId_acknowledgedAt_idx" ON "acknowledgment"("userId", "acknowledgedAt");

-- CreateIndex
CREATE UNIQUE INDEX "acknowledgment_recordType_recordId_userId_kind_key" ON "acknowledgment"("recordType", "recordId", "userId", "kind");

-- CreateIndex
CREATE INDEX "communication_preference_userId_idx" ON "communication_preference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "communication_preference_mantenedoraId_userId_key" ON "communication_preference"("mantenedoraId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "domain_outbox_event_idempotencyKey_key" ON "domain_outbox_event"("idempotencyKey");

-- CreateIndex
CREATE INDEX "domain_outbox_event_status_availableAt_idx" ON "domain_outbox_event"("status", "availableAt");

-- CreateIndex
CREATE INDEX "domain_outbox_event_mantenedoraId_eventType_createdAt_idx" ON "domain_outbox_event"("mantenedoraId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "domain_outbox_event_aggregateType_aggregateId_idx" ON "domain_outbox_event"("aggregateType", "aggregateId");

-- AddForeignKey
ALTER TABLE "evidence_review_task" ADD CONSTRAINT "evidence_review_task_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_review_task" ADD CONSTRAINT "evidence_review_task_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_review_task" ADD CONSTRAINT "evidence_review_task_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_review_task" ADD CONSTRAINT "evidence_review_task_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "ChildEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_link" ADD CONSTRAINT "evidence_link_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_link" ADD CONSTRAINT "evidence_link_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_link" ADD CONSTRAINT "evidence_link_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_link" ADD CONSTRAINT "evidence_link_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "ChildEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_goal" ADD CONSTRAINT "child_goal_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_goal" ADD CONSTRAINT "child_goal_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_goal" ADD CONSTRAINT "child_goal_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_action" ADD CONSTRAINT "support_action_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_action" ADD CONSTRAINT "support_action_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_action" ADD CONSTRAINT "support_action_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_action" ADD CONSTRAINT "support_action_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "child_goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_action" ADD CONSTRAINT "support_action_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "ChildEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_conversation" ADD CONSTRAINT "family_conversation_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_conversation" ADD CONSTRAINT "family_conversation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_conversation" ADD CONSTRAINT "family_conversation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_message_v2" ADD CONSTRAINT "family_message_v2_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "family_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_attachment" ADD CONSTRAINT "family_attachment_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_attachment" ADD CONSTRAINT "family_attachment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_attachment" ADD CONSTRAINT "family_attachment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_attachment" ADD CONSTRAINT "family_attachment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "family_conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_contribution" ADD CONSTRAINT "family_contribution_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_contribution" ADD CONSTRAINT "family_contribution_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_contribution" ADD CONSTRAINT "family_contribution_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_grant" ADD CONSTRAINT "consent_grant_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_grant" ADD CONSTRAINT "consent_grant_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_grant" ADD CONSTRAINT "consent_grant_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_record" ADD CONSTRAINT "publication_record_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_record" ADD CONSTRAINT "publication_record_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_record" ADD CONSTRAINT "publication_record_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acknowledgment" ADD CONSTRAINT "acknowledgment_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acknowledgment" ADD CONSTRAINT "acknowledgment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acknowledgment" ADD CONSTRAINT "acknowledgment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_preference" ADD CONSTRAINT "communication_preference_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_outbox_event" ADD CONSTRAINT "domain_outbox_event_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
