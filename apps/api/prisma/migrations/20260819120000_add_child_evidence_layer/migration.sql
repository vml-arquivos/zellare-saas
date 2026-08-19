-- Camada unificada de evidências da criança.
-- A migration é aditiva: não altera nem remove dados das fontes existentes.

CREATE TYPE "EvidenceSensitivity" AS ENUM ('ORDINARIA', 'SENSIVEL', 'SAUDE', 'PSICOLOGICA', 'FAMILIAR');
CREATE TYPE "EvidenceVisibility" AS ENUM ('INTERNA', 'PEDAGOGICA', 'GESTAO', 'FAMILIA_AUTORIZADA', 'RESTRITA');
CREATE TYPE "EvidenceReviewStatus" AS ENUM ('NAO_REVISADA', 'EM_REVISAO', 'REVISADA', 'REJEITADA', 'ARQUIVADA');

CREATE TABLE "ChildEvidence" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "classroomId" TEXT,
    "childId" TEXT NOT NULL,
    "sourceType" VARCHAR(80) NOT NULL,
    "sourceId" VARCHAR(255) NOT NULL,
    "sourceVersion" INTEGER,
    "evidenceType" VARCHAR(80) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "capturedBy" VARCHAR(255),
    "content" TEXT,
    "structuredData" JSONB,
    "tags" JSONB,
    "sensitivity" "EvidenceSensitivity" NOT NULL DEFAULT 'ORDINARIA',
    "visibility" "EvidenceVisibility" NOT NULL DEFAULT 'PEDAGOGICA',
    "reviewStatus" "EvidenceReviewStatus" NOT NULL DEFAULT 'NAO_REVISADA',
    "reviewedBy" VARCHAR(255),
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChildEvidence_sourceType_sourceId_childId_key"
  ON "ChildEvidence"("sourceType", "sourceId", "childId");
CREATE INDEX "ChildEvidence_mantenedoraId_unitId_idx"
  ON "ChildEvidence"("mantenedoraId", "unitId");
CREATE INDEX "ChildEvidence_childId_capturedAt_idx"
  ON "ChildEvidence"("childId", "capturedAt" DESC);
CREATE INDEX "ChildEvidence_classroomId_capturedAt_idx"
  ON "ChildEvidence"("classroomId", "capturedAt" DESC);
CREATE INDEX "ChildEvidence_sourceType_sourceId_idx"
  ON "ChildEvidence"("sourceType", "sourceId");
CREATE INDEX "ChildEvidence_evidenceType_capturedAt_idx"
  ON "ChildEvidence"("evidenceType", "capturedAt" DESC);
CREATE INDEX "ChildEvidence_sensitivity_visibility_idx"
  ON "ChildEvidence"("sensitivity", "visibility");
CREATE INDEX "ChildEvidence_reviewStatus_idx"
  ON "ChildEvidence"("reviewStatus");

ALTER TABLE "ChildEvidence"
  ADD CONSTRAINT "ChildEvidence_mantenedoraId_fkey"
  FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChildEvidence"
  ADD CONSTRAINT "ChildEvidence_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChildEvidence"
  ADD CONSTRAINT "ChildEvidence_classroomId_fkey"
  FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChildEvidence"
  ADD CONSTRAINT "ChildEvidence_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChildEvidence"
  ADD CONSTRAINT "ChildEvidence_capturedBy_fkey"
  FOREIGN KEY ("capturedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChildEvidence"
  ADD CONSTRAINT "ChildEvidence_reviewedBy_fkey"
  FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
