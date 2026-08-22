-- Onda 3 / Journey — migration exclusivamente aditiva.
-- Não remove nem reescreve tabelas históricas. Aplicar apenas em banco local/CI
-- nesta PR; não executar em produção sem autorização e plano operacional.

CREATE TYPE "JourneyStage" AS ENUM ('NOVO', 'CONTATADO', 'VISITA_AGENDADA', 'VISITA_REALIZADA', 'LISTA_ESPERA', 'VAGA_OFERECIDA', 'ACEITO', 'PERDIDO', 'ARQUIVADO');
CREATE TYPE "JourneyDuplicateReviewStatus" AS ENUM ('PENDENTE', 'CONFIRMADA', 'REJEITADA', 'DESFEITA');
CREATE TYPE "JourneyActivityType" AS ENUM ('INTERACAO', 'NOTA', 'FOLLOW_UP');
CREATE TYPE "JourneyTaskStatus" AS ENUM ('ABERTA', 'CONCLUIDA', 'CANCELADA');
CREATE TYPE "JourneyVisitStatus" AS ENUM ('AGENDADA', 'REAGENDADA', 'CANCELADA', 'REALIZADA', 'AUSENCIA');
CREATE TYPE "JourneyVisitEventType" AS ENUM ('CRIADA', 'REAGENDADA', 'CANCELADA', 'PRESENCA_CONFIRMADA', 'AUSENCIA_REGISTRADA', 'FOLLOW_UP_REGISTRADO');
CREATE TYPE "JourneyWaitlistPolicyStatus" AS ENUM ('RASCUNHO', 'PUBLICADA', 'ARQUIVADA');
CREATE TYPE "JourneyWaitlistEntryStatus" AS ENUM ('AGUARDANDO', 'OFERTADA', 'REMOVIDA');
CREATE TYPE "JourneyOfferStatus" AS ENUM ('OFERTADA', 'ACEITA', 'RECUSADA', 'EXPIRADA', 'CANCELADA');
CREATE TYPE "JourneyEnrollmentDraftStatus" AS ENUM ('INCOMPLETA', 'CANCELADA', 'CONCLUIDA');
CREATE TYPE "JourneyPrivacyEventType" AS ENUM ('CONSENT_CAPTURED', 'CONSENT_CONTACT_GRANTED', 'CONSENT_CONTACT_REVOKED', 'RETENTION_EXTENDED', 'ERASURE_REQUESTED', 'ERASURE_COMPLETED');
CREATE TYPE "JourneyProspectPrivacyStatus" AS ENUM ('ACTIVE', 'RETAINED', 'ERASURE_REQUESTED', 'ERASED');
CREATE TYPE "Onda1LegalBasis" AS ENUM ('CONSENT', 'LEGAL_OBLIGATION', 'PRE_CONTRACTUAL_STEPS', 'VITAL_INTEREST', 'PUBLIC_TASK');
ALTER TYPE "RoleType" ADD VALUE IF NOT EXISTS 'STAFF_CENTRAL_ADMISSOES';

ALTER TYPE "AuditLogEntity" ADD VALUE 'JOURNEY_PROSPECT';
ALTER TYPE "AuditLogEntity" ADD VALUE 'JOURNEY_VISIT';
ALTER TYPE "AuditLogEntity" ADD VALUE 'JOURNEY_WAITLIST';
ALTER TYPE "AuditLogEntity" ADD VALUE 'JOURNEY_OFFER';
ALTER TYPE "AuditLogEntity" ADD VALUE 'JOURNEY_MERGE';
ALTER TYPE "AuditLogEntity" ADD VALUE 'JOURNEY_ENROLLMENT_DRAFT';

