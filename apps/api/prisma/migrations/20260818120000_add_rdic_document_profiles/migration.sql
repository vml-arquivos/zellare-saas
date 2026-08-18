-- Onda RDIC oficial parametrizável
-- Estratégia: somente aditiva, idempotente e sem remoção/limpeza de dados.

ALTER TYPE "StatusRDIX" ADD VALUE IF NOT EXISTS 'ARQUIVADO';

DO $$ BEGIN
  CREATE TYPE "RdicInstitutionType" AS ENUM ('PUBLICA', 'PRIVADA', 'REDE_PUBLICA', 'OUTRA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RdicProfileStatus" AS ENUM ('RASCUNHO', 'ATIVO', 'ARQUIVADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RdicDocumentEventType" AS ENUM (
    'CRIADO', 'ATUALIZADO', 'ENVIADO_REVISAO', 'DEVOLVIDO', 'APROVADO',
    'FINALIZADO', 'PUBLICADO', 'CIENCIA_FAMILIA', 'ARQUIVADO', 'EXPORTADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "AuditLogEntity" ADD VALUE IF NOT EXISTS 'RDIC_PROFILE';
ALTER TYPE "AuditLogEntity" ADD VALUE IF NOT EXISTS 'RDIX_TEMPLATE';
ALTER TYPE "AuditLogEntity" ADD VALUE IF NOT EXISTS 'RDIX_INSTANCE';

CREATE TABLE IF NOT EXISTS "RdicDocumentProfile" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT,
  "code" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "documentLabel" VARCHAR(255) NOT NULL,
  "institutionType" "RdicInstitutionType" NOT NULL,
  "authorityName" VARCHAR(255),
  "authorityReference" VARCHAR(255),
  "curriculumReference" VARCHAR(255),
  "sourceUrl" VARCHAR(500),
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "RdicProfileStatus" NOT NULL DEFAULT 'ATIVO',
  "isCurated" BOOLEAN NOT NULL DEFAULT false,
  "periodicity" VARCHAR(50) NOT NULL,
  "requiredFields" JSONB NOT NULL DEFAULT '[]',
  "signaturePolicy" JSONB NOT NULL DEFAULT '{}',
  "familyPolicy" JSONB NOT NULL DEFAULT '{}',
  "archivePolicy" JSONB NOT NULL DEFAULT '{}',
  "templateSchema" JSONB NOT NULL DEFAULT '{}',
  "createdById" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RdicDocumentProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RdicDocumentProfile_mantenedoraId_code_version_key"
  ON "RdicDocumentProfile" ("mantenedoraId", "code", "version");
CREATE INDEX IF NOT EXISTS "RdicDocumentProfile_mantenedoraId_idx"
  ON "RdicDocumentProfile" ("mantenedoraId");
CREATE INDEX IF NOT EXISTS "RdicDocumentProfile_institutionType_idx"
  ON "RdicDocumentProfile" ("institutionType");
CREATE INDEX IF NOT EXISTS "RdicDocumentProfile_status_idx"
  ON "RdicDocumentProfile" ("status");
CREATE INDEX IF NOT EXISTS "RdicDocumentProfile_isCurated_idx"
  ON "RdicDocumentProfile" ("isCurated");

DO $$ BEGIN
  ALTER TABLE "RdicDocumentProfile"
    ADD CONSTRAINT "RdicDocumentProfile_mantenedoraId_fkey"
    FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Mantenedora"
  ADD COLUMN IF NOT EXISTS "defaultRdicProfileId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Mantenedora_defaultRdicProfileId_key"
  ON "Mantenedora" ("defaultRdicProfileId");
DO $$ BEGIN
  ALTER TABLE "Mantenedora"
    ADD CONSTRAINT "Mantenedora_defaultRdicProfileId_fkey"
    FOREIGN KEY ("defaultRdicProfileId") REFERENCES "RdicDocumentProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Unit"
  ADD COLUMN IF NOT EXISTS "rdicProfileId" TEXT;
CREATE INDEX IF NOT EXISTS "Unit_rdicProfileId_idx" ON "Unit" ("rdicProfileId");
DO $$ BEGIN
  ALTER TABLE "Unit"
    ADD CONSTRAINT "Unit_rdicProfileId_fkey"
    FOREIGN KEY ("rdicProfileId") REFERENCES "RdicDocumentProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "RDIXTemplate"
  ADD COLUMN IF NOT EXISTS "profileId" TEXT,
  ADD COLUMN IF NOT EXISTS "profileVersion" INTEGER;
CREATE INDEX IF NOT EXISTS "RDIXTemplate_profileId_idx" ON "RDIXTemplate" ("profileId");
DO $$ BEGIN
  ALTER TABLE "RDIXTemplate"
    ADD CONSTRAINT "RDIXTemplate_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "RdicDocumentProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "RDIXInstancia"
  ADD COLUMN IF NOT EXISTS "profileId" TEXT,
  ADD COLUMN IF NOT EXISTS "profileVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "profileSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "signatureManifest" JSONB,
  ADD COLUMN IF NOT EXISTS "familyAcknowledgedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "familyAcknowledgedById" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedById" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "documentHash" VARCHAR(128);
CREATE INDEX IF NOT EXISTS "RDIXInstancia_profileId_idx" ON "RDIXInstancia" ("profileId");
DO $$ BEGIN
  ALTER TABLE "RDIXInstancia"
    ADD CONSTRAINT "RDIXInstancia_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "RdicDocumentProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "rdic_document_event" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT,
  "instanciaId" TEXT NOT NULL,
  "actorId" VARCHAR(255) NOT NULL,
  "eventType" "RdicDocumentEventType" NOT NULL,
  "fromStatus" "StatusRDIX",
  "toStatus" "StatusRDIX",
  "comment" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RdicDocumentEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RdicDocumentEvent_mantenedoraId_createdAt_idx"
  ON "rdic_document_event" ("mantenedoraId", "createdAt");
CREATE INDEX IF NOT EXISTS "RdicDocumentEvent_unitId_createdAt_idx"
  ON "rdic_document_event" ("unitId", "createdAt");
CREATE INDEX IF NOT EXISTS "RdicDocumentEvent_instanciaId_createdAt_idx"
  ON "rdic_document_event" ("instanciaId", "createdAt");
CREATE INDEX IF NOT EXISTS "RdicDocumentEvent_eventType_idx"
  ON "rdic_document_event" ("eventType");
DO $$ BEGIN
  ALTER TABLE "rdic_document_event"
    ADD CONSTRAINT "RdicDocumentEvent_mantenedoraId_fkey"
    FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "rdic_document_event"
    ADD CONSTRAINT "RdicDocumentEvent_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "rdic_document_event"
    ADD CONSTRAINT "RdicDocumentEvent_instanciaId_fkey"
    FOREIGN KEY ("instanciaId") REFERENCES "RDIXInstancia"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
