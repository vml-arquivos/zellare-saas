import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Onda2ApprovalStatus,
  Onda2ExecutionStatus,
  Onda2InspectionResult,
  Onda2InspectionStatus,
  Onda2NonconformityStatus,
  Onda2PlanStatus,
  Prisma,
} from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ONDA2_CAPABILITIES, ONDA2_FEATURE_FLAGS, ONDA2_GOVERNANCE } from './onda2.constants';
import { Onda2AccessService } from './onda2-access.service';
import {
  CompleteInspectionDto,
  CreateComplianceEvidenceDto,
  CreateComplianceRequirementDto,
  CreateInspectionDto,
  CreateNonconformityDto,
  CreatePreventivePlanDto,
  Onda2ListQueryDto,
  VerifyNonconformityDto,
} from './onda2.dto';

@Injectable()
export class Onda2ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: Onda2AccessService,
  ) {}

  async createPreventivePlan(dto: CreatePreventivePlanDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.preventiveMaintenanceV1, ONDA2_CAPABILITIES.preventiveManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    return this.prisma.preventiveMaintenancePlan.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        assetId: dto.assetId,
        spaceId: dto.spaceId,
        name: dto.name,
        scheduleType: dto.scheduleType,
        intervalDays: dto.intervalDays,
        nextDueAt: dto.nextDueAt ? new Date(dto.nextDueAt) : undefined,
        status: Onda2PlanStatus.ACTIVE,
        createdBy: user.sub,
      },
    });
  }

  async listPreventivePlans(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.preventiveMaintenanceV1, ONDA2_CAPABILITIES.preventiveManage);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.preventiveMaintenancePlan.findMany({ where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId }, orderBy: { nextDueAt: 'asc' }, take: query.limit ?? 100 });
  }

  async generatePreventiveTask(planId: string, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.preventiveMaintenanceV1, ONDA2_CAPABILITIES.preventiveManage);
    const plan = await this.prisma.preventiveMaintenancePlan.findFirst({ where: { id: planId, mantenedoraId: user.mantenedoraId } });
    if (!plan) throw new NotFoundException('Plano de manutenção preventiva não encontrado');
    await this.access.assertUnitAccess(user, plan.unitId);
    const dueAt = plan.nextDueAt ?? new Date();
    const idempotencyKey = `preventive:${plan.id}:${dueAt.toISOString()}`;
    const existing = await this.prisma.preventivePlanTask.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
    return this.prisma.preventivePlanTask.create({ data: { mantenedoraId: user.mantenedoraId, unitId: plan.unitId, planId: plan.id, dueAt, status: Onda2ExecutionStatus.DRAFT, idempotencyKey } });
  }

  async createInspection(dto: CreateInspectionDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.inspectionManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    return this.prisma.inspection.create({ data: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, templateId: dto.templateId, templateVersionId: dto.templateVersionId, spaceId: dto.spaceId, assetId: dto.assetId, scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined } });
  }

  async listInspections(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.inspectionManage);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.inspection.findMany({ where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId }, orderBy: { scheduledAt: 'asc' }, take: query.limit ?? 100 });
  }

  async completeInspection(id: string, dto: CompleteInspectionDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.inspectionExecute);
    const inspection = await this.prisma.inspection.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!inspection) throw new NotFoundException('Inspeção não encontrada');
    await this.access.assertUnitAccess(user, inspection.unitId);
    const completed = await this.prisma.inspection.update({ where: { id }, data: { status: Onda2InspectionStatus.COMPLETED, completedAt: new Date(), executedBy: user.sub } });
    if (dto.result === Onda2InspectionResult.NON_COMPLIANT) {
      await this.prisma.nonconformity.create({ data: { mantenedoraId: user.mantenedoraId, unitId: inspection.unitId, inspectionId: inspection.id, code: `NC-${inspection.id}`, severity: 'HIGH', description: dto.note ?? 'Item de inspeção não conforme; requer revisão humana.', status: Onda2NonconformityStatus.OPEN } });
    }
    return { inspection: completed, governance: ONDA2_GOVERNANCE };
  }

  async createNonconformity(dto: CreateNonconformityDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.inspectionManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    return this.prisma.nonconformity.create({ data: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, inspectionId: dto.inspectionId, workOrderId: dto.workOrderId, code: dto.code, severity: dto.severity, description: dto.description, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined, ownerId: dto.ownerId } });
  }

  async listNonconformities(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.inspectionManage);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.nonconformity.findMany({ where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId }, orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }], take: query.limit ?? 100 });
  }

  async verifyNonconformity(id: string, dto: VerifyNonconformityDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.correctiveVerify);
    const nc = await this.prisma.nonconformity.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!nc) throw new NotFoundException('Não conformidade não encontrada');
    await this.access.assertUnitAccess(user, nc.unitId);
    return this.prisma.nonconformity.update({ where: { id }, data: { status: Onda2NonconformityStatus.VERIFIED, verifiedBy: user.sub, version: { increment: 1 } } });
  }

  async createComplianceRequirement(dto: CreateComplianceRequirementDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.inspectionManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    const latest = await this.prisma.complianceRequirement.findFirst({ where: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, name: dto.name }, orderBy: { version: 'desc' }, select: { version: true } });
    return this.prisma.complianceRequirement.create({ data: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, name: dto.name, source: dto.source, version: (latest?.version ?? 0) + 1, renewalDays: dto.renewalDays, effectiveFrom: new Date(dto.effectiveFrom), effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined, status: Onda2ApprovalStatus.PUBLISHED, createdBy: user.sub } });
  }

  async listComplianceRequirements(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.inspectionManage);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.complianceRequirement.findMany({ where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId }, orderBy: { name: 'asc' }, take: query.limit ?? 100 });
  }

  async createComplianceEvidence(dto: CreateComplianceEvidenceDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.inspectionManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    const requirement = await this.prisma.complianceRequirement.findFirst({ where: { id: dto.requirementId, mantenedoraId: user.mantenedoraId, unitId: dto.unitId } });
    if (!requirement) throw new NotFoundException('Requisito de compliance não encontrado no escopo informado');
    return this.prisma.complianceEvidence.create({ data: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, requirementId: dto.requirementId, inspectionId: dto.inspectionId, assetId: dto.assetId, storageKey: dto.storageKey, status: Onda2ApprovalStatus.PENDING_REVIEW, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined, createdBy: user.sub } });
  }

  async listComplianceEvidence(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.inspectionManage);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.complianceEvidence.findMany({ where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId }, orderBy: { expiresAt: 'asc' }, take: query.limit ?? 100 });
  }
}