CREATE TABLE "journey_prospect" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "responsibleName" VARCHAR(180) NOT NULL,
  "childName" VARCHAR(180) NOT NULL,
  "email" VARCHAR(255),
  "phone" VARCHAR(30),
  "emailHash" VARCHAR(128),
  "phoneHash" VARCHAR(128),
  "declaredIdentityType" VARCHAR(40),
  "declaredIdentityHash" VARCHAR(128),
  "emailCiphertext" TEXT,
  "phoneCiphertext" TEXT,
  "declaredIdentityCiphertext" TEXT,
  "contactHashVersion" VARCHAR(40),
  "privacyStatus" "JourneyProspectPrivacyStatus" NOT NULL DEFAULT 'ACTIVE',
  "captureLegalBasis" "Onda1LegalBasis" NOT NULL DEFAULT 'CONSENT',
  "contactLegalBasis" "Onda1LegalBasis",
  "consentPolicyVersion" VARCHAR(80) NOT NULL DEFAULT 'journey-privacy-v1',
  "consentCapturedAt" TIMESTAMP(3),
  "contactConsentAt" TIMESTAMP(3),
  "retentionUntil" TIMESTAMP(3),
  "erasedAt" TIMESTAMP(3),
  "erasedBy" VARCHAR(255),
  "source" VARCHAR(80) NOT NULL,
  "ageGroupMinMonths" INTEGER NOT NULL,
  "ageGroupMaxMonths" INTEGER NOT NULL,
  "period" VARCHAR(40) NOT NULL,
  "desiredDate" TIMESTAMP(3),
  "consentCapture" BOOLEAN NOT NULL DEFAULT false,
  "consentContact" BOOLEAN NOT NULL DEFAULT false,
  "stage" "JourneyStage" NOT NULL DEFAULT 'NOVO',
  "mergedIntoId" TEXT,
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdBy" VARCHAR(255) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journey_prospect_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_prospect_privacy_event" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "type" "JourneyPrivacyEventType" NOT NULL,
  "purpose" VARCHAR(80) NOT NULL,
  "legalBasis" "Onda1LegalBasis",
  "policyVersion" VARCHAR(80) NOT NULL,
  "reason" VARCHAR(500),
  "actorUserId" VARCHAR(255) NOT NULL,
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journey_prospect_privacy_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_prospect_stage_event" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "fromStage" "JourneyStage",
  "toStage" "JourneyStage" NOT NULL,
  "reason" VARCHAR(500),
  "actorUserId" VARCHAR(255) NOT NULL,
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journey_prospect_stage_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_activity" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "type" "JourneyActivityType" NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "note" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextAction" VARCHAR(255),
  "actorUserId" VARCHAR(255) NOT NULL,
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journey_activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_task" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "dueAt" TIMESTAMP(3),
  "assignedTo" VARCHAR(255),
  "status" "JourneyTaskStatus" NOT NULL DEFAULT 'ABERTA',
  "createdBy" VARCHAR(255) NOT NULL,
  "completedBy" VARCHAR(255),
  "completedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journey_task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_duplicate_review" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "primaryProspectId" TEXT NOT NULL,
  "duplicateProspectId" TEXT NOT NULL,
  "matchReasons" TEXT[] NOT NULL,
  "status" "JourneyDuplicateReviewStatus" NOT NULL DEFAULT 'PENDENTE',
  "previousStage" "JourneyStage",
  "reviewedBy" VARCHAR(255),
  "reviewedAt" TIMESTAMP(3),
  "undoBy" VARCHAR(255),
  "undoAt" TIMESTAMP(3),
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journey_duplicate_review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_visit" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "JourneyVisitStatus" NOT NULL DEFAULT 'AGENDADA',
  "assignedTo" VARCHAR(255),
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdBy" VARCHAR(255) NOT NULL,
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journey_visit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_visit_event" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "visitId" TEXT NOT NULL,
  "type" "JourneyVisitEventType" NOT NULL,
  "previousStartsAt" TIMESTAMP(3),
  "previousEndsAt" TIMESTAMP(3),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "note" TEXT,
  "actorUserId" VARCHAR(255) NOT NULL,
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journey_visit_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_waitlist_policy_version" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "programKey" VARCHAR(80) NOT NULL DEFAULT 'default',
  "ageGroupMinMonths" INTEGER NOT NULL,
  "ageGroupMaxMonths" INTEGER NOT NULL,
  "period" VARCHAR(40) NOT NULL,
  "version" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "status" "JourneyWaitlistPolicyStatus" NOT NULL DEFAULT 'RASCUNHO',
  "priorityDefinition" JSONB NOT NULL,
  "createdBy" VARCHAR(255) NOT NULL,
  "reviewedBy" VARCHAR(255),
  "reviewedAt" TIMESTAMP(3),
  "publishedBy" VARCHAR(255),
  "publishedAt" TIMESTAMP(3),
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journey_waitlist_policy_version_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_waitlist_entry" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "desiredDate" TIMESTAMP(3),
  "priorityScore" INTEGER NOT NULL DEFAULT 0,
  "explanation" JSONB NOT NULL,
  "status" "JourneyWaitlistEntryStatus" NOT NULL DEFAULT 'AGUARDANDO',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdBy" VARCHAR(255) NOT NULL,
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journey_waitlist_entry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_seat_offer" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "waitlistEntryId" TEXT,
  "status" "JourneyOfferStatus" NOT NULL DEFAULT 'OFERTADA',
  "reservationExpiresAt" TIMESTAMP(3) NOT NULL,
  "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "decisionReason" VARCHAR(500),
  "overrideReason" VARCHAR(500),
  "createdBy" VARCHAR(255) NOT NULL,
  "acceptedBy" VARCHAR(255),
  "version" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journey_seat_offer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_enrollment_draft" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "status" "JourneyEnrollmentDraftStatus" NOT NULL DEFAULT 'INCOMPLETA',
  "missingFields" JSONB NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdBy" VARCHAR(255) NOT NULL,
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journey_enrollment_draft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "journey_prospect_mantenedoraId_idempotencyKey_key" ON "journey_prospect"("mantenedoraId", "idempotencyKey");
CREATE UNIQUE INDEX "journey_prospect_privacy_event_mantenedoraId_idempotencyKey_key" ON "journey_prospect_privacy_event"("mantenedoraId", "idempotencyKey");
CREATE UNIQUE INDEX "journey_prospect_stage_event_mantenedoraId_idempotencyKey_key" ON "journey_prospect_stage_event"("mantenedoraId", "idempotencyKey");
CREATE UNIQUE INDEX "journey_activity_mantenedoraId_idempotencyKey_key" ON "journey_activity"("mantenedoraId", "idempotencyKey");
CREATE UNIQUE INDEX "journey_task_mantenedoraId_idempotencyKey_key" ON "journey_task"("mantenedoraId", "idempotencyKey");
CREATE UNIQUE INDEX "journey_duplicate_review_mantenedoraId_idempotencyKey_key" ON "journey_duplicate_review"("mantenedoraId", "idempotencyKey");
CREATE UNIQUE INDEX "journey_visit_mantenedoraId_idempotencyKey_key" ON "journey_visit"("mantenedoraId", "idempotencyKey");
CREATE UNIQUE INDEX "journey_visit_event_mantenedoraId_idempotencyKey_key" ON "journey_visit_event"("mantenedoraId", "idempotencyKey");
CREATE UNIQUE INDEX "journey_waitlist_entry_mantenedoraId_idempotencyKey_key" ON "journey_waitlist_entry"("mantenedoraId", "idempotencyKey");
CREATE UNIQUE INDEX "journey_seat_offer_mantenedoraId_idempotencyKey_key" ON "journey_seat_offer"("mantenedoraId", "idempotencyKey");
CREATE UNIQUE INDEX "journey_enrollment_draft_mantenedoraId_idempotencyKey_key" ON "journey_enrollment_draft"("mantenedoraId", "idempotencyKey");
CREATE UNIQUE INDEX "journey_duplicate_review_primaryProspectId_duplicateProspec_key" ON "journey_duplicate_review"("primaryProspectId", "duplicateProspectId");
CREATE UNIQUE INDEX "journey_waitlist_policy_version_unitId_programKey_version_key" ON "journey_waitlist_policy_version"("unitId", "programKey", "version");
CREATE UNIQUE INDEX "journey_waitlist_policy_version_mantenedoraId_idempotencyKe_key" ON "journey_waitlist_policy_version"("mantenedoraId", "idempotencyKey");
CREATE UNIQUE INDEX "journey_enrollment_draft_offerId_key" ON "journey_enrollment_draft"("offerId");

