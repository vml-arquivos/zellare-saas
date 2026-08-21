-- Gate 0.2 — modelos SaaS presentes no schema canônico e ausentes do histórico
-- Estratégia: somente aditiva e idempotente; nenhuma tabela/coluna existente é removida.
-- Os modelos ficam disponíveis para ativação por feature flag após a migration.

DO $$ BEGIN
  CREATE TYPE "ContentUploadType" AS ENUM (
    'PLANO_DE_AULA',
    'PROJETO_PEDAGOGICO',
    'MATERIAL_DIDATICO',
    'CURRICULO_PROPRIO',
    'OUTRO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContentUploadStatus" AS ENUM (
    'ENVIADO',
    'PROCESSANDO',
    'PRONTO_PARA_REVISAO',
    'APROVADO',
    'REJEITADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TenantBranding" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "displayName" VARCHAR(255) NOT NULL,
  "slogan" VARCHAR(255),
  "logoUrl" TEXT,
  "faviconUrl" TEXT,
  "primaryColor" VARCHAR(7),
  "secondaryColor" VARCHAR(7),
  "customDomain" VARCHAR(255),
  "domainVerified" BOOLEAN NOT NULL DEFAULT false,
  "emailFromName" VARCHAR(255),
  "emailFromAddress" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TenantFeatureFlag" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "flagKey" VARCHAR(100) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantFeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PedagogicalFramework" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT,
  "name" VARCHAR(255) NOT NULL,
  "country" VARCHAR(2),
  "region" VARCHAR(100),
  "isOfficial" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "description" TEXT,
  "sourceUrl" VARCHAR(500),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" VARCHAR(255),
  CONSTRAINT "PedagogicalFramework_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FrameworkDimension" (
  "id" TEXT NOT NULL,
  "frameworkId" TEXT NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "FrameworkDimension_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FrameworkObjective" (
  "id" TEXT NOT NULL,
  "frameworkId" TEXT NOT NULL,
  "dimensionId" TEXT NOT NULL,
  "code" VARCHAR(20),
  "ageRangeMin" INTEGER NOT NULL,
  "ageRangeMax" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  CONSTRAINT "FrameworkObjective_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InstitutionContentUpload" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "type" "ContentUploadType" NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "status" "ContentUploadStatus" NOT NULL DEFAULT 'ENVIADO',
  "extractedData" JSONB,
  "reviewNotes" TEXT,
  "resultingPlanningTemplateId" TEXT,
  "resultingFrameworkId" TEXT,
  "uploadedBy" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" VARCHAR(255),
  CONSTRAINT "InstitutionContentUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantBranding_mantenedoraId_key"
  ON "TenantBranding"("mantenedoraId");
CREATE UNIQUE INDEX IF NOT EXISTS "TenantBranding_customDomain_key"
  ON "TenantBranding"("customDomain");
CREATE INDEX IF NOT EXISTS "TenantBranding_customDomain_idx"
  ON "TenantBranding"("customDomain");

CREATE INDEX IF NOT EXISTS "TenantFeatureFlag_mantenedoraId_idx"
  ON "TenantFeatureFlag"("mantenedoraId");
CREATE UNIQUE INDEX IF NOT EXISTS "TenantFeatureFlag_mantenedoraId_flagKey_key"
  ON "TenantFeatureFlag"("mantenedoraId", "flagKey");

CREATE INDEX IF NOT EXISTS "PedagogicalFramework_mantenedoraId_idx"
  ON "PedagogicalFramework"("mantenedoraId");
CREATE INDEX IF NOT EXISTS "PedagogicalFramework_country_idx"
  ON "PedagogicalFramework"("country");
CREATE INDEX IF NOT EXISTS "PedagogicalFramework_isActive_idx"
  ON "PedagogicalFramework"("isActive");

CREATE INDEX IF NOT EXISTS "FrameworkDimension_frameworkId_idx"
  ON "FrameworkDimension"("frameworkId");
CREATE UNIQUE INDEX IF NOT EXISTS "FrameworkDimension_frameworkId_code_key"
  ON "FrameworkDimension"("frameworkId", "code");

CREATE INDEX IF NOT EXISTS "FrameworkObjective_frameworkId_idx"
  ON "FrameworkObjective"("frameworkId");
CREATE INDEX IF NOT EXISTS "FrameworkObjective_dimensionId_idx"
  ON "FrameworkObjective"("dimensionId");
CREATE INDEX IF NOT EXISTS "FrameworkObjective_ageRangeMin_ageRangeMax_idx"
  ON "FrameworkObjective"("ageRangeMin", "ageRangeMax");

CREATE INDEX IF NOT EXISTS "InstitutionContentUpload_mantenedoraId_idx"
  ON "InstitutionContentUpload"("mantenedoraId");
CREATE INDEX IF NOT EXISTS "InstitutionContentUpload_status_idx"
  ON "InstitutionContentUpload"("status");
CREATE INDEX IF NOT EXISTS "InstitutionContentUpload_type_idx"
  ON "InstitutionContentUpload"("type");

DO $$ BEGIN
  ALTER TABLE "TenantBranding"
    ADD CONSTRAINT "TenantBranding_mantenedoraId_fkey"
    FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TenantFeatureFlag"
    ADD CONSTRAINT "TenantFeatureFlag_mantenedoraId_fkey"
    FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PedagogicalFramework"
    ADD CONSTRAINT "PedagogicalFramework_mantenedoraId_fkey"
    FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FrameworkDimension"
    ADD CONSTRAINT "FrameworkDimension_frameworkId_fkey"
    FOREIGN KEY ("frameworkId") REFERENCES "PedagogicalFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FrameworkObjective"
    ADD CONSTRAINT "FrameworkObjective_frameworkId_fkey"
    FOREIGN KEY ("frameworkId") REFERENCES "PedagogicalFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FrameworkObjective"
    ADD CONSTRAINT "FrameworkObjective_dimensionId_fkey"
    FOREIGN KEY ("dimensionId") REFERENCES "FrameworkDimension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstitutionContentUpload"
    ADD CONSTRAINT "InstitutionContentUpload_mantenedoraId_fkey"
    FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
