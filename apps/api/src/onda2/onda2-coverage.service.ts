import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Onda2ApprovalStatus,
  Onda2BreachStatus,
  Onda2Priority,
  Onda2RatioState,
  Prisma,
} from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ONDA2_CAPABILITIES, ONDA2_FEATURE_FLAGS } from './onda2.constants';
import { Onda2AccessService } from './onda2-access.service';
import {
  CloseRatioBreachDto,
  CreateRatioPolicyDto,
  CreateRatioSnapshotDto,
  CreateStaffingAssignmentDto,
  Onda2ListQueryDto,
} from './onda2.dto';

@Injectable()
export class Onda2CoverageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: Onda2AccessService,
  ) {}

  async createRatioPolicy(dto: CreateRatioPolicyDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.ratioEngineV1, ONDA2_CAPABILITIES.ratioPolicyManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    const latest = await this.prisma.ratioPolicy.findFirst({
      where: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, name: dto.name },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    return this.prisma.ratioPolicy.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        name: dto.name,
        jurisdiction: dto.jurisdiction,
        sourceUrl: dto.sourceUrl,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        version,
        status: Onda2ApprovalStatus.DRAFT,
        definition: dto.definition as Prisma.InputJsonValue,
        createdBy: user.sub,
      },
    });
  }

  async listRatioPolicies(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.ratioEngineV1, ONDA2_CAPABILITIES.ratioPolicyRead);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.ratioPolicy.findMany({
      where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId },
      orderBy: [{ unitId: 'asc' }, { name: 'asc' }, { version: 'desc' }],
      take: query.limit ?? 100,
    });
  }

  async publishRatioPolicy(id: string, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.ratioEngineV1, ONDA2_CAPABILITIES.ratioPolicyPublish);
    const policy = await this.prisma.ratioPolicy.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!policy) throw new NotFoundException('Política de proporção não encontrada');
    await this.access.assertUnitAccess(user, policy.unitId);
    return this.prisma.ratioPolicy.update({
      where: { id },
      data: { status: Onda2ApprovalStatus.PUBLISHED, publishedBy: user.sub, publishedAt: new Date() },
    });
  }

  async createSnapshot(dto: CreateRatioSnapshotDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.ratioEngineV1, ONDA2_CAPABILITIES.ratioPolicyManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    const gap = dto.requiredAdults - dto.validAdults;
    const state = gap > 0 ? Onda2RatioState.VIOLATION : Onda2RatioState.COMPLIANT;
    const explanation = gap > 0
      ? `Faltam ${gap} adulto(s) válido(s) para a regra publicada.`
      : 'Cobertura adulta atende à regra informada.';
    const snapshot = await this.prisma.ratioSnapshot.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        spaceId: dto.spaceId,
        snapshotAt: new Date(dto.snapshotAt),
        state,
        capacity: dto.capacity,
        childCount: dto.childCount,
        requiredAdults: dto.requiredAdults,
        validAdults: dto.validAdults,
        policyId: dto.policyId,
        ruleVersionId: dto.ruleVersionId,
        inputSnapshot: {
          ...(dto.inputSnapshot ?? {}),
          diagnosticInference: false,
          humanReviewRequired: true,
        } as Prisma.InputJsonValue,
        explanation,
        freshnessAt: new Date(),
      },
    });

    if (state === Onda2RatioState.VIOLATION) {
      const existing = await this.prisma.ratioBreach.findFirst({
        where: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, spaceId: dto.spaceId, status: { in: [Onda2BreachStatus.ACTIVE, Onda2BreachStatus.ACKNOWLEDGED] } },
      });
      if (!existing) {
        await this.prisma.ratioBreach.create({
          data: {
            mantenedoraId: user.mantenedoraId,
            unitId: dto.unitId,
            spaceId: dto.spaceId,
            snapshotId: snapshot.id,
            priority: gap >= 2 ? Onda2Priority.CRITICAL : Onda2Priority.HIGH,
          },
        });
      }
    }
    return snapshot;
  }

  async listSnapshots(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.ratioEngineV1, ONDA2_CAPABILITIES.ratioPolicyRead);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.ratioSnapshot.findMany({
      where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId },
      orderBy: { snapshotAt: 'desc' },
      take: query.limit ?? 100,
    });
  }

  async listBreaches(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.ratioEngineV1, ONDA2_CAPABILITIES.ratioPolicyRead);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.ratioBreach.findMany({
      where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId, status: { in: [Onda2BreachStatus.ACTIVE, Onda2BreachStatus.ACKNOWLEDGED] } },
      orderBy: [{ priority: 'desc' }, { openedAt: 'desc' }],
      take: query.limit ?? 100,
    });
  }

  async acknowledgeBreach(id: string, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.ratioEngineV1, ONDA2_CAPABILITIES.ratioBreachAcknowledge);
    const breach = await this.prisma.ratioBreach.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!breach) throw new NotFoundException('Brecha de proporção não encontrada');
    await this.access.assertUnitAccess(user, breach.unitId);
    return this.prisma.ratioBreach.update({ where: { id }, data: { status: Onda2BreachStatus.ACKNOWLEDGED, acknowledgedAt: new Date(), acknowledgedBy: user.sub } });
  }

  async resolveBreach(id: string, dto: CloseRatioBreachDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.ratioEngineV1, ONDA2_CAPABILITIES.ratioBreachResolve);
    const breach = await this.prisma.ratioBreach.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!breach) throw new NotFoundException('Brecha de proporção não encontrada');
    await this.access.assertUnitAccess(user, breach.unitId);
    return this.prisma.ratioBreach.update({
      where: { id },
      data: { status: Onda2BreachStatus.RESOLVED, resolvedAt: new Date(), resolvedBy: user.sub, resolutionNote: dto.note },
    });
  }

  async createStaffingAssignment(dto: CreateStaffingAssignmentDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.staffingCoverageV1, ONDA2_CAPABILITIES.staffingManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    if (dto.idempotencyKey) {
      const existing = await this.prisma.staffingAssignment.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (existing) return existing;
    }
    return this.prisma.staffingAssignment.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        spaceId: dto.spaceId,
        employeeId: dto.employeeId,
        functionLabel: dto.functionLabel,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        idempotencyKey: dto.idempotencyKey,
        createdBy: user.sub,
      },
    });
  }

  async publishStaffingAssignment(id: string, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.staffingCoverageV1, ONDA2_CAPABILITIES.staffingPublish);
    const assignment = await this.prisma.staffingAssignment.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!assignment) throw new NotFoundException('Alocação de equipe não encontrada');
    await this.access.assertUnitAccess(user, assignment.unitId);
    return this.prisma.staffingAssignment.update({ where: { id }, data: { status: 'PUBLISHED', publishedBy: user.sub, publishedAt: new Date() } });
  }

  async listStaffing(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.staffingCoverageV1, ONDA2_CAPABILITIES.staffingManage);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.staffingAssignment.findMany({ where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId }, orderBy: { startsAt: 'asc' }, take: query.limit ?? 100 });
  }
}
