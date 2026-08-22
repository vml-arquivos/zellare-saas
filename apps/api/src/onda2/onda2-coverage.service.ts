import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
  ReviewRatioPolicyDto,
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
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (Number.isNaN(effectiveFrom.getTime()) || (effectiveTo && Number.isNaN(effectiveTo.getTime())) || (effectiveTo && effectiveTo <= effectiveFrom)) {
      throw new BadRequestException('A vigência da política é inválida');
    }
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
        effectiveFrom,
        effectiveTo: effectiveTo ?? undefined,
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

  async reviewRatioPolicy(id: string, dto: ReviewRatioPolicyDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.ratioEngineV1, ONDA2_CAPABILITIES.ratioPolicyReview);
    if (dto.status !== Onda2ApprovalStatus.APPROVED && dto.status !== Onda2ApprovalStatus.REJECTED) {
      throw new BadRequestException('A revisão deve aprovar ou rejeitar a política');
    }
    const policy = await this.prisma.ratioPolicy.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!policy) throw new NotFoundException('Política de proporção não encontrada');
    await this.access.assertUnitAccess(user, policy.unitId);
    if (policy.status !== Onda2ApprovalStatus.DRAFT) throw new BadRequestException('Somente políticas em rascunho podem ser revisadas');
    if (policy.createdBy === user.sub) throw new BadRequestException('O autor não pode revisar a própria política');
    return this.prisma.ratioPolicy.update({
      where: { id },
      data: { status: dto.status, reviewedBy: user.sub },
    });
  }

  async publishRatioPolicy(id: string, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.ratioEngineV1, ONDA2_CAPABILITIES.ratioPolicyPublish);
    const policy = await this.prisma.ratioPolicy.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!policy) throw new NotFoundException('Política de proporção não encontrada');
    await this.access.assertUnitAccess(user, policy.unitId);
    if (policy.status !== Onda2ApprovalStatus.APPROVED || !policy.reviewedBy || policy.reviewedBy === policy.createdBy) {
      throw new BadRequestException('A política precisa de aprovação por um revisor diferente do autor');
    }
    if (policy.publishedBy && policy.publishedBy === user.sub) throw new BadRequestException('O publicador já utilizado não pode repetir a publicação');
    if (policy.createdBy === user.sub || policy.reviewedBy === user.sub) {
      throw new BadRequestException('O publicador deve ser diferente do autor e do revisor');
    }
    return this.prisma.ratioPolicy.update({
      where: { id },
      data: { status: Onda2ApprovalStatus.PUBLISHED, publishedBy: user.sub, publishedAt: new Date() },
    });
  }

  async createSnapshot(dto: CreateRatioSnapshotDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.ratioEngineV1, ONDA2_CAPABILITIES.ratioPolicyManage);
    await this.access.assertUnitAccess(user, dto.unitId);
    const snapshotAt = new Date(dto.snapshotAt);
    const space = await this.prisma.facilitySpace.findFirst({
      where: { id: dto.spaceId, mantenedoraId: user.mantenedoraId, unitId: dto.unitId, isActive: true },
      select: { id: true, capacity: true },
    });
    if (!space) throw new NotFoundException('Espaço não encontrado no escopo autorizado');

    const dayStart = new Date(snapshotAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const events = await this.prisma.operationalPresenceEvent.findMany({
      where: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, spaceId: dto.spaceId, occurredAt: { gte: dayStart, lt: dayEnd }, status: 'ACCEPTED' },
      select: { subjectType: true, subjectId: true, eventType: true, occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    });
    const latestPresence = new Map<string, { subjectType: string; present: boolean }>();
    for (const event of events) {
      if (event.eventType === 'CHECK_IN') latestPresence.set(`${event.subjectType}:${event.subjectId}`, { subjectType: event.subjectType, present: true });
      if (event.eventType === 'CHECK_OUT') latestPresence.set(`${event.subjectType}:${event.subjectId}`, { subjectType: event.subjectType, present: false });
    }
    const childCount = [...latestPresence.values()].filter((item) => item.subjectType === 'CHILD' && item.present).length;
    const validAdults = [...latestPresence.values()].filter((item) => ['STAFF', 'ADULT', 'EMPLOYEE'].includes(item.subjectType) && item.present).length;

    const policy = await this.prisma.ratioPolicy.findFirst({
      where: {
        id: dto.policyId,
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        status: Onda2ApprovalStatus.PUBLISHED,
        effectiveFrom: { lte: snapshotAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: snapshotAt } }],
      },
      orderBy: { version: 'desc' },
      select: { id: true, definition: true, version: true },
    });
    const definition = policy?.definition && typeof policy.definition === 'object' ? policy.definition as Record<string, unknown> : null;
    const childrenPerAdult = Number(definition?.maxChildrenPerAdult ?? definition?.childrenPerAdult ?? definition?.children_per_adult);
    const minimumAdults = Number(definition?.minimumAdults ?? definition?.minAdults ?? definition?.minimum_adults);
    const hasRule = Number.isFinite(childrenPerAdult) && childrenPerAdult > 0 || Number.isFinite(minimumAdults) && minimumAdults >= 0;
    const requiredAdults = hasRule ? Math.max(Number.isFinite(minimumAdults) ? minimumAdults : 0, Number.isFinite(childrenPerAdult) && childrenPerAdult > 0 ? Math.ceil(childCount / childrenPerAdult) : 0) : null;
    const state = requiredAdults === null ? Onda2RatioState.UNKNOWN : validAdults < requiredAdults ? Onda2RatioState.VIOLATION : Onda2RatioState.COMPLIANT;
    const gap = requiredAdults === null ? null : requiredAdults - validAdults;
    const explanation = requiredAdults === null
      ? 'Regra publicada ou dados suficientes de presença não foram encontrados; revisão humana necessária.'
      : gap && gap > 0
        ? `Faltam ${gap} adulto(s) válido(s) para a regra publicada.`
        : 'Cobertura adulta atende à regra publicada.';
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.ratioSnapshot.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: dto.unitId,
          spaceId: dto.spaceId,
          snapshotAt,
          state,
          capacity: dto.capacity ?? space.capacity,
          childCount,
          requiredAdults,
          validAdults,
          policyId: policy?.id,
          ruleVersionId: dto.ruleVersionId,
          inputSnapshot: { source: 'operational_presence_event', eventCount: events.length, diagnosticInference: false, humanReviewRequired: true } as Prisma.InputJsonValue,
          explanation,
          freshnessAt: new Date(),
        },
      });
      if (state === Onda2RatioState.VIOLATION) {
        const existing = await tx.ratioBreach.findFirst({
          where: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, spaceId: dto.spaceId, status: { in: [Onda2BreachStatus.ACTIVE, Onda2BreachStatus.ACKNOWLEDGED] } },
        });
        if (!existing) {
          await tx.ratioBreach.create({
            data: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, spaceId: dto.spaceId, snapshotId: snapshot.id, priority: (gap ?? 0) >= 2 ? Onda2Priority.CRITICAL : Onda2Priority.HIGH },
          });
        }
      }
      return snapshot;
    });
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
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new BadRequestException('O intervalo da alocação é inválido');
    }
    const source = dto.source ?? 'WEB';
    if (dto.idempotencyKey) {
      const existing = await this.prisma.staffingAssignment.findFirst({
        where: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, source, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return existing;
    }
    const employee = await this.prisma.user.findFirst({
      where: { id: dto.employeeId, mantenedoraId: user.mantenedoraId, status: 'ATIVO', OR: [{ unitId: dto.unitId }, { unitId: null }] },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Funcionário não encontrado no escopo autorizado');
    const overlapping = await this.prisma.staffingAssignment.findFirst({
      where: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, spaceId: dto.spaceId, employeeId: dto.employeeId, status: { not: 'CANCELLED' }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      select: { id: true },
    });
    if (overlapping) throw new ConflictException('Funcionário já possui alocação sobreposta nesse espaço');
    try {
      return await this.prisma.staffingAssignment.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: dto.unitId,
          spaceId: dto.spaceId,
          employeeId: dto.employeeId,
          functionLabel: dto.functionLabel,
          startsAt,
          endsAt,
          idempotencyKey: dto.idempotencyKey,
          source,
          createdBy: user.sub,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Chave de idempotência já utilizada');
      }
      throw error;
    }
  }

  async publishStaffingAssignment(id: string, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.staffingCoverageV1, ONDA2_CAPABILITIES.staffingPublish);
    const assignment = await this.prisma.staffingAssignment.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!assignment) throw new NotFoundException('Alocação de equipe não encontrada');
    await this.access.assertUnitAccess(user, assignment.unitId);
    if (assignment.createdBy === user.sub) throw new BadRequestException('O autor não pode publicar a própria alocação');
    return this.prisma.staffingAssignment.update({ where: { id }, data: { status: 'PUBLISHED', publishedBy: user.sub, publishedAt: new Date() } });
  }

  async listStaffing(query: Onda2ListQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.staffingCoverageV1, ONDA2_CAPABILITIES.staffingManage);
    if (query.unitId) await this.access.assertUnitAccess(user, query.unitId);
    return this.prisma.staffingAssignment.findMany({ where: { mantenedoraId: user.mantenedoraId, unitId: query.unitId }, orderBy: { startsAt: 'asc' }, take: query.limit ?? 100 });
  }
}
