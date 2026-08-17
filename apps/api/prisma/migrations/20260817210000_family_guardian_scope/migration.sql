-- Escopo familiar aditivo: não remove dados nem altera registros existentes.
ALTER TYPE "RoleLevel" ADD VALUE IF NOT EXISTS 'FAMILIA';
ALTER TYPE "RoleType" ADD VALUE IF NOT EXISTS 'FAMILIA_RESPONSAVEL';

CREATE TABLE IF NOT EXISTS "child_guardian" (
  "id" TEXT NOT NULL,
  "childId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "relationship" VARCHAR(80) NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "canViewTimeline" BOOLEAN NOT NULL DEFAULT true,
  "canViewDevelopment" BOOLEAN NOT NULL DEFAULT false,
  "canViewHealth" BOOLEAN NOT NULL DEFAULT false,
  "consentAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "child_guardian_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "child_guardian_childId_userId_key"
  ON "child_guardian"("childId", "userId");
CREATE INDEX IF NOT EXISTS "child_guardian_childId_idx" ON "child_guardian"("childId");
CREATE INDEX IF NOT EXISTS "child_guardian_userId_idx" ON "child_guardian"("userId");
CREATE INDEX IF NOT EXISTS "child_guardian_revokedAt_idx" ON "child_guardian"("revokedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'child_guardian_childId_fkey'
  ) THEN
    ALTER TABLE "child_guardian"
      ADD CONSTRAINT "child_guardian_childId_fkey"
      FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'child_guardian_userId_fkey'
  ) THEN
    ALTER TABLE "child_guardian"
      ADD CONSTRAINT "child_guardian_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FamilyCommunicationStatus') THEN
    CREATE TYPE "FamilyCommunicationStatus" AS ENUM ('ENVIADA', 'LIDA', 'RESPONDIDA', 'ARQUIVADA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "family_communication" (
  "id" TEXT NOT NULL,
  "mantenedoraId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "childId" TEXT NOT NULL,
  "senderUserId" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "subject" VARCHAR(255) NOT NULL,
  "body" TEXT NOT NULL,
  "status" "FamilyCommunicationStatus" NOT NULL DEFAULT 'ENVIADA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "family_communication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "family_communication_mantenedoraId_idx" ON "family_communication"("mantenedoraId");
CREATE INDEX IF NOT EXISTS "family_communication_unitId_idx" ON "family_communication"("unitId");
CREATE INDEX IF NOT EXISTS "family_communication_childId_createdAt_idx" ON "family_communication"("childId", "createdAt");
CREATE INDEX IF NOT EXISTS "family_communication_senderUserId_idx" ON "family_communication"("senderUserId");
CREATE INDEX IF NOT EXISTS "family_communication_recipientUserId_idx" ON "family_communication"("recipientUserId");
CREATE INDEX IF NOT EXISTS "family_communication_status_idx" ON "family_communication"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_communication_childId_fkey') THEN
    ALTER TABLE "family_communication"
      ADD CONSTRAINT "family_communication_childId_fkey"
      FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_communication_senderUserId_fkey') THEN
    ALTER TABLE "family_communication"
      ADD CONSTRAINT "family_communication_senderUserId_fkey"
      FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_communication_recipientUserId_fkey') THEN
    ALTER TABLE "family_communication"
      ADD CONSTRAINT "family_communication_recipientUserId_fkey"
      FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
