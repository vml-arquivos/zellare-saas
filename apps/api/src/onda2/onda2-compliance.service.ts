import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    const source = 'SCHEDULER';
    const idempotencyKey = `preventive:${plan.id}:${dueAt.toISOString()}`;
    const existing = await this.prisma.preventivePlanTask.findFirst({ where: { mantenedoraId: user.mantenedoraId, unitId: plan.unitId, source, idempotencyKey } });
    if (existing) return existing;
    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: plan.unitId,
          spaceId: plan.spaceId,
          assetId: plan.assetId,
          code: `PM-${plan.id.slice(0, 12)}-${dueAt.toISOString().slice(0, 10)}`,
          category: 'PREVENTIVA',
          description: `Manutenção preventiva: ${plan.name}`,
          status: 'OPEN',
          createdBy: user.sub,
        },
      });
      const task = await tx.preventivePlanTask.create({
        data: { mantenedoraId: user.mantenedoraId, unitId: plan.unitId, planId: plan.id, dueAt, generatedWorkOrderId: workOrder.id, status: Onda2ExecutionStatus.IN_PROGRESS, idempotencyKey, source },
      });
      if (plan.intervalDays && plan.intervalDays > 0) {
        const nextDueAt = new Date(dueAt);
        nextDueAt.setDate(nextDueAt.getDate() + plan.intervalDays);
        await tx.preventiveMaintenancePlan.update({ where: { id: plan.id }, data: { nextDueAt } });
      }
      return task;
    });
  }

  async createInspection(dto: CreateInspectionDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.inspectionManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    if (dto.templateId) {
      const template = await this.prisma.checklistTemplate.findFirst({ where: { id: dto.templateId, mantenedoraId: user.mantenedoraId, unitId: dto.unitId }, select: { id: true } });
      if (!template) throw new NotFoundException('Template de checklist não encontrado no escopo autorizado');
    }
    if (dto.templateVersionId) {
      const version = await this.prisma.checklistTemplateVersion.findFirst({ where: { id: dto.templateVersionId, mantenedoraId: user.mantenedoraId, unitId: dto.unitId, status: Onda2ApprovalStatus.PUBLISHED }, select: { id: true, templateId: true } });
      if (!version || (dto.templateId && version.templateId !== dto.templateId)) throw new NotFoundException('Versão de checklist não encontrada no escopo autorizado');
    }
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
    const execution = await this.prisma.checklistExecution.findFirst({ where: { id: dto.executionId, inspectionId: inspection.id, mantenedoraId: user.mantenedoraId, unitId: inspection.unitId }, select: { id: true } });
    const executionId = execution?.id ?? (await this.prisma.checklistExecution.findFirst({ where: { inspectionId: inspection.id, mantenedoraId: user.mantenedoraId, unitId: inspection.unitId }, select: { id: true } }))?.id;
    if (!executionId) throw new BadRequestException('Inspeção precisa de uma execução de checklist');
    const itemCount = await this.prisma.checklistItemResult.count({ where: { executionId, mantenedoraId: user.mantenedoraId, unitId: inspection.unitId } });
    if (itemCount === 0) throw new BadRequestException('Inspeção precisa de ao menos um item preenchido');
    return this.prisma.$transaction(async (tx) => {
      const completed = await tx.inspection.update({ where: { id }, data: { status: Onda2InspectionStatus.COMPLETED, completedAt: new Date(), executedBy: user.sub } });
      if (dto.result === Onda2InspectionResult.NON_COMPLIANT) {
        await tx.nonconformity.create({ data: { mantenedoraId: user.mantenedoraId, unitId: inspection.unitId, inspectionId: inspection.id, code: `NC-${inspection.id}`, severity: 'HIGH', description: dto.note ?? 'Item de inspeção não conforme; requer revisão humana.', status: Onda2NonconformityStatus.OPEN } });
      }
      return { inspection: completed, governance: ONDA2_GOVERNANCE };
    });
  }

  async createNonconformity(dto: CreateNonconformityDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.inspectionManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    if (dto.inspectionId) {
      const inspection = await this.prisma.inspection.findFirst({ where: { id: dto.inspectionId, mantenedoraId: user.mantenedoraId, unitId: dto.unitId }, select: { id: true } });
      if (!inspection) throw new NotFoundException('Inspeção da não conformidade não encontrada no escopo autorizado');
    }
    if (dto.workOrderId) {
      const workOrder = await this.prisma.workOrder.findFirst({ where: { id: dto.workOrderId, mantenedoraId: user.mantenedoraId, unitId: dto.unitId }, select: { id: true } });
      if (!workOrder) throw new NotFoundException('OS da não conformidade não encontrada no escopo autorizado');
    }
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
    const correctiveAction = await this.prisma.correctiveAction.findFirst({ where: { nonconformityId: nc.id, mantenedoraId: user.mantenedoraId, unitId: nc.unitId, status: { in: [Onda2NonconformityStatus.VERIFIED, Onda2NonconformityStatus.CLOSED] } }, select: { id: true } });
    const evidence = nc.inspectionId
      ? await this.prisma.complianceEvidence.findFirst({ where: { inspectionId: nc.inspectionId, mantenedoraId: user.mantenedoraId, unitId: nc.unitId, status: Onda2ApprovalStatus.APPROVED, reviewedBy: { not: null } }, select: { id: true } })
      : null;
    if (!correctiveAction && !evidence) throw new BadRequestException('A não conformidade precisa de ação corretiva concluída ou evidência aprovada');
    return this.prisma.nonconformity.update({ where: { id }, data: { status: Onda2NonconformityStatus.VERIFIED, verifiedBy: user.sub, version: { increment: 1 } } });
  }

  async createComplianceRequirement(dto: CreateComplianceRequirementDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.complianceInspectionsV1, ONDA2_CAPABILITIES.inspectionManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    const latest = await this.prisma.complianceRequirement.findFirst({ where: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, name: dto.name }, orderBy: { version: 'desc' }, select: { version: true } });
    return this.prisma.complianceRequirement.create({ data: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, name: dto.name, source: dto.source, version: (latest?.version ?? 0) + 1, renewalDays: dto.renewalDays, effectiveFrom: new Date(dto.effectiveFrom), effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined, status: Onda2ApprovalStatus.PENDING_REVIEW, createdBy: user.sub } });
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
