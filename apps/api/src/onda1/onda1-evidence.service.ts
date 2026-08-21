import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Onda1GoalStatus,
  Onda1ReviewTaskStatus,
  Onda1SupportStatus,
  Prisma,
  RoleLevel,
} from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AuditService } from '../common/services/audit.service';
import { EvidenceService } from '../evidence/evidence.service';
import { PrismaService } from '../prisma/prisma.service';
import { Onda1AccessService } from './onda1-access.service';
import { ONDA1_CAPABILITIES, ONDA1_FEATURE_FLAGS } from './onda1.constants';
import {
  CreateEvidenceLinkDto,
  CreateGoalDto,
  CreateReviewTaskDto,
  CreateSupportActionDto,
  EvidenceLoopQueryDto,
  ReviewQueueQueryDto,
  UpdateGoalDto,
  UpdateReviewTaskDto,
  UpdateSupportOutcomeDto,
} from './dto/onda1.dto';

const REVIEWABLE_LEVELS = [RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER];

@Injectable()
export class Onda1EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: Onda1AccessService,
    private readonly evidence: EvidenceService,
    private readonly audit: AuditService,
  ) {}

  private async assertFlag(user: JwtPayload, flag: typeof ONDA1_FEATURE_FLAGS.evidenceLoopV1 | typeof ONDA1_FEATURE_FLAGS.reviewHubV1) {
    await this.access.assertFlagEnabled(user, flag);
  }

  private assertCapability(user: JwtPayload, capability: (typeof ONDA1_CAPABILITIES)[keyof typeof ONDA1_CAPABILITIES]) {
    this.access.assertCapability(user, capability);
  }

  private async childInScope(childId: string, user: JwtPayload) {
    const child = await this.prisma.child.findFirst({
      where: { id: childId, mantenedoraId: user.mantenedoraId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        unitId: true,
        enrollments: { where: { status: 'ATIVA' }, select: { classroomId: true }, orderBy: { enrollmentDate: 'desc' } },
      },
    });
    if (!child) throw new NotFoundException('Criança não encontrada no escopo da mantenedora.');

    if (this.access.isNetworkScoped(user)) return child;
    if (this.access.isCentralScoped(user)) {
      const staffRole = user.roles?.find((role) => role.level === RoleLevel.STAFF_CENTRAL);
      const scopes = Array.isArray(staffRole?.unitScopes) ? staffRole.unitScopes : [];
      if (scopes.length === 0 || scopes.includes(child.unitId)) return child;
    }
    if (user.unitId === child.unitId) return child;
    if (await this.access.canViewFamilyChild(user, childId)) return child;
    if (this.access.isTeacher(user)) {
      const classrooms = child.enrollments.map((item) => item.classroomId);
      const link = await this.prisma.classroomTeacher.findFirst({
        where: { teacherId: user.sub, isActive: true, classroomId: { in: classrooms } },
        select: { id: true },
      });
      if (link) return child;
    }
    throw new ForbiddenException('Criança fora do escopo do usuário.');
  }

  private dateRange(query: EvidenceLoopQueryDto) {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate ? new Date(query.startDate) : new Date(endDate.getTime() - 90 * 86_400_000);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw new BadRequestException('Período de evidência inválido.');
    }
    return { startDate, endDate };
  }

  private async outbox(
    tx: Prisma.TransactionClient,
    user: JwtPayload,
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Prisma.InputJsonValue,
  ) {
    await tx.domainOutboxEvent.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        eventType,
        aggregateType,
        aggregateId,
        idempotencyKey: `${eventType}:${aggregateId}`,
        payload,
      },
    });
  }

  async child360(childId: string, query: EvidenceLoopQueryDto, user: JwtPayload) {
    await this.assertFlag(user, ONDA1_FEATURE_FLAGS.evidenceLoopV1);
    const child = await this.childInScope(childId, user);
    const { startDate, endDate } = this.dateRange(query);
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);

    const where: Prisma.ChildEvidenceWhereInput = {
      mantenedoraId: user.mantenedoraId,
      childId,
      isActive: true,
      capturedAt: { gte: startDate, lte: endDate },
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.evidenceType ? { evidenceType: query.evidenceType } : {}),
    };
    const cursor = query.cursor ? { id: query.cursor } : undefined;
    const [evidencePage, totalEvidence, bySource, byStatus, alerts, goals, supports, publications, contributions] = await Promise.all([
      this.prisma.childEvidence.findMany({
        where,
        orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor } : {}),
      }),
      this.prisma.childEvidence.count({ where }),
      this.prisma.childEvidence.groupBy({ by: ['sourceType'], where, _count: { _all: true } }),
      this.prisma.childEvidence.groupBy({ by: ['reviewStatus'], where, _count: { _all: true } }),
      this.prisma.alertaOperacional.findMany({
        where: { mantenedoraId: user.mantenedoraId, childId, resolvido: false },
        orderBy: { criadoEm: 'desc' },
        take: 50,
      }),
      this.prisma.childGoal.findMany({ where: { mantenedoraId: user.mantenedoraId, childId, status: { not: Onda1GoalStatus.ENCERRADO } }, orderBy: { startDate: 'desc' }, take: 50 }),
      this.prisma.supportAction.findMany({ where: { mantenedoraId: user.mantenedoraId, childId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.publicationRecord.findMany({ where: { mantenedoraId: user.mantenedoraId, childId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.familyContribution.findMany({ where: { mantenedoraId: user.mantenedoraId, childId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const hasMore = evidencePage.length > limit;
    const evidenceItems = hasMore ? evidencePage.slice(0, limit) : evidencePage;
    const nextCursor = hasMore ? evidenceItems[evidenceItems.length - 1]?.id ?? null : null;
    const longitudinal = await this.evidence.crossAnalysis(childId, { startDate: startDate.toISOString(), endDate: endDate.toISOString() }, user);
    const canViewUrgency = this.access.can(user, ONDA1_CAPABILITIES.operationsViewUrgency);

    return {
      child: { id: child.id, firstName: child.firstName, lastName: child.lastName, photoUrl: child.photoUrl },
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      timeline: { items: evidenceItems, pageInfo: { hasMore, nextCursor } },
      evidence: { items: evidenceItems, total: totalEvidence, pageInfo: { hasMore, nextCursor } },
      quality: {
        coverageDays: new Set(evidenceItems.map((item) => item.capturedAt.toISOString().slice(0, 10))).size,
        bySource: bySource.map((item) => ({ sourceType: item.sourceType, count: item._count._all })),
        byReviewStatus: byStatus.map((item) => ({ reviewStatus: item.reviewStatus, count: item._count._all })),
      },
      goals,
      supports,
      planningLinks: [],
      publications,
      familyContributions: contributions,
      operationalUrgency: canViewUrgency
        ? alerts.map((alert) => ({ id: alert.id, type: alert.tipo, severity: alert.severidade, title: alert.titulo, description: alert.descricao, metadata: alert.metadados, createdAt: alert.criadoEm }))
        : [],
      longitudinalSignals: longitudinal.longitudinal,
      governance: {
        evidenceOnly: true,
        diagnosticInference: false,
        humanReviewRequired: true,
        sourceTraceability: true,
        internalOnly: true,
      },
    };
  }

  async reviewQueue(query: ReviewQueueQueryDto, user: JwtPayload) {
    await this.assertFlag(user, ONDA1_FEATURE_FLAGS.reviewHubV1);
    this.assertCapability(user, ONDA1_CAPABILITIES.evidenceReview);
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
    const where: Prisma.EvidenceReviewTaskWhereInput = {
      mantenedoraId: user.mantenedoraId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
    };
    if (!this.access.isNetworkScoped(user)) {
      where.unitId = user.unitId ?? '__none__';
    }
    const page = await this.prisma.evidenceReviewTask.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'asc' }],
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      include: { evidence: true, child: { select: { id: true, firstName: true, lastName: true } } },
    });
    const hasMore = page.length > limit;
    const items = hasMore ? page.slice(0, limit) : page;
    return { items, pageInfo: { hasMore, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null } };
  }

  async createReviewTask(evidenceId: string, dto: CreateReviewTaskDto, user: JwtPayload) {
    await this.assertFlag(user, ONDA1_FEATURE_FLAGS.reviewHubV1);
    this.assertCapability(user, ONDA1_CAPABILITIES.evidenceReview);
    const evidence = await this.prisma.childEvidence.findFirst({ where: { id: evidenceId, mantenedoraId: user.mantenedoraId, isActive: true } });
    if (!evidence) throw new NotFoundException('Evidência não encontrada no escopo.');
    await this.childInScope(evidence.childId, user);
    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.evidenceReviewTask.create({
        data: {
          mantenedoraId: evidence.mantenedoraId,
          unitId: evidence.unitId,
          childId: evidence.childId,
          evidenceId: evidence.id,
          createdBy: user.sub,
          priority: dto.priority,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          requestNote: dto.requestNote?.trim() || undefined,
        },
      });
      await this.outbox(tx, user, 'EvidenceReviewTaskCreated', 'EvidenceReviewTask', task.id, { taskId: task.id, evidenceId: evidence.id });
      return task;
    });
    await this.audit.log({ action: 'CREATE', entity: 'EVIDENCE_REVIEW_TASK', entityId: created.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: evidence.unitId });
    return created;
  }

  async updateReviewTask(taskId: string, dto: UpdateReviewTaskDto, user: JwtPayload) {
    await this.assertFlag(user, ONDA1_FEATURE_FLAGS.reviewHubV1);
    this.assertCapability(user, ONDA1_CAPABILITIES.evidenceReview);
    const current = await this.prisma.evidenceReviewTask.findFirst({ where: { id: taskId, mantenedoraId: user.mantenedoraId } });
    if (!current) throw new NotFoundException('Tarefa de revisão não encontrada.');
    await this.childInScope(current.childId, user);
    if (current.version !== dto.expectedVersion) throw new ConflictException('A tarefa foi alterada por outro usuário. Recarregue antes de salvar.');
    const validTransitions: Record<Onda1ReviewTaskStatus, Onda1ReviewTaskStatus[]> = {
      OPEN: ['ASSIGNED', 'IN_REVIEW', 'ARCHIVED'],
      ASSIGNED: ['IN_REVIEW', 'NEEDS_CONTEXT', 'ARCHIVED'],
      IN_REVIEW: ['NEEDS_CONTEXT', 'APPROVED', 'REJECTED', 'ARCHIVED'],
      NEEDS_CONTEXT: ['IN_REVIEW', 'ARCHIVED'],
      APPROVED: ['ARCHIVED'],
      REJECTED: ['OPEN', 'ARCHIVED'],
      ARCHIVED: [],
    };
    if (current.status !== dto.status && !validTransitions[current.status].includes(dto.status)) {
      throw new BadRequestException(`Transição inválida: ${current.status} → ${dto.status}`);
    }
    const resolved = ['APPROVED', 'REJECTED', 'ARCHIVED'].includes(dto.status);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.evidenceReviewTask.updateMany({
        where: { id: taskId, mantenedoraId: user.mantenedoraId, version: dto.expectedVersion },
        data: {
          status: dto.status,
          assignedTo: dto.assignedTo ?? current.assignedTo,
          decisionNote: dto.decisionNote?.trim() ?? current.decisionNote,
          actionTaken: dto.actionTaken?.trim() ?? current.actionTaken,
          resolvedBy: resolved ? user.sub : current.resolvedBy,
          resolvedAt: resolved ? new Date() : current.resolvedAt,
          archivedAt: dto.status === 'ARCHIVED' ? new Date() : current.archivedAt,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('A tarefa foi alterada durante a gravação.');
      await this.outbox(tx, user, 'EvidenceReviewTaskUpdated', 'EvidenceReviewTask', taskId, { taskId, from: current.status, to: dto.status });
      return tx.evidenceReviewTask.findUniqueOrThrow({ where: { id: taskId } });
    });
    await this.audit.log({ action: 'UPDATE', entity: 'EVIDENCE_REVIEW_TASK', entityId: updated.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: updated.unitId, changes: { from: current.status, to: updated.status } });
    return updated;
  }

  async createGoal(childId: string, dto: CreateGoalDto, user: JwtPayload) {
    await this.assertFlag(user, ONDA1_FEATURE_FLAGS.evidenceLoopV1);
    this.assertCapability(user, ONDA1_CAPABILITIES.goalManage);
    const child = await this.childInScope(childId, user);
    const goal = await this.prisma.$transaction(async (tx) => {
      const created = await tx.childGoal.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: child.unitId,
          childId,
          goalType: dto.goalType,
          title: dto.title.trim(),
          description: dto.description?.trim() || undefined,
          frameworkId: dto.frameworkId,
          frameworkObjectiveId: dto.frameworkObjectiveId,
          criteria: dto.criteria as Prisma.InputJsonValue | undefined,
          familyVisible: dto.familyVisible ?? false,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          createdBy: user.sub,
        },
      });
      await this.outbox(tx, user, 'GoalCreated', 'ChildGoal', created.id, { goalId: created.id, childId });
      return created;
    });
    await this.audit.log({ action: 'CREATE', entity: 'CHILD_GOAL', entityId: goal.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: child.unitId });
    return goal;
  }

  async listGoals(childId: string, user: JwtPayload) {
    await this.assertFlag(user, ONDA1_FEATURE_FLAGS.evidenceLoopV1);
    const child = await this.childInScope(childId, user);
    const goals = await this.prisma.childGoal.findMany({ where: { mantenedoraId: user.mantenedoraId, unitId: child.unitId, childId }, orderBy: { startDate: 'desc' }, include: { supports: true } });
    if (this.access.can(user, ONDA1_CAPABILITIES.evidenceViewSensitive)) return goals;
    return goals.map(({ supports, ...goal }) => ({ ...goal, supports: supports.filter((support) => support.status !== Onda1SupportStatus.PLANEJADO) }));
  }

  async updateGoal(childId: string, goalId: string, dto: UpdateGoalDto, user: JwtPayload) {
    await this.assertFlag(user, ONDA1_FEATURE_FLAGS.evidenceLoopV1);
    this.assertCapability(user, ONDA1_CAPABILITIES.goalManage);
    const child = await this.childInScope(childId, user);
    const current = await this.prisma.childGoal.findFirst({ where: { id: goalId, childId, mantenedoraId: user.mantenedoraId, unitId: child.unitId } });
    if (!current) throw new NotFoundException('Objetivo não encontrado.');
    const updated = await this.prisma.childGoal.update({ where: { id: goalId }, data: { ...dto, title: dto.title?.trim(), description: dto.description?.trim(), criteria: dto.criteria as Prisma.InputJsonValue | undefined, closedBy: dto.status && dto.status !== Onda1GoalStatus.ATIVO ? user.sub : undefined, closedAt: dto.status && dto.status !== Onda1GoalStatus.ATIVO ? new Date() : undefined } });
    await this.audit.log({ action: 'UPDATE', entity: 'CHILD_GOAL', entityId: updated.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: child.unitId, changes: { status: dto.status } });
    return updated;
  }

  async createSupport(childId: string, goalId: string, dto: CreateSupportActionDto, user: JwtPayload) {
    await this.assertFlag(user, ONDA1_FEATURE_FLAGS.evidenceLoopV1);
    this.assertCapability(user, ONDA1_CAPABILITIES.goalManage);
    const child = await this.childInScope(childId, user);
    const goal = await this.prisma.childGoal.findFirst({ where: { id: goalId, childId, mantenedoraId: user.mantenedoraId, unitId: child.unitId } });
    if (!goal) throw new NotFoundException('Objetivo não encontrado.');
    if (dto.evidenceId) {
      const evidence = await this.prisma.childEvidence.findFirst({ where: { id: dto.evidenceId, childId, mantenedoraId: user.mantenedoraId } });
      if (!evidence) throw new NotFoundException('Evidência não encontrada para o suporte.');
    }
    const support = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportAction.create({ data: { mantenedoraId: user.mantenedoraId, unitId: child.unitId, childId, goalId, evidenceId: dto.evidenceId, action: dto.action.trim(), context: dto.context?.trim(), executor: dto.executor.trim(), attemptedAt: dto.attemptedAt ? new Date(dto.attemptedAt) : undefined, createdBy: user.sub } });
      await this.outbox(tx, user, 'SupportRecorded', 'SupportAction', created.id, { supportId: created.id, goalId, childId });
      return created;
    });
    await this.audit.log({ action: 'CREATE', entity: 'SUPPORT_ACTION', entityId: support.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: child.unitId });
    return support;
  }

  async updateSupportOutcome(id: string, dto: UpdateSupportOutcomeDto, user: JwtPayload) {
    await this.assertFlag(user, ONDA1_FEATURE_FLAGS.evidenceLoopV1);
    this.assertCapability(user, ONDA1_CAPABILITIES.goalManage);
    const current = await this.prisma.supportAction.findFirst({ where: { id, mantenedoraId: user.mantenedoraId } });
    if (!current) throw new NotFoundException('Suporte não encontrado.');
    await this.childInScope(current.childId, user);
    const updated = await this.prisma.supportAction.update({ where: { id }, data: { status: dto.status, observedResponse: dto.observedResponse?.trim(), reviewedAt: new Date(), reviewedBy: user.sub } });
    await this.audit.log({ action: 'UPDATE', entity: 'SUPPORT_ACTION', entityId: updated.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: updated.unitId, changes: { status: dto.status } });
    return updated;
  }

  async linkEvidence(evidenceId: string, dto: CreateEvidenceLinkDto, user: JwtPayload) {
    await this.assertFlag(user, ONDA1_FEATURE_FLAGS.evidenceLoopV1);
    this.assertCapability(user, ONDA1_CAPABILITIES.goalManage);
    const evidence = await this.prisma.childEvidence.findFirst({ where: { id: evidenceId, mantenedoraId: user.mantenedoraId, isActive: true } });
    if (!evidence) throw new NotFoundException('Evidência não encontrada.');
    await this.childInScope(evidence.childId, user);
    const link = await this.prisma.evidenceLink.upsert({
      where: { evidenceId_targetType_targetId_relationType: { evidenceId, targetType: dto.targetType, targetId: dto.targetId, relationType: dto.relationType } },
      create: { mantenedoraId: evidence.mantenedoraId, unitId: evidence.unitId, childId: evidence.childId, evidenceId, targetType: dto.targetType, targetId: dto.targetId, relationType: dto.relationType, context: dto.context as Prisma.InputJsonValue | undefined, createdBy: user.sub },
      update: { context: dto.context as Prisma.InputJsonValue | undefined },
    });
    await this.audit.log({ action: 'CREATE', entity: 'EVIDENCE_LINK', entityId: link.id, userId: user.sub, mantenedoraId: user.mantenedoraId, unitId: evidence.unitId });
    return link;
  }
}
