-- CreateEnum
CREATE TYPE "Onda2PresenceSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'RECONCILING');

-- CreateEnum
CREATE TYPE "Onda2PresenceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'MOVE', 'CORRECTION');

-- CreateEnum
CREATE TYPE "Onda2PresenceEventStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'RECONCILED', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "Onda2AssignmentStatus" AS ENUM ('DRAFT', 'PROPOSED', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Onda2SubstitutionStatus" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Onda2ApprovalStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "Onda2RatioState" AS ENUM ('UNKNOWN', 'COMPLIANT', 'ATTENTION', 'VIOLATION');

-- CreateEnum
CREATE TYPE "Onda2BreachStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "Onda2SpaceStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'BLOCKED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Onda2AssetStatus" AS ENUM ('OPERATIONAL', 'LIMITED', 'OUT_OF_SERVICE', 'RETIRED');

-- CreateEnum
CREATE TYPE "Onda2Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Onda2MaintenanceRequestStatus" AS ENUM ('SUBMITTED', 'TRIAGE', 'REJECTED', 'DUPLICATE', 'APPROVED', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Onda2WorkOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'VALIDATED', 'CLOSED', 'REOPENED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Onda2PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'RETIRED');

-- CreateEnum
CREATE TYPE "Onda2ExecutionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Onda2InspectionResult" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE', 'NOT_OBSERVED');

-- CreateEnum
CREATE TYPE "Onda2InspectionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Onda2NonconformityStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'VERIFIED', 'CLOSED');

-- CreateTable
CREATE TABLE "operational_presence_session" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "spaceId" TEXT,
    "classroomId" TEXT,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "status" "Onda2PresenceSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_presence_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_presence_event" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "sessionId" TEXT,
    "spaceId" TEXT,
    "subjectType" VARCHAR(40) NOT NULL,
    "subjectId" VARCHAR(255) NOT NULL,
    "eventType" "Onda2PresenceEventType" NOT NULL,
    "status" "Onda2PresenceEventStatus" NOT NULL DEFAULT 'ACCEPTED',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(40) NOT NULL DEFAULT 'MOBILE',
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "correlationId" VARCHAR(120),
    "payload" JSONB,
    "createdBy" VARCHAR(255) NOT NULL,

    CONSTRAINT "operational_presence_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_assignment" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "employeeId" VARCHAR(255) NOT NULL,
    "functionLabel" VARCHAR(100) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "Onda2AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" VARCHAR(255),
    "createdBy" VARCHAR(255) NOT NULL,
    "updatedBy" VARCHAR(255),
    "publishedBy" VARCHAR(255),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffing_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_qualification" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "employeeId" VARCHAR(255) NOT NULL,
    "qualification" VARCHAR(120) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "source" VARCHAR(255) NOT NULL,
    "verifiedBy" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_qualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "substitution_request" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "requestedBy" VARCHAR(255) NOT NULL,
    "replacementEmployeeId" VARCHAR(255),
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "Onda2SubstitutionStatus" NOT NULL DEFAULT 'OPEN',
    "decisionBy" VARCHAR(255),
    "decisionAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "substitution_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratio_policy" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "jurisdiction" VARCHAR(120) NOT NULL,
    "sourceUrl" VARCHAR(500),
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'America/Sao_Paulo',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "Onda2ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "definition" JSONB NOT NULL,
    "createdBy" VARCHAR(255) NOT NULL,
    "reviewedBy" VARCHAR(255),
    "publishedBy" VARCHAR(255),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ratio_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratio_rule_version" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceRef" VARCHAR(255) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "definition" JSONB NOT NULL,
    "status" "Onda2ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedBy" VARCHAR(255),
    "publishedBy" VARCHAR(255),
    "publishedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ratio_rule_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratio_snapshot" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "state" "Onda2RatioState" NOT NULL,
    "capacity" INTEGER,
    "childCount" INTEGER,
    "requiredAdults" INTEGER,
    "validAdults" INTEGER,
    "policyId" TEXT,
    "ruleVersionId" TEXT,
    "inputSnapshot" JSONB NOT NULL,
    "explanation" TEXT,
    "freshnessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratio_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratio_breach" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "priority" "Onda2Priority" NOT NULL,
    "status" "Onda2BreachStatus" NOT NULL DEFAULT 'ACTIVE',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" VARCHAR(255),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" VARCHAR(255),
    "resolutionNote" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ratio_breach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_space" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "spaceType" VARCHAR(80) NOT NULL,
    "capacity" INTEGER,
    "status" "Onda2SpaceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_asset" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "spaceId" TEXT,
    "code" VARCHAR(100) NOT NULL,
    "qrToken" VARCHAR(180) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "manufacturer" VARCHAR(120),
    "model" VARCHAR(120),
    "serialNumber" VARCHAR(120),
    "status" "Onda2AssetStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "criticality" "Onda2Priority" NOT NULL DEFAULT 'NORMAL',
    "warrantyEndsAt" TIMESTAMP(3),
    "supplierId" VARCHAR(255),
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_movement" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fromSpaceId" TEXT,
    "toSpaceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_document" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" VARCHAR(128),
    "status" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    "createdBy" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_meter_reading" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "meterCode" VARCHAR(80) NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_meter_reading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_request" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "spaceId" TEXT,
    "assetId" TEXT,
    "code" VARCHAR(80) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT,
    "priority" "Onda2Priority" NOT NULL DEFAULT 'NORMAL',
    "safetyRisk" BOOLEAN NOT NULL DEFAULT false,
    "status" "Onda2MaintenanceRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "requesterId" VARCHAR(255) NOT NULL,
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triagedAt" TIMESTAMP(3),
    "triagedBy" VARCHAR(255),
    "triageReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "requestId" TEXT,
    "spaceId" TEXT,
    "assetId" TEXT,
    "code" VARCHAR(80) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Onda2Priority" NOT NULL DEFAULT 'NORMAL',
    "status" "Onda2WorkOrderStatus" NOT NULL DEFAULT 'OPEN',
    "assignedEmployeeId" VARCHAR(255),
    "supplierId" VARCHAR(255),
    "slaPolicyId" TEXT,
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "costSnapshot" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_assignment" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "employeeId" VARCHAR(255),
    "supplierId" VARCHAR(255),
    "assignedBy" VARCHAR(255) NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "work_order_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_status_event" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fromStatus" "Onda2WorkOrderStatus",
    "toStatus" "Onda2WorkOrderStatus" NOT NULL,
    "reason" TEXT,
    "actorId" VARCHAR(255) NOT NULL,
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_attachment" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" VARCHAR(128),
    "kind" VARCHAR(60) NOT NULL,
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_level_policy" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "priority" "Onda2Priority" NOT NULL,
    "targetMinutes" INTEGER NOT NULL,
    "pauseAllowed" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "Onda2ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_level_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_level_clock_event" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "eventType" VARCHAR(40) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "actorId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_level_clock_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preventive_maintenance_plan" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "assetId" TEXT,
    "spaceId" TEXT,
    "name" VARCHAR(180) NOT NULL,
    "scheduleType" VARCHAR(40) NOT NULL,
    "intervalDays" INTEGER,
    "nextDueAt" TIMESTAMP(3),
    "status" "Onda2PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preventive_maintenance_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preventive_plan_task" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "checklistTemplateId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "generatedWorkOrderId" TEXT,
    "status" "Onda2ExecutionStatus" NOT NULL DEFAULT 'DRAFT',
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preventive_plan_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_template" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "Onda2ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_template_version" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "status" "Onda2ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_template_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_execution" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateVersionId" TEXT,
    "workOrderId" TEXT,
    "inspectionId" TEXT,
    "spaceId" TEXT,
    "assetId" TEXT,
    "status" "Onda2ExecutionStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "executedBy" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_item_result" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "itemCode" VARCHAR(100) NOT NULL,
    "result" "Onda2InspectionResult" NOT NULL,
    "comment" TEXT,
    "evidenceRef" VARCHAR(255),
    "observedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_item_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateVersionId" TEXT,
    "spaceId" TEXT,
    "assetId" TEXT,
    "status" "Onda2InspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "executedBy" VARCHAR(255),
    "verifiedBy" VARCHAR(255),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nonconformity" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "workOrderId" TEXT,
    "code" VARCHAR(80) NOT NULL,
    "severity" "Onda2Priority" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "Onda2NonconformityStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "ownerId" VARCHAR(255),
    "verifiedBy" VARCHAR(255),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nonconformity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_action" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "nonconformityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ownerId" VARCHAR(255),
    "dueAt" TIMESTAMP(3),
    "status" "Onda2NonconformityStatus" NOT NULL DEFAULT 'OPEN',
    "verifiedBy" VARCHAR(255),
    "verifiedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corrective_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_requirement" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "source" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "renewalDays" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "Onda2ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_evidence" (
    "id" TEXT NOT NULL,
    "mantenedoraId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "assetId" TEXT,
    "storageKey" VARCHAR(500),
    "status" "Onda2ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "expiresAt" TIMESTAMP(3),
    "reviewedBy" VARCHAR(255),
    "reviewedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operational_presence_session_mantenedoraId_unitId_status_idx" ON "operational_presence_session"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "operational_presence_session_sessionDate_idx" ON "operational_presence_session"("sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "operational_presence_session_unitId_spaceId_sessionDate_key" ON "operational_presence_session"("unitId", "spaceId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "operational_presence_event_idempotencyKey_key" ON "operational_presence_event"("idempotencyKey");

-- CreateIndex
CREATE INDEX "operational_presence_event_mantenedoraId_unitId_occurredAt_idx" ON "operational_presence_event"("mantenedoraId", "unitId", "occurredAt");

-- CreateIndex
CREATE INDEX "operational_presence_event_spaceId_occurredAt_idx" ON "operational_presence_event"("spaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "operational_presence_event_subjectType_subjectId_occurredAt_idx" ON "operational_presence_event"("subjectType", "subjectId", "occurredAt");

-- CreateIndex
CREATE INDEX "operational_presence_event_status_occurredAt_idx" ON "operational_presence_event"("status", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "staffing_assignment_idempotencyKey_key" ON "staffing_assignment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "staffing_assignment_mantenedoraId_unitId_startsAt_endsAt_idx" ON "staffing_assignment"("mantenedoraId", "unitId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "staffing_assignment_spaceId_status_startsAt_idx" ON "staffing_assignment"("spaceId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "staffing_assignment_employeeId_startsAt_endsAt_idx" ON "staffing_assignment"("employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "staff_qualification_mantenedoraId_unitId_employeeId_idx" ON "staff_qualification"("mantenedoraId", "unitId", "employeeId");

-- CreateIndex
CREATE INDEX "staff_qualification_qualification_validFrom_validUntil_idx" ON "staff_qualification"("qualification", "validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "substitution_request_mantenedoraId_unitId_status_idx" ON "substitution_request"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "substitution_request_spaceId_startsAt_endsAt_idx" ON "substitution_request"("spaceId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ratio_policy_mantenedoraId_unitId_status_idx" ON "ratio_policy"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "ratio_policy_effectiveFrom_effectiveTo_idx" ON "ratio_policy"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "ratio_policy_unitId_name_version_key" ON "ratio_policy"("unitId", "name", "version");

-- CreateIndex
CREATE INDEX "ratio_rule_version_mantenedoraId_unitId_status_idx" ON "ratio_rule_version"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "ratio_rule_version_effectiveFrom_effectiveTo_idx" ON "ratio_rule_version"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "ratio_rule_version_policyId_version_key" ON "ratio_rule_version"("policyId", "version");

-- CreateIndex
CREATE INDEX "ratio_snapshot_mantenedoraId_unitId_snapshotAt_idx" ON "ratio_snapshot"("mantenedoraId", "unitId", "snapshotAt");

-- CreateIndex
CREATE INDEX "ratio_snapshot_spaceId_snapshotAt_idx" ON "ratio_snapshot"("spaceId", "snapshotAt");

-- CreateIndex
CREATE INDEX "ratio_snapshot_state_snapshotAt_idx" ON "ratio_snapshot"("state", "snapshotAt");

-- CreateIndex
CREATE INDEX "ratio_breach_mantenedoraId_unitId_status_idx" ON "ratio_breach"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "ratio_breach_spaceId_openedAt_idx" ON "ratio_breach"("spaceId", "openedAt");

-- CreateIndex
CREATE INDEX "facility_space_mantenedoraId_unitId_status_idx" ON "facility_space"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "facility_space_parentId_idx" ON "facility_space"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "facility_space_unitId_code_key" ON "facility_space"("unitId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "facility_asset_qrToken_key" ON "facility_asset"("qrToken");

-- CreateIndex
CREATE INDEX "facility_asset_mantenedoraId_unitId_status_idx" ON "facility_asset"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "facility_asset_spaceId_idx" ON "facility_asset"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "facility_asset_unitId_code_key" ON "facility_asset"("unitId", "code");

-- CreateIndex
CREATE INDEX "asset_movement_mantenedoraId_unitId_occurredAt_idx" ON "asset_movement"("mantenedoraId", "unitId", "occurredAt");

-- CreateIndex
CREATE INDEX "asset_movement_assetId_occurredAt_idx" ON "asset_movement"("assetId", "occurredAt");

-- CreateIndex
CREATE INDEX "asset_document_mantenedoraId_unitId_assetId_idx" ON "asset_document"("mantenedoraId", "unitId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_meter_reading_idempotencyKey_key" ON "asset_meter_reading"("idempotencyKey");

-- CreateIndex
CREATE INDEX "asset_meter_reading_mantenedoraId_unitId_assetId_occurredAt_idx" ON "asset_meter_reading"("mantenedoraId", "unitId", "assetId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_request_idempotencyKey_key" ON "maintenance_request"("idempotencyKey");

-- CreateIndex
CREATE INDEX "maintenance_request_mantenedoraId_unitId_status_priority_idx" ON "maintenance_request"("mantenedoraId", "unitId", "status", "priority");

-- CreateIndex
CREATE INDEX "maintenance_request_spaceId_submittedAt_idx" ON "maintenance_request"("spaceId", "submittedAt");

-- CreateIndex
CREATE INDEX "maintenance_request_assetId_submittedAt_idx" ON "maintenance_request"("assetId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_request_unitId_code_key" ON "maintenance_request"("unitId", "code");

-- CreateIndex
CREATE INDEX "work_order_mantenedoraId_unitId_status_priority_idx" ON "work_order"("mantenedoraId", "unitId", "status", "priority");

-- CreateIndex
CREATE INDEX "work_order_requestId_idx" ON "work_order"("requestId");

-- CreateIndex
CREATE INDEX "work_order_spaceId_status_idx" ON "work_order"("spaceId", "status");

-- CreateIndex
CREATE INDEX "work_order_assetId_status_idx" ON "work_order"("assetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_unitId_code_key" ON "work_order"("unitId", "code");

-- CreateIndex
CREATE INDEX "work_order_assignment_mantenedoraId_unitId_active_idx" ON "work_order_assignment"("mantenedoraId", "unitId", "active");

-- CreateIndex
CREATE INDEX "work_order_assignment_workOrderId_active_idx" ON "work_order_assignment"("workOrderId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_status_event_idempotencyKey_key" ON "work_order_status_event"("idempotencyKey");

-- CreateIndex
CREATE INDEX "work_order_status_event_mantenedoraId_unitId_createdAt_idx" ON "work_order_status_event"("mantenedoraId", "unitId", "createdAt");

-- CreateIndex
CREATE INDEX "work_order_status_event_workOrderId_createdAt_idx" ON "work_order_status_event"("workOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "work_order_attachment_mantenedoraId_unitId_workOrderId_idx" ON "work_order_attachment"("mantenedoraId", "unitId", "workOrderId");

-- CreateIndex
CREATE INDEX "service_level_policy_mantenedoraId_unitId_status_idx" ON "service_level_policy"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "service_level_policy_unitId_name_version_key" ON "service_level_policy"("unitId", "name", "version");

-- CreateIndex
CREATE INDEX "service_level_clock_event_mantenedoraId_unitId_occurredAt_idx" ON "service_level_clock_event"("mantenedoraId", "unitId", "occurredAt");

-- CreateIndex
CREATE INDEX "service_level_clock_event_workOrderId_occurredAt_idx" ON "service_level_clock_event"("workOrderId", "occurredAt");

-- CreateIndex
CREATE INDEX "preventive_maintenance_plan_mantenedoraId_unitId_status_idx" ON "preventive_maintenance_plan"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "preventive_maintenance_plan_assetId_nextDueAt_idx" ON "preventive_maintenance_plan"("assetId", "nextDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "preventive_plan_task_idempotencyKey_key" ON "preventive_plan_task"("idempotencyKey");

-- CreateIndex
CREATE INDEX "preventive_plan_task_mantenedoraId_unitId_dueAt_status_idx" ON "preventive_plan_task"("mantenedoraId", "unitId", "dueAt", "status");

-- CreateIndex
CREATE INDEX "preventive_plan_task_planId_idx" ON "preventive_plan_task"("planId");

-- CreateIndex
CREATE INDEX "checklist_template_mantenedoraId_unitId_status_idx" ON "checklist_template"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_template_unitId_name_key" ON "checklist_template"("unitId", "name");

-- CreateIndex
CREATE INDEX "checklist_template_version_mantenedoraId_unitId_status_idx" ON "checklist_template_version"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_template_version_templateId_version_key" ON "checklist_template_version"("templateId", "version");

-- CreateIndex
CREATE INDEX "checklist_execution_mantenedoraId_unitId_status_idx" ON "checklist_execution"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "checklist_execution_workOrderId_idx" ON "checklist_execution"("workOrderId");

-- CreateIndex
CREATE INDEX "checklist_execution_inspectionId_idx" ON "checklist_execution"("inspectionId");

-- CreateIndex
CREATE INDEX "checklist_item_result_mantenedoraId_unitId_result_idx" ON "checklist_item_result"("mantenedoraId", "unitId", "result");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_item_result_executionId_itemCode_key" ON "checklist_item_result"("executionId", "itemCode");

-- CreateIndex
CREATE INDEX "inspection_mantenedoraId_unitId_status_idx" ON "inspection"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "inspection_scheduledAt_idx" ON "inspection"("scheduledAt");

-- CreateIndex
CREATE INDEX "nonconformity_mantenedoraId_unitId_status_severity_idx" ON "nonconformity"("mantenedoraId", "unitId", "status", "severity");

-- CreateIndex
CREATE INDEX "nonconformity_inspectionId_idx" ON "nonconformity"("inspectionId");

-- CreateIndex
CREATE INDEX "nonconformity_workOrderId_idx" ON "nonconformity"("workOrderId");

-- CreateIndex
CREATE INDEX "corrective_action_mantenedoraId_unitId_status_idx" ON "corrective_action"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "corrective_action_nonconformityId_idx" ON "corrective_action"("nonconformityId");

-- CreateIndex
CREATE INDEX "compliance_requirement_mantenedoraId_unitId_status_idx" ON "compliance_requirement"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_requirement_unitId_name_version_key" ON "compliance_requirement"("unitId", "name", "version");

-- CreateIndex
CREATE INDEX "compliance_evidence_mantenedoraId_unitId_status_idx" ON "compliance_evidence"("mantenedoraId", "unitId", "status");

-- CreateIndex
CREATE INDEX "compliance_evidence_requirementId_expiresAt_idx" ON "compliance_evidence"("requirementId", "expiresAt");

-- AddForeignKey
ALTER TABLE "operational_presence_session" ADD CONSTRAINT "operational_presence_session_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_presence_session" ADD CONSTRAINT "operational_presence_session_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_presence_event" ADD CONSTRAINT "operational_presence_event_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_presence_event" ADD CONSTRAINT "operational_presence_event_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_assignment" ADD CONSTRAINT "staffing_assignment_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_assignment" ADD CONSTRAINT "staffing_assignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_qualification" ADD CONSTRAINT "staff_qualification_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_qualification" ADD CONSTRAINT "staff_qualification_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substitution_request" ADD CONSTRAINT "substitution_request_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substitution_request" ADD CONSTRAINT "substitution_request_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratio_policy" ADD CONSTRAINT "ratio_policy_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratio_policy" ADD CONSTRAINT "ratio_policy_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratio_rule_version" ADD CONSTRAINT "ratio_rule_version_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratio_rule_version" ADD CONSTRAINT "ratio_rule_version_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratio_snapshot" ADD CONSTRAINT "ratio_snapshot_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratio_snapshot" ADD CONSTRAINT "ratio_snapshot_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratio_breach" ADD CONSTRAINT "ratio_breach_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratio_breach" ADD CONSTRAINT "ratio_breach_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_space" ADD CONSTRAINT "facility_space_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_space" ADD CONSTRAINT "facility_space_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_asset" ADD CONSTRAINT "facility_asset_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_asset" ADD CONSTRAINT "facility_asset_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movement" ADD CONSTRAINT "asset_movement_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movement" ADD CONSTRAINT "asset_movement_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_document" ADD CONSTRAINT "asset_document_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_document" ADD CONSTRAINT "asset_document_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_meter_reading" ADD CONSTRAINT "asset_meter_reading_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_meter_reading" ADD CONSTRAINT "asset_meter_reading_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignment" ADD CONSTRAINT "work_order_assignment_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignment" ADD CONSTRAINT "work_order_assignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_event" ADD CONSTRAINT "work_order_status_event_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_event" ADD CONSTRAINT "work_order_status_event_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_attachment" ADD CONSTRAINT "work_order_attachment_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_attachment" ADD CONSTRAINT "work_order_attachment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_level_policy" ADD CONSTRAINT "service_level_policy_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_level_policy" ADD CONSTRAINT "service_level_policy_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_level_clock_event" ADD CONSTRAINT "service_level_clock_event_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_level_clock_event" ADD CONSTRAINT "service_level_clock_event_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preventive_maintenance_plan" ADD CONSTRAINT "preventive_maintenance_plan_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preventive_maintenance_plan" ADD CONSTRAINT "preventive_maintenance_plan_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preventive_plan_task" ADD CONSTRAINT "preventive_plan_task_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preventive_plan_task" ADD CONSTRAINT "preventive_plan_task_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template" ADD CONSTRAINT "checklist_template_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template" ADD CONSTRAINT "checklist_template_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_version" ADD CONSTRAINT "checklist_template_version_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_version" ADD CONSTRAINT "checklist_template_version_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_execution" ADD CONSTRAINT "checklist_execution_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_execution" ADD CONSTRAINT "checklist_execution_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item_result" ADD CONSTRAINT "checklist_item_result_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item_result" ADD CONSTRAINT "checklist_item_result_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonconformity" ADD CONSTRAINT "nonconformity_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonconformity" ADD CONSTRAINT "nonconformity_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_action" ADD CONSTRAINT "corrective_action_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_action" ADD CONSTRAINT "corrective_action_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_requirement" ADD CONSTRAINT "compliance_requirement_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_requirement" ADD CONSTRAINT "compliance_requirement_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evidence" ADD CONSTRAINT "compliance_evidence_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evidence" ADD CONSTRAINT "compliance_evidence_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