CREATE INDEX "journey_prospect_mantenedoraId_unitId_stage_idx" ON "journey_prospect"("mantenedoraId", "unitId", "stage");
CREATE INDEX "journey_prospect_mantenedoraId_emailHash_idx" ON "journey_prospect"("mantenedoraId", "emailHash");
CREATE INDEX "journey_prospect_mantenedoraId_phoneHash_idx" ON "journey_prospect"("mantenedoraId", "phoneHash");
CREATE INDEX "journey_prospect_mantenedoraId_declaredIdentityHash_idx" ON "journey_prospect"("mantenedoraId", "declaredIdentityHash");
CREATE INDEX "journey_prospect_mantenedoraId_contactHashVersion_idx" ON "journey_prospect"("mantenedoraId", "contactHashVersion");
CREATE INDEX "journey_prospect_mantenedoraId_privacyStatus_retentionUntil_idx" ON "journey_prospect"("mantenedoraId", "privacyStatus", "retentionUntil");
CREATE INDEX "journey_prospect_privacy_event_mantenedoraId_unitId_prospec_idx" ON "journey_prospect_privacy_event"("mantenedoraId", "unitId", "prospectId", "createdAt");
CREATE INDEX "journey_prospect_privacy_event_prospectId_type_createdAt_idx" ON "journey_prospect_privacy_event"("prospectId", "type", "createdAt");
CREATE INDEX "journey_prospect_unitId_desiredDate_idx" ON "journey_prospect"("unitId", "desiredDate");
CREATE INDEX "journey_prospect_stage_event_mantenedoraId_unitId_createdAt_idx" ON "journey_prospect_stage_event"("mantenedoraId", "unitId", "createdAt");
CREATE INDEX "journey_prospect_stage_event_prospectId_createdAt_idx" ON "journey_prospect_stage_event"("prospectId", "createdAt");
CREATE INDEX "journey_activity_mantenedoraId_unitId_occurredAt_idx" ON "journey_activity"("mantenedoraId", "unitId", "occurredAt");
CREATE INDEX "journey_activity_prospectId_occurredAt_idx" ON "journey_activity"("prospectId", "occurredAt");
CREATE INDEX "journey_task_mantenedoraId_unitId_status_dueAt_idx" ON "journey_task"("mantenedoraId", "unitId", "status", "dueAt");
CREATE INDEX "journey_task_prospectId_status_idx" ON "journey_task"("prospectId", "status");
CREATE INDEX "journey_duplicate_review_mantenedoraId_status_idx" ON "journey_duplicate_review"("mantenedoraId", "status");
CREATE INDEX "journey_visit_mantenedoraId_unitId_startsAt_idx" ON "journey_visit"("mantenedoraId", "unitId", "startsAt");
CREATE INDEX "journey_visit_prospectId_startsAt_idx" ON "journey_visit"("prospectId", "startsAt");
CREATE INDEX "journey_visit_event_mantenedoraId_unitId_createdAt_idx" ON "journey_visit_event"("mantenedoraId", "unitId", "createdAt");
CREATE INDEX "journey_visit_event_visitId_createdAt_idx" ON "journey_visit_event"("visitId", "createdAt");
CREATE INDEX "journey_waitlist_policy_version_mantenedoraId_unitId_status_idx" ON "journey_waitlist_policy_version"("mantenedoraId", "unitId", "status", "effectiveFrom");
CREATE INDEX "journey_waitlist_policy_version_unitId_period_ageGroupMinMo_idx" ON "journey_waitlist_policy_version"("unitId", "period", "ageGroupMinMonths", "ageGroupMaxMonths");
CREATE INDEX "journey_waitlist_entry_mantenedoraId_unitId_status_priority_idx" ON "journey_waitlist_entry"("mantenedoraId", "unitId", "status", "priorityScore");
CREATE INDEX "journey_waitlist_entry_prospectId_status_idx" ON "journey_waitlist_entry"("prospectId", "status");
CREATE INDEX "journey_waitlist_entry_policyId_status_idx" ON "journey_waitlist_entry"("policyId", "status");
CREATE INDEX "journey_seat_offer_mantenedoraId_unitId_status_reservationE_idx" ON "journey_seat_offer"("mantenedoraId", "unitId", "status", "reservationExpiresAt");
CREATE INDEX "journey_seat_offer_classroomId_status_reservationExpiresAt_idx" ON "journey_seat_offer"("classroomId", "status", "reservationExpiresAt");
CREATE INDEX "journey_seat_offer_prospectId_status_idx" ON "journey_seat_offer"("prospectId", "status");
CREATE INDEX "journey_enrollment_draft_mantenedoraId_unitId_status_idx" ON "journey_enrollment_draft"("mantenedoraId", "unitId", "status");
CREATE INDEX "journey_enrollment_draft_prospectId_status_idx" ON "journey_enrollment_draft"("prospectId", "status");

ALTER TABLE "journey_prospect" ADD CONSTRAINT "journey_prospect_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_prospect" ADD CONSTRAINT "journey_prospect_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_prospect" ADD CONSTRAINT "journey_prospect_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "journey_prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journey_prospect_privacy_event" ADD CONSTRAINT "journey_prospect_privacy_event_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_prospect_privacy_event" ADD CONSTRAINT "journey_prospect_privacy_event_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_prospect_privacy_event" ADD CONSTRAINT "journey_prospect_privacy_event_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "journey_prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_prospect_stage_event" ADD CONSTRAINT "journey_prospect_stage_event_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_prospect_stage_event" ADD CONSTRAINT "journey_prospect_stage_event_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_prospect_stage_event" ADD CONSTRAINT "journey_prospect_stage_event_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "journey_prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_activity" ADD CONSTRAINT "journey_activity_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_activity" ADD CONSTRAINT "journey_activity_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_activity" ADD CONSTRAINT "journey_activity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "journey_prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_task" ADD CONSTRAINT "journey_task_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_task" ADD CONSTRAINT "journey_task_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_task" ADD CONSTRAINT "journey_task_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "journey_prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_duplicate_review" ADD CONSTRAINT "journey_duplicate_review_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_duplicate_review" ADD CONSTRAINT "journey_duplicate_review_primaryProspectId_fkey" FOREIGN KEY ("primaryProspectId") REFERENCES "journey_prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_duplicate_review" ADD CONSTRAINT "journey_duplicate_review_duplicateProspectId_fkey" FOREIGN KEY ("duplicateProspectId") REFERENCES "journey_prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_visit" ADD CONSTRAINT "journey_visit_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_visit" ADD CONSTRAINT "journey_visit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_visit" ADD CONSTRAINT "journey_visit_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "journey_prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_visit_event" ADD CONSTRAINT "journey_visit_event_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_visit_event" ADD CONSTRAINT "journey_visit_event_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_visit_event" ADD CONSTRAINT "journey_visit_event_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "journey_visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_waitlist_policy_version" ADD CONSTRAINT "journey_waitlist_policy_version_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_waitlist_policy_version" ADD CONSTRAINT "journey_waitlist_policy_version_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_waitlist_entry" ADD CONSTRAINT "journey_waitlist_entry_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_waitlist_entry" ADD CONSTRAINT "journey_waitlist_entry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_waitlist_entry" ADD CONSTRAINT "journey_waitlist_entry_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "journey_prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_waitlist_entry" ADD CONSTRAINT "journey_waitlist_entry_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "journey_waitlist_policy_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journey_seat_offer" ADD CONSTRAINT "journey_seat_offer_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_seat_offer" ADD CONSTRAINT "journey_seat_offer_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_seat_offer" ADD CONSTRAINT "journey_seat_offer_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "journey_prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_seat_offer" ADD CONSTRAINT "journey_seat_offer_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journey_seat_offer" ADD CONSTRAINT "journey_seat_offer_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "journey_waitlist_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journey_enrollment_draft" ADD CONSTRAINT "journey_enrollment_draft_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_enrollment_draft" ADD CONSTRAINT "journey_enrollment_draft_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_enrollment_draft" ADD CONSTRAINT "journey_enrollment_draft_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "journey_prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_enrollment_draft" ADD CONSTRAINT "journey_enrollment_draft_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "journey_seat_offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "child_guardian" ADD COLUMN "legalBasis" "Onda1LegalBasis" NOT NULL DEFAULT 'CONSENT';
ALTER TABLE "child_guardian" ADD COLUMN "consentPolicyVersion" VARCHAR(80) NOT NULL DEFAULT 'family-link-v1';
ALTER TABLE "child_guardian" ADD COLUMN "retentionUntil" TIMESTAMP(3);
ALTER TABLE "child_guardian" ADD COLUMN "revocationReason" VARCHAR(500);
ALTER TABLE "consent_grant" ADD COLUMN "legalBasis" "Onda1LegalBasis" NOT NULL DEFAULT 'CONSENT';
