import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditLogEntity,
  EnrollmentStatus,
  JourneyDuplicateReviewStatus,
  JourneyOfferStatus,
  JourneyStage,
  JourneyTaskStatus,
  JourneyVisitEventType,
  JourneyVisitStatus,
  JourneyWaitlistEntryStatus,
  JourneyWaitlistPolicyStatus,
  Prisma,
  UserStatus,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { AuditService } from "../common/services/audit.service";
import type { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import {
  JOURNEY_FORBIDDEN_TERMS,
  JOURNEY_GOVERNANCE,
} from "./journey.constants";
import { JourneyAccessService } from "./journey-access.service";
import {
  ChangeJourneyStageDto,
  CreateJourneyActivityDto,
  CreateJourneyOfferDto,
  CreateJourneyPolicyDto,
  CreateJourneyProspectDto,
  CreateJourneyTaskDto,
  CreateJourneyVisitDto,
  DecideJourneyOfferDto,
  JourneyDashboardQueryDto,
  JourneyDuplicateReviewDto,
  JourneyListQueryDto,
  JourneyVisitActionDto,
  JoinJourneyWaitlistDto,
  PublishJourneyPolicyDto,
  RescheduleJourneyVisitDto,
} from "./dto/journey.dto";

type JourneyTx = Prisma.TransactionClient;

@Injectable()
export class JourneyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: JourneyAccessService,
    private readonly audit: AuditService,
  ) {}

  private normalize(value?: string): string | undefined {
    const normalized = value?.trim().toLocaleLowerCase("pt-BR");
    return normalized ? normalized : undefined;
  }

  private hash(value?: string): string | undefined {
    const normalized = this.normalize(value);
    return normalized
      ? createHash("sha256").update(normalized).digest("hex")
      : undefined;
  }

  private date(value: string | undefined, field: string): Date | undefined {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} inválida`);
    }
    return parsed;
  }

  private dateRequired(value: string, field: string): Date {
    const parsed = this.date(value, field);
    if (!parsed) throw new BadRequestException(`${field} é obrigatória`);
    return parsed;
  }

  private ensureRange(min: number, max: number, label: string): void {
    if (
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      min < 0 ||
      max < min
    ) {
      throw new BadRequestException(`Intervalo de ${label} inválido`);
    }
  }

  private ensureTimeRange(startsAt: Date, endsAt: Date): void {
    if (endsAt <= startsAt)
      throw new BadRequestException("O fim deve ser posterior ao início");
  }

  private rejectSensitiveContent(values: Array<string | undefined>): void {
    const content = values
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const term = JOURNEY_FORBIDDEN_TERMS.find((candidate) =>
      content.includes(candidate),
    );
    if (term) {
      throw new BadRequestException(
        "O Journey aceita somente dados de captação permitidos",
      );
    }
  }

  private assertPriorityDefinition(definition: Record<string, unknown>): void {
    const serialized = JSON.stringify(definition)
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const term = JOURNEY_FORBIDDEN_TERMS.find((candidate) =>
      serialized.includes(candidate),
    );
    if (term) {
      throw new BadRequestException("A política contém critério não permitido");
    }
    const allowedKeys = new Set([
      "desiredDate",
      "ageGroupMatch",
      "periodMatch",
      "createdAt",
    ]);
    const invalidKey = Object.keys(definition).find(
      (key) => !allowedKeys.has(key),
    );
    if (invalidKey) {
      throw new BadRequestException(
        `Critério de prioridade não permitido: ${invalidKey}`,
      );
    }
  }

  private publicProspect(prospect: {
    id: string;
    unitId: string;
    responsibleName: string;
    childName: string;
    email: string | null;
    phone: string | null;
    source: string;
    ageGroupMinMonths: number;
    ageGroupMaxMonths: number;
    period: string;
    desiredDate: Date | null;
    consentCapture: boolean;
    consentContact: boolean;
    stage: JourneyStage;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: prospect.id,
      unitId: prospect.unitId,
      responsibleName: prospect.responsibleName,
      childName: prospect.childName,
      email: prospect.email,
      phone: prospect.phone,
      source: prospect.source,
      ageGroupMinMonths: prospect.ageGroupMinMonths,
      ageGroupMaxMonths: prospect.ageGroupMaxMonths,
      period: prospect.period,
      desiredDate: prospect.desiredDate,
      consentCapture: prospect.consentCapture,
      consentContact: prospect.consentContact,
      stage: prospect.stage,
      version: prospect.version,
      createdAt: prospect.createdAt,
      updatedAt: prospect.updatedAt,
    };
  }

  private async assertActiveUser(
    user: JwtPayload,
    userId?: string,
  ): Promise<void> {
    if (!userId) return;
    const target = await this.prisma.user.findFirst({
      where: {
        id: userId,
        mantenedoraId: user.mantenedoraId,
        status: UserStatus.ATIVO,
      },
      select: { id: true },
    });
    if (!target)
      throw new BadRequestException(
        "Responsável interno não encontrado ou inativo",
      );
  }

  private async outbox(
    tx: JourneyTx,
    params: {
      mantenedoraId: string;
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      idempotencyKey: string;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    await tx.domainOutboxEvent.create({
      data: {
        mantenedoraId: params.mantenedoraId,
        eventType: params.eventType,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        idempotencyKey: params.idempotencyKey,
        payload: params.payload as Prisma.InputJsonValue,
      },
    });
  }

  private async appendStageEvent(
    tx: JourneyTx,
    params: {
      mantenedoraId: string;
      unitId: string;
      prospectId: string;
      fromStage: JourneyStage | null;
      toStage: JourneyStage;
      actorUserId: string;
      idempotencyKey: string;
      reason?: string;
    },
  ): Promise<void> {
    await tx.journeyProspectStageEvent.create({
      data: {
        mantenedoraId: params.mantenedoraId,
        unitId: params.unitId,
        prospectId: params.prospectId,
        fromStage: params.fromStage,
        toStage: params.toStage,
        reason: params.reason,
        actorUserId: params.actorUserId,
        idempotencyKey: params.idempotencyKey,
      },
    });
  }

  private async transitionIfNeeded(
    tx: JourneyTx,
    params: {
      prospectId: string;
      toStage: JourneyStage;
      actorUserId: string;
      idempotencyKey: string;
      reason?: string;
    },
  ) {
    const prospect = await tx.journeyProspect.findUnique({
      where: { id: params.prospectId },
    });
    if (!prospect) throw new NotFoundException("Interessado não encontrado");
    if (prospect.stage === params.toStage) return prospect;
    await tx.journeyProspect.update({
      where: { id: prospect.id },
      data: { stage: params.toStage, version: { increment: 1 } },
    });
    await this.appendStageEvent(tx, {
      mantenedoraId: prospect.mantenedoraId,
      unitId: prospect.unitId,
      prospectId: prospect.id,
      fromStage: prospect.stage,
      toStage: params.toStage,
      actorUserId: params.actorUserId,
      idempotencyKey: params.idempotencyKey,
      reason: params.reason,
    });
    return {
      ...prospect,
      stage: params.toStage,
      version: prospect.version + 1,
    };
  }

  async listUnits(user: JwtPayload) {
    await this.access.assertAccess(user, "journey.read");
    const ids = await this.access.accessibleUnitIds(user);
    return this.prisma.unit.findMany({
      where: {
        mantenedoraId: user.mantenedoraId,
        isActive: true,
        id: { in: ids },
      },
      select: { id: true, name: true, code: true, capacity: true },
      orderBy: { name: "asc" },
    });
  }

  async createProspect(dto: CreateJourneyProspectDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.manage");
    await this.access.assertUnitAccess(user, dto.unitId);
    this.ensureRange(
      dto.ageGroupMinMonths,
      dto.ageGroupMaxMonths,
      "faixa etária",
    );
    if (!dto.email && !dto.phone && !dto.declaredIdentity) {
      throw new BadRequestException(
        "Informe e-mail, telefone ou identidade declarada para deduplicação",
      );
    }
    this.rejectSensitiveContent([
      dto.responsibleName,
      dto.childName,
      dto.email,
      dto.phone,
      dto.declaredIdentityType,
      dto.declaredIdentity,
      dto.source,
      dto.period,
    ]);

    const emailHash = this.hash(dto.email);
    const phoneHash = this.hash(dto.phone);
    const declaredIdentityHash = this.hash(dto.declaredIdentity);
    const desiredDate = this.date(dto.desiredDate, "Data desejada");

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.journeyProspect.findUnique({
        where: {
          mantenedoraId_idempotencyKey: {
            mantenedoraId: user.mantenedoraId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });
      if (existing) return { prospect: existing, possibleDuplicates: [] };

      const or: Prisma.JourneyProspectWhereInput[] = [];
      if (emailHash) or.push({ emailHash });
      if (phoneHash) or.push({ phoneHash });
      if (declaredIdentityHash) or.push({ declaredIdentityHash });
      const candidates = or.length
        ? await tx.journeyProspect.findMany({
            where: {
              mantenedoraId: user.mantenedoraId,
              mergedIntoId: null,
              OR: or,
            },
            select: {
              id: true,
              unitId: true,
              responsibleName: true,
              childName: true,
              stage: true,
              emailHash: true,
              phoneHash: true,
              declaredIdentityHash: true,
            },
            take: 20,
          })
        : [];

      const prospect = await tx.journeyProspect.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: dto.unitId,
          responsibleName: dto.responsibleName.trim(),
          childName: dto.childName.trim(),
          email: dto.email?.trim() || null,
          phone: dto.phone?.trim() || null,
          emailHash: emailHash ?? null,
          phoneHash: phoneHash ?? null,
          declaredIdentityType: dto.declaredIdentityType?.trim() || null,
          declaredIdentityHash: declaredIdentityHash ?? null,
          source: dto.source.trim(),
          ageGroupMinMonths: dto.ageGroupMinMonths,
          ageGroupMaxMonths: dto.ageGroupMaxMonths,
          period: dto.period.trim(),
          desiredDate: desiredDate ?? null,
          consentCapture: dto.consentCapture,
          consentContact: dto.consentContact,
          createdBy: user.sub,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      await this.appendStageEvent(tx, {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        prospectId: prospect.id,
        fromStage: null,
        toStage: JourneyStage.NOVO,
        actorUserId: user.sub,
        idempotencyKey: `${dto.idempotencyKey}:stage`,
      });
      for (const candidate of candidates) {
        const matchReasons = [
          candidate.emailHash && candidate.emailHash === emailHash
            ? "email"
            : null,
          candidate.phoneHash && candidate.phoneHash === phoneHash
            ? "phone"
            : null,
          candidate.declaredIdentityHash &&
          candidate.declaredIdentityHash === declaredIdentityHash
            ? "declaredIdentity"
            : null,
        ].filter((reason): reason is string => Boolean(reason));
        await tx.journeyDuplicateReview.upsert({
          where: {
            primaryProspectId_duplicateProspectId: {
              primaryProspectId: candidate.id,
              duplicateProspectId: prospect.id,
            },
          },
          create: {
            mantenedoraId: user.mantenedoraId,
            primaryProspectId: candidate.id,
            duplicateProspectId: prospect.id,
            matchReasons,
            idempotencyKey: `${user.mantenedoraId}:journey.duplicate:${dto.idempotencyKey}:${candidate.id}`,
          },
          update: { matchReasons },
        });
      }
      await this.outbox(tx, {
        mantenedoraId: user.mantenedoraId,
        eventType: "journey.prospect.created",
        aggregateType: "JourneyProspect",
        aggregateId: prospect.id,
        idempotencyKey: `${user.mantenedoraId}:journey.prospect.created:${dto.idempotencyKey}`,
        payload: { prospectId: prospect.id, unitId: dto.unitId },
      });
      return {
        possibleDuplicates: candidates.map(
          ({ id, unitId, responsibleName, childName, stage }) => ({
            id,
            unitId,
            responsibleName,
            childName,
            stage,
          }),
        ),
        prospect,
      };
    });

    await this.audit.logCreate(
      AuditLogEntity.JOURNEY_PROSPECT,
      result.prospect.id,
      user.sub,
      user.mantenedoraId,
      result.prospect.unitId,
      {
        stage: result.prospect.stage,
        possibleDuplicateCount: result.possibleDuplicates.length,
      },
    );
    return {
      prospect: this.publicProspect(result.prospect),
      possibleDuplicates: result.possibleDuplicates,
    };
  }

  async listProspects(query: JourneyListQueryDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.read");
    const unitIds = await this.access.accessibleUnitIds(user, query.unitId);
    return this.prisma.journeyProspect.findMany({
      where: {
        mantenedoraId: user.mantenedoraId,
        unitId: { in: unitIds },
        mergedIntoId: null,
        stage: query.stage,
      },
      select: {
        id: true,
        unitId: true,
        responsibleName: true,
        childName: true,
        email: true,
        phone: true,
        source: true,
        ageGroupMinMonths: true,
        ageGroupMaxMonths: true,
        period: true,
        desiredDate: true,
        consentCapture: true,
        consentContact: true,
        stage: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { visits: true, activities: true, tasks: true, offers: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: query.limit,
      skip: query.offset,
    });
  }

  async getProspect(id: string, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.read");
    const prospect = await this.access.assertProspectAccess(user, id);
    return this.prisma.journeyProspect.findUnique({
      where: { id: prospect.id },
      select: {
        id: true,
        mantenedoraId: true,
        unitId: true,
        responsibleName: true,
        childName: true,
        email: true,
        phone: true,
        declaredIdentityType: true,
        source: true,
        ageGroupMinMonths: true,
        ageGroupMaxMonths: true,
        period: true,
        desiredDate: true,
        consentCapture: true,
        consentContact: true,
        stage: true,
        mergedIntoId: true,
        version: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        stageEvents: { orderBy: { createdAt: "asc" } },
        activities: { orderBy: { occurredAt: "desc" } },
        tasks: { orderBy: { dueAt: "asc" } },
        visits: {
          orderBy: { startsAt: "asc" },
          include: { events: { orderBy: { createdAt: "asc" } } },
        },
        offers: {
          orderBy: { createdAt: "desc" },
          include: {
            classroom: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }

  async changeStage(id: string, dto: ChangeJourneyStageDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.manage");
    const current = await this.access.assertProspectAccess(user, id);
    this.rejectSensitiveContent([dto.reason]);
    const existingEvent =
      await this.prisma.journeyProspectStageEvent.findUnique({
        where: {
          mantenedoraId_idempotencyKey: {
            mantenedoraId: user.mantenedoraId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });
    if (existingEvent) return this.getProspect(id, user);
    if (
      current.stage === JourneyStage.ARQUIVADO &&
      dto.toStage !== JourneyStage.ARQUIVADO
    ) {
      throw new ConflictException(
        "Interessado arquivado não pode ser reaberto nesta fatia",
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const prospect = await tx.journeyProspect.findUnique({ where: { id } });
      if (!prospect) throw new NotFoundException("Interessado não encontrado");
      if (prospect.stage === dto.toStage) return prospect;
      const changed = await tx.journeyProspect.update({
        where: { id },
        data: { stage: dto.toStage, version: { increment: 1 } },
      });
      await this.appendStageEvent(tx, {
        mantenedoraId: user.mantenedoraId,
        unitId: prospect.unitId,
        prospectId: id,
        fromStage: prospect.stage,
        toStage: dto.toStage,
        reason: dto.reason,
        actorUserId: user.sub,
        idempotencyKey: dto.idempotencyKey,
      });
      await this.outbox(tx, {
        mantenedoraId: user.mantenedoraId,
        eventType: "journey.prospect.stage_changed",
        aggregateType: "JourneyProspect",
        aggregateId: id,
        idempotencyKey: `${user.mantenedoraId}:journey.stage:${dto.idempotencyKey}`,
        payload: {
          prospectId: id,
          fromStage: prospect.stage,
          toStage: dto.toStage,
        },
      });
      return changed;
    });
    await this.audit.logUpdate(
      AuditLogEntity.JOURNEY_PROSPECT,
      id,
      user.sub,
      user.mantenedoraId,
      updated.unitId,
      { stage: current.stage },
      { stage: updated.stage },
    );
    return this.getProspect(id, user);
  }

  async createActivity(
    id: string,
    dto: CreateJourneyActivityDto,
    user: JwtPayload,
  ) {
    await this.access.assertAccess(user, "journey.manage");
    const prospect = await this.access.assertProspectAccess(user, id);
    this.rejectSensitiveContent([dto.title, dto.note, dto.nextAction]);
    const existing = await this.prisma.journeyActivity.findUnique({
      where: {
        mantenedoraId_idempotencyKey: {
          mantenedoraId: user.mantenedoraId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
    if (existing) return existing;
    const activity = await this.prisma.journeyActivity.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: prospect.unitId,
        prospectId: id,
        type: dto.type,
        title: dto.title.trim(),
        note: dto.note?.trim() || null,
        occurredAt:
          this.date(dto.occurredAt, "Data da interação") ?? new Date(),
        nextAction: dto.nextAction?.trim() || null,
        actorUserId: user.sub,
        idempotencyKey: dto.idempotencyKey,
      },
    });
    await this.audit.logCreate(
      AuditLogEntity.JOURNEY_PROSPECT,
      activity.id,
      user.sub,
      user.mantenedoraId,
      prospect.unitId,
      { type: dto.type, prospectId: id },
    );
    return activity;
  }

  async createTask(id: string, dto: CreateJourneyTaskDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.manage");
    const prospect = await this.access.assertProspectAccess(user, id);
    await this.assertActiveUser(user, dto.assignedTo);
    this.rejectSensitiveContent([dto.title]);
    const existing = await this.prisma.journeyTask.findUnique({
      where: {
        mantenedoraId_idempotencyKey: {
          mantenedoraId: user.mantenedoraId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
    if (existing) return existing;
    return this.prisma.journeyTask.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: prospect.unitId,
        prospectId: id,
        title: dto.title.trim(),
        dueAt: this.date(dto.dueAt, "Prazo"),
        assignedTo: dto.assignedTo ?? null,
        createdBy: user.sub,
        idempotencyKey: dto.idempotencyKey,
      },
    });
  }

  async completeTask(id: string, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.manage");
    const task = await this.prisma.journeyTask.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
    });
    if (!task)
      throw new NotFoundException("Tarefa não encontrada no escopo autorizado");
    await this.access.assertUnitAccess(user, task.unitId);
    if (task.status === JourneyTaskStatus.CONCLUIDA) return task;
    return this.prisma.journeyTask.update({
      where: { id },
      data: {
        status: JourneyTaskStatus.CONCLUIDA,
        completedBy: user.sub,
        completedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async createVisit(dto: CreateJourneyVisitDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.manage");
    await this.access.assertUnitAccess(user, dto.unitId);
    const prospect = await this.access.assertProspectAccess(
      user,
      dto.prospectId,
    );
    if (prospect.unitId !== dto.unitId)
      throw new NotFoundException(
        "Interessado não pertence à unidade informada",
      );
    await this.assertActiveUser(user, dto.assignedTo);
    const startsAt = this.dateRequired(dto.startsAt, "Início da visita");
    const endsAt = this.dateRequired(dto.endsAt, "Fim da visita");
    this.ensureTimeRange(startsAt, endsAt);
    this.rejectSensitiveContent([dto.notes]);

    const existing = await this.prisma.journeyVisit.findUnique({
      where: {
        mantenedoraId_idempotencyKey: {
          mantenedoraId: user.mantenedoraId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
      include: { events: true },
    });
    if (existing) return existing;

    const visit = await this.prisma.$transaction(async (tx) => {
      const conflict = await tx.journeyVisit.findFirst({
        where: {
          mantenedoraId: user.mantenedoraId,
          unitId: dto.unitId,
          prospectId: dto.prospectId,
          status: {
            in: [JourneyVisitStatus.AGENDADA, JourneyVisitStatus.REAGENDADA],
          },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          ...(dto.assignedTo ? { assignedTo: dto.assignedTo } : {}),
        },
        select: { id: true },
      });
      if (conflict)
        throw new ConflictException(
          "Há outra visita no mesmo horário para este responsável",
        );
      const created = await tx.journeyVisit.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: dto.unitId,
          prospectId: dto.prospectId,
          startsAt,
          endsAt,
          assignedTo: dto.assignedTo ?? null,
          notes: dto.notes?.trim() || null,
          createdBy: user.sub,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      await tx.journeyVisitEvent.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: dto.unitId,
          visitId: created.id,
          type: JourneyVisitEventType.CRIADA,
          startsAt,
          endsAt,
          actorUserId: user.sub,
          idempotencyKey: `${dto.idempotencyKey}:event`,
        },
      });
      await this.transitionIfNeeded(tx, {
        prospectId: dto.prospectId,
        toStage: JourneyStage.VISITA_AGENDADA,
        actorUserId: user.sub,
        idempotencyKey: `${dto.idempotencyKey}:stage`,
      });
      await this.outbox(tx, {
        mantenedoraId: user.mantenedoraId,
        eventType: "journey.visit.created",
        aggregateType: "JourneyVisit",
        aggregateId: created.id,
        idempotencyKey: `${user.mantenedoraId}:journey.visit.created:${dto.idempotencyKey}`,
        payload: {
          visitId: created.id,
          prospectId: dto.prospectId,
          unitId: dto.unitId,
        },
      });
      return created;
    });
    await this.audit.logCreate(
      AuditLogEntity.JOURNEY_VISIT,
      visit.id,
      user.sub,
      user.mantenedoraId,
      dto.unitId,
      { prospectId: dto.prospectId },
    );
    return this.getVisit(visit.id, user);
  }

  async getVisit(id: string, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.read");
    const visit = await this.prisma.journeyVisit.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        prospect: {
          select: {
            id: true,
            responsibleName: true,
            childName: true,
            stage: true,
          },
        },
      },
    });
    if (!visit)
      throw new NotFoundException("Visita não encontrada no escopo autorizado");
    await this.access.assertUnitAccess(user, visit.unitId);
    return visit;
  }

  async listVisits(query: JourneyListQueryDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.read");
    const unitIds = await this.access.accessibleUnitIds(user, query.unitId);
    return this.prisma.journeyVisit.findMany({
      where: { mantenedoraId: user.mantenedoraId, unitId: { in: unitIds } },
      include: {
        prospect: {
          select: {
            id: true,
            responsibleName: true,
            childName: true,
            stage: true,
          },
        },
      },
      orderBy: { startsAt: "asc" },
      take: query.limit,
      skip: query.offset,
    });
  }

  private async updateVisitEvent(
    id: string,
    type: JourneyVisitEventType,
    status: JourneyVisitStatus,
    dto: JourneyVisitActionDto,
    user: JwtPayload,
  ) {
    await this.access.assertAccess(user, "journey.manage");
    const current = await this.prisma.journeyVisit.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
    });
    if (!current)
      throw new NotFoundException("Visita não encontrada no escopo autorizado");
    await this.access.assertUnitAccess(user, current.unitId);
    this.rejectSensitiveContent([dto.note]);
    const existing = await this.prisma.journeyVisitEvent.findUnique({
      where: {
        mantenedoraId_idempotencyKey: {
          mantenedoraId: user.mantenedoraId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
    if (existing) return this.getVisit(id, user);
    await this.prisma.$transaction(async (tx) => {
      const visit = await tx.journeyVisit.findUnique({ where: { id } });
      if (!visit) throw new NotFoundException("Visita não encontrada");
      await tx.journeyVisit.update({
        where: { id },
        data: { status, version: { increment: 1 } },
      });
      await tx.journeyVisitEvent.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: visit.unitId,
          visitId: id,
          type,
          note: dto.note?.trim() || null,
          actorUserId: user.sub,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      if (type === JourneyVisitEventType.PRESENCA_CONFIRMADA) {
        await this.transitionIfNeeded(tx, {
          prospectId: visit.prospectId,
          toStage: JourneyStage.VISITA_REALIZADA,
          actorUserId: user.sub,
          idempotencyKey: `${dto.idempotencyKey}:stage`,
        });
      }
    });
    return this.getVisit(id, user);
  }

  async rescheduleVisit(
    id: string,
    dto: RescheduleJourneyVisitDto,
    user: JwtPayload,
  ) {
    await this.access.assertAccess(user, "journey.manage");
    const current = await this.prisma.journeyVisit.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
    });
    if (!current)
      throw new NotFoundException("Visita não encontrada no escopo autorizado");
    await this.access.assertUnitAccess(user, current.unitId);
    const startsAt = this.dateRequired(dto.startsAt, "Início da visita");
    const endsAt = this.dateRequired(dto.endsAt, "Fim da visita");
    this.ensureTimeRange(startsAt, endsAt);
    this.rejectSensitiveContent([dto.note]);
    const existing = await this.prisma.journeyVisitEvent.findUnique({
      where: {
        mantenedoraId_idempotencyKey: {
          mantenedoraId: user.mantenedoraId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
    if (existing) return this.getVisit(id, user);
    await this.prisma.$transaction(async (tx) => {
      const visit = await tx.journeyVisit.findUnique({ where: { id } });
      if (
        !visit ||
        visit.status === JourneyVisitStatus.CANCELADA ||
        visit.status === JourneyVisitStatus.REALIZADA
      )
        throw new ConflictException(
          "Visita não pode ser reagendada neste estado",
        );
      const conflict = await tx.journeyVisit.findFirst({
        where: {
          id: { not: id },
          mantenedoraId: user.mantenedoraId,
          unitId: visit.unitId,
          prospectId: visit.prospectId,
          status: {
            in: [JourneyVisitStatus.AGENDADA, JourneyVisitStatus.REAGENDADA],
          },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          ...(visit.assignedTo ? { assignedTo: visit.assignedTo } : {}),
        },
        select: { id: true },
      });
      if (conflict)
        throw new ConflictException(
          "Há outra visita no mesmo horário para este responsável",
        );
      await tx.journeyVisit.update({
        where: { id },
        data: {
          startsAt,
          endsAt,
          status: JourneyVisitStatus.REAGENDADA,
          version: { increment: 1 },
        },
      });
      await tx.journeyVisitEvent.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: visit.unitId,
          visitId: id,
          type: JourneyVisitEventType.REAGENDADA,
          previousStartsAt: visit.startsAt,
          previousEndsAt: visit.endsAt,
          startsAt,
          endsAt,
          note: dto.note?.trim() || null,
          actorUserId: user.sub,
          idempotencyKey: dto.idempotencyKey,
        },
      });
    });
    return this.getVisit(id, user);
  }

  cancelVisit(id: string, dto: JourneyVisitActionDto, user: JwtPayload) {
    return this.updateVisitEvent(
      id,
      JourneyVisitEventType.CANCELADA,
      JourneyVisitStatus.CANCELADA,
      dto,
      user,
    );
  }

  confirmVisit(id: string, dto: JourneyVisitActionDto, user: JwtPayload) {
    return this.updateVisitEvent(
      id,
      JourneyVisitEventType.PRESENCA_CONFIRMADA,
      JourneyVisitStatus.REALIZADA,
      dto,
      user,
    );
  }

  markVisitAbsence(id: string, dto: JourneyVisitActionDto, user: JwtPayload) {
    return this.updateVisitEvent(
      id,
      JourneyVisitEventType.AUSENCIA_REGISTRADA,
      JourneyVisitStatus.AUSENCIA,
      dto,
      user,
    );
  }

  registerVisitFollowUp(
    id: string,
    dto: JourneyVisitActionDto,
    user: JwtPayload,
  ) {
    return this.updateVisitEvent(
      id,
      JourneyVisitEventType.FOLLOW_UP_REGISTRADO,
      JourneyVisitStatus.REALIZADA,
      dto,
      user,
    );
  }

  async createPolicy(dto: CreateJourneyPolicyDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.waitlist.manage");
    await this.access.assertUnitAccess(user, dto.unitId);
    this.ensureRange(
      dto.ageGroupMinMonths,
      dto.ageGroupMaxMonths,
      "faixa etária da política",
    );
    const effectiveFrom = this.dateRequired(
      dto.effectiveFrom,
      "Vigência inicial",
    );
    const effectiveTo = this.date(dto.effectiveTo, "Vigência final");
    if (effectiveTo && effectiveTo <= effectiveFrom)
      throw new BadRequestException("Vigência final inválida");
    this.assertPriorityDefinition(dto.priorityDefinition);
    const existing = await this.prisma.journeyWaitlistPolicyVersion.findUnique({
      where: {
        mantenedoraId_idempotencyKey: {
          mantenedoraId: user.mantenedoraId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
    if (existing) return existing;
    const policy = await this.prisma.journeyWaitlistPolicyVersion.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        programKey: dto.programKey.trim(),
        ageGroupMinMonths: dto.ageGroupMinMonths,
        ageGroupMaxMonths: dto.ageGroupMaxMonths,
        period: dto.period.trim(),
        version: dto.version,
        effectiveFrom,
        effectiveTo: effectiveTo ?? null,
        priorityDefinition: dto.priorityDefinition as Prisma.InputJsonValue,
        createdBy: user.sub,
        idempotencyKey: dto.idempotencyKey,
      },
    });
    await this.audit.logCreate(
      AuditLogEntity.JOURNEY_WAITLIST,
      policy.id,
      user.sub,
      user.mantenedoraId,
      dto.unitId,
      { version: policy.version, status: policy.status },
    );
    return policy;
  }

  async reviewPolicy(id: string, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.waitlist.manage");
    const policy = await this.prisma.journeyWaitlistPolicyVersion.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
    });
    if (!policy)
      throw new NotFoundException(
        "Política não encontrada no escopo autorizado",
      );
    await this.access.assertUnitAccess(user, policy.unitId);
    if (policy.createdBy === user.sub)
      throw new ConflictException(
        "Revisão exige ator diferente de quem criou a política",
      );
    const reviewed = await this.prisma.journeyWaitlistPolicyVersion.update({
      where: { id },
      data: { reviewedBy: user.sub, reviewedAt: new Date() },
    });
    await this.audit.logUpdate(
      AuditLogEntity.JOURNEY_WAITLIST,
      id,
      user.sub,
      user.mantenedoraId,
      policy.unitId,
      { reviewedBy: policy.reviewedBy, reviewedAt: policy.reviewedAt },
      { reviewedBy: reviewed.reviewedBy, reviewedAt: reviewed.reviewedAt },
    );
    return reviewed;
  }

  async publishPolicy(
    id: string,
    dto: PublishJourneyPolicyDto,
    user: JwtPayload,
  ) {
    await this.access.assertAccess(user, "journey.waitlist.manage");
    const policy = await this.prisma.journeyWaitlistPolicyVersion.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
    });
    if (!policy)
      throw new NotFoundException(
        "Política não encontrada no escopo autorizado",
      );
    await this.access.assertUnitAccess(user, policy.unitId);
    if (!policy.reviewedBy)
      throw new ConflictException(
        "Política precisa de revisão humana antes da publicação",
      );
    if (policy.createdBy === user.sub || policy.reviewedBy === user.sub)
      throw new ConflictException(
        "Publicação exige ator diferente do criador e do revisor",
      );
    const existing = await this.prisma.domainOutboxEvent.findUnique({
      where: {
        idempotencyKey: `${user.mantenedoraId}:journey.policy.publish:${dto.idempotencyKey}`,
      },
    });
    if (existing)
      return this.prisma.journeyWaitlistPolicyVersion.findUnique({
        where: { id },
      });
    const overlap = await this.prisma.journeyWaitlistPolicyVersion.findFirst({
      where: {
        id: { not: id },
        mantenedoraId: user.mantenedoraId,
        unitId: policy.unitId,
        programKey: policy.programKey,
        status: JourneyWaitlistPolicyStatus.PUBLICADA,
        effectiveFrom: {
          lt: policy.effectiveTo ?? new Date("9999-12-31T00:00:00.000Z"),
        },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gt: policy.effectiveFrom } },
        ],
      },
      select: { id: true },
    });
    if (overlap)
      throw new ConflictException(
        "Já existe política publicada com vigência sobreposta",
      );
    const published = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.journeyWaitlistPolicyVersion.update({
        where: { id },
        data: {
          status: JourneyWaitlistPolicyStatus.PUBLICADA,
          publishedBy: user.sub,
          publishedAt: new Date(),
        },
      });
      await this.outbox(tx, {
        mantenedoraId: user.mantenedoraId,
        eventType: "journey.waitlist.policy.published",
        aggregateType: "JourneyWaitlistPolicyVersion",
        aggregateId: id,
        idempotencyKey: `${user.mantenedoraId}:journey.policy.publish:${dto.idempotencyKey}`,
        payload: { policyId: id, version: updated.version },
      });
      return updated;
    });
    await this.audit.logUpdate(
      AuditLogEntity.JOURNEY_WAITLIST,
      id,
      user.sub,
      user.mantenedoraId,
      policy.unitId,
      { status: policy.status },
      {
        status: published.status,
        reviewedBy: published.reviewedBy,
        publishedBy: published.publishedBy,
      },
    );
    return published;
  }

  async listPolicies(query: JourneyListQueryDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.read");
    const ids = await this.access.accessibleUnitIds(user, query.unitId);
    return this.prisma.journeyWaitlistPolicyVersion.findMany({
      where: { mantenedoraId: user.mantenedoraId, unitId: { in: ids } },
      orderBy: [{ unitId: "asc" }, { version: "desc" }],
      take: query.limit,
      skip: query.offset,
    });
  }

  private scoreEntry(
    prospect: {
      desiredDate: Date | null;
      ageGroupMinMonths: number;
      ageGroupMaxMonths: number;
      period: string;
    },
    policy: {
      ageGroupMinMonths: number;
      ageGroupMaxMonths: number;
      period: string;
      version: number;
      priorityDefinition: Prisma.JsonValue;
    },
  ) {
    const criteria: Array<{
      key: string;
      matched: boolean;
      points: number;
      explanation: string;
    }> = [];
    const definition = (
      policy.priorityDefinition &&
      typeof policy.priorityDefinition === "object" &&
      !Array.isArray(policy.priorityDefinition)
        ? policy.priorityDefinition
        : {}
    ) as Record<string, unknown>;
    const ageMatched =
      prospect.ageGroupMinMonths <= policy.ageGroupMaxMonths &&
      prospect.ageGroupMaxMonths >= policy.ageGroupMinMonths;
    const periodMatched = prospect.period === policy.period;
    criteria.push({
      key: "ageGroupMatch",
      matched: ageMatched,
      points: ageMatched && definition.ageGroupMatch !== false ? 50 : 0,
      explanation: ageMatched
        ? "Faixa etária compatível"
        : "Faixa etária não compatível",
    });
    criteria.push({
      key: "periodMatch",
      matched: periodMatched,
      points: periodMatched && definition.periodMatch !== false ? 30 : 0,
      explanation: periodMatched
        ? "Período compatível"
        : "Período não compatível",
    });
    const desiredDateMatched = Boolean(prospect.desiredDate);
    criteria.push({
      key: "desiredDate",
      matched: desiredDateMatched,
      points: desiredDateMatched && definition.desiredDate !== false ? 10 : 0,
      explanation: desiredDateMatched
        ? "Data desejada declarada"
        : "Sem data desejada declarada",
    });
    const priorityScore = criteria.reduce((sum, item) => sum + item.points, 0);
    return {
      priorityScore,
      explanation: {
        policyVersion: policy.version,
        criteria,
        diagnosticInference: false,
        humanReviewRequired: true,
      },
    };
  }

  async joinWaitlist(dto: JoinJourneyWaitlistDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.waitlist.manage");
    await this.access.assertUnitAccess(user, dto.unitId);
    const prospect = await this.access.assertProspectAccess(
      user,
      dto.prospectId,
    );
    if (prospect.unitId !== dto.unitId)
      throw new NotFoundException(
        "Interessado não pertence à unidade informada",
      );
    const existing = await this.prisma.journeyWaitlistEntry.findUnique({
      where: {
        mantenedoraId_idempotencyKey: {
          mantenedoraId: user.mantenedoraId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
    if (existing) return existing;
    const policy = await this.prisma.journeyWaitlistPolicyVersion.findFirst({
      where: {
        id: dto.policyId,
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        status: JourneyWaitlistPolicyStatus.PUBLICADA,
      },
    });
    if (!policy)
      throw new NotFoundException(
        "Política publicada não encontrada no escopo autorizado",
      );
    const now = new Date();
    if (
      policy.effectiveFrom > now ||
      (policy.effectiveTo && policy.effectiveTo <= now)
    )
      throw new ConflictException("Política fora da vigência");
    const match =
      prospect.stage !== JourneyStage.ARQUIVADO &&
      prospect.stage !== JourneyStage.PERDIDO &&
      prospect.period === policy.period &&
      prospect.ageGroupMinMonths <= policy.ageGroupMaxMonths &&
      prospect.ageGroupMaxMonths >= policy.ageGroupMinMonths;
    if (!match)
      throw new ConflictException(
        "Interessado não atende aos critérios declarativos da política",
      );
    const scored = this.scoreEntry(prospect, policy);
    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.journeyWaitlistEntry.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: dto.unitId,
          prospectId: dto.prospectId,
          policyId: dto.policyId,
          desiredDate: prospect.desiredDate,
          priorityScore: scored.priorityScore,
          explanation: scored.explanation as Prisma.InputJsonValue,
          createdBy: user.sub,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      await this.transitionIfNeeded(tx, {
        prospectId: dto.prospectId,
        toStage: JourneyStage.LISTA_ESPERA,
        actorUserId: user.sub,
        idempotencyKey: `${dto.idempotencyKey}:stage`,
      });
      await this.outbox(tx, {
        mantenedoraId: user.mantenedoraId,
        eventType: "journey.waitlist.joined",
        aggregateType: "JourneyWaitlistEntry",
        aggregateId: created.id,
        idempotencyKey: `${user.mantenedoraId}:journey.waitlist.joined:${dto.idempotencyKey}`,
        payload: {
          entryId: created.id,
          prospectId: dto.prospectId,
          policyId: dto.policyId,
        },
      });
      return created;
    });
    await this.audit.logCreate(
      AuditLogEntity.JOURNEY_WAITLIST,
      entry.id,
      user.sub,
      user.mantenedoraId,
      dto.unitId,
      {
        prospectId: dto.prospectId,
        policyId: dto.policyId,
        priorityScore: entry.priorityScore,
      },
    );
    return entry;
  }

  async listWaitlist(query: JourneyListQueryDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.read");
    const ids = await this.access.accessibleUnitIds(user, query.unitId);
    return this.prisma.journeyWaitlistEntry.findMany({
      where: {
        mantenedoraId: user.mantenedoraId,
        unitId: { in: ids },
        status: JourneyWaitlistEntryStatus.AGUARDANDO,
      },
      include: {
        prospect: {
          select: {
            id: true,
            responsibleName: true,
            childName: true,
            ageGroupMinMonths: true,
            ageGroupMaxMonths: true,
            period: true,
            desiredDate: true,
            stage: true,
          },
        },
        policy: {
          select: {
            id: true,
            version: true,
            programKey: true,
            effectiveFrom: true,
            effectiveTo: true,
          },
        },
      },
      orderBy: [{ priorityScore: "desc" }, { createdAt: "asc" }],
      take: query.limit,
      skip: query.offset,
    });
  }

  async createOffer(dto: CreateJourneyOfferDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.offer.create");
    await this.access.assertUnitAccess(user, dto.unitId);
    const prospect = await this.access.assertProspectAccess(
      user,
      dto.prospectId,
    );
    if (prospect.unitId !== dto.unitId)
      throw new NotFoundException(
        "Interessado não pertence à unidade informada",
      );
    const classroom = await this.access.assertClassroomAccess(
      user,
      dto.classroomId,
      dto.unitId,
    );
    const expiresAt = this.dateRequired(
      dto.reservationExpiresAt,
      "Expiração da reserva",
    );
    if (expiresAt <= new Date())
      throw new BadRequestException("A reserva deve expirar no futuro");
    if (expiresAt.getTime() - Date.now() > 31 * 24 * 60 * 60 * 1000)
      throw new BadRequestException(
        "A reserva temporária não pode exceder 31 dias",
      );
    const overrideReason = dto.overrideReason?.trim();
    this.rejectSensitiveContent([overrideReason]);
    if (overrideReason)
      this.access.assertCapability(user, "journey.offer.override");
    const existing = await this.prisma.journeySeatOffer.findUnique({
      where: {
        mantenedoraId_idempotencyKey: {
          mantenedoraId: user.mantenedoraId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
      include: { classroom: true },
    });
    if (existing) return existing;

    const offer = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT "id" FROM "Classroom" WHERE "id" = ${classroom.id} FOR UPDATE`,
      );
      const activeEnrollmentCount = await tx.enrollment.count({
        where: { classroomId: classroom.id, status: EnrollmentStatus.ATIVA },
      });
      const activeReservationCount = await tx.journeySeatOffer.count({
        where: {
          classroomId: classroom.id,
          status: {
            in: [JourneyOfferStatus.OFERTADA, JourneyOfferStatus.ACEITA],
          },
          reservationExpiresAt: { gt: new Date() },
        },
      });
      const capacityIsFull =
        activeEnrollmentCount + activeReservationCount >= classroom.capacity;
      if (capacityIsFull && !overrideReason)
        throw new ConflictException(
          "Não há vaga disponível na turma real selecionada",
        );
      if (capacityIsFull)
        this.access.assertCapability(user, "journey.offer.override");
      const existingProspectOffer = await tx.journeySeatOffer.findFirst({
        where: {
          mantenedoraId: user.mantenedoraId,
          prospectId: dto.prospectId,
          status: {
            in: [JourneyOfferStatus.OFERTADA, JourneyOfferStatus.ACEITA],
          },
          reservationExpiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (existingProspectOffer)
        throw new ConflictException(
          "O interessado já possui uma oferta vigente",
        );
      if (dto.waitlistEntryId) {
        const entry = await tx.journeyWaitlistEntry.findFirst({
          where: {
            id: dto.waitlistEntryId,
            mantenedoraId: user.mantenedoraId,
            unitId: dto.unitId,
            prospectId: dto.prospectId,
            status: JourneyWaitlistEntryStatus.AGUARDANDO,
          },
        });
        if (!entry)
          throw new NotFoundException(
            "Entrada de espera não encontrada no escopo autorizado",
          );
      }
      const created = await tx.journeySeatOffer.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: dto.unitId,
          prospectId: dto.prospectId,
          classroomId: classroom.id,
          waitlistEntryId: dto.waitlistEntryId ?? null,
          reservationExpiresAt: expiresAt,
          overrideReason: overrideReason ?? null,
          createdBy: user.sub,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      await this.transitionIfNeeded(tx, {
        prospectId: dto.prospectId,
        toStage: JourneyStage.VAGA_OFERECIDA,
        actorUserId: user.sub,
        idempotencyKey: `${dto.idempotencyKey}:stage`,
      });
      if (dto.waitlistEntryId)
        await tx.journeyWaitlistEntry.update({
          where: { id: dto.waitlistEntryId },
          data: {
            status: JourneyWaitlistEntryStatus.OFERTADA,
            version: { increment: 1 },
          },
        });
      await this.outbox(tx, {
        mantenedoraId: user.mantenedoraId,
        eventType: "journey.seat_offer.created",
        aggregateType: "JourneySeatOffer",
        aggregateId: created.id,
        idempotencyKey: `${user.mantenedoraId}:journey.offer.created:${dto.idempotencyKey}`,
        payload: {
          offerId: created.id,
          prospectId: dto.prospectId,
          classroomId: classroom.id,
          reservationExpiresAt: expiresAt.toISOString(),
          overrideReason: overrideReason ?? null,
        },
      });
      return created;
    });
    await this.audit.logCreate(
      AuditLogEntity.JOURNEY_OFFER,
      offer.id,
      user.sub,
      user.mantenedoraId,
      dto.unitId,
      {
        prospectId: dto.prospectId,
        classroomId: classroom.id,
        reservationExpiresAt: expiresAt.toISOString(),
        overrideReason: overrideReason ?? null,
      },
    );
    return this.prisma.journeySeatOffer.findUnique({
      where: { id: offer.id },
      include: {
        classroom: {
          select: { id: true, name: true, code: true, capacity: true },
        },
        prospect: {
          select: { id: true, responsibleName: true, childName: true },
        },
      },
    });
  }

  async listOffers(query: JourneyListQueryDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.read");
    const ids = await this.access.accessibleUnitIds(user, query.unitId);
    return this.prisma.journeySeatOffer.findMany({
      where: { mantenedoraId: user.mantenedoraId, unitId: { in: ids } },
      include: {
        classroom: {
          select: { id: true, name: true, code: true, capacity: true },
        },
        prospect: {
          select: {
            id: true,
            responsibleName: true,
            childName: true,
            stage: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    });
  }

  async decideOffer(id: string, dto: DecideJourneyOfferDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.offer.accept");
    const existingDraft = await this.prisma.journeyEnrollmentDraft.findUnique({
      where: {
        mantenedoraId_idempotencyKey: {
          mantenedoraId: user.mantenedoraId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
    if (existingDraft)
      return {
        offer: await this.prisma.journeySeatOffer.findUnique({ where: { id } }),
        draft: existingDraft,
      };
    const result = await this.prisma.$transaction(async (tx) => {
      const offer = await tx.journeySeatOffer.findFirst({
        where: { id, mantenedoraId: user.mantenedoraId },
      });
      if (!offer)
        throw new NotFoundException(
          "Oferta não encontrada no escopo autorizado",
        );
      await this.access.assertUnitAccess(user, offer.unitId);
      await tx.$executeRaw(
        Prisma.sql`SELECT "id" FROM "Classroom" WHERE "id" = ${offer.classroomId} FOR UPDATE`,
      );
      if (offer.status === JourneyOfferStatus.ACEITA) {
        const draft = await tx.journeyEnrollmentDraft.findUnique({
          where: { offerId: offer.id },
        });
        if (draft) return { offer, draft };
      }
      if (offer.status !== JourneyOfferStatus.OFERTADA)
        throw new ConflictException("Oferta não está disponível para decisão");
      if (offer.reservationExpiresAt <= new Date()) {
        const expired = await tx.journeySeatOffer.update({
          where: { id: offer.id },
          data: {
            status: JourneyOfferStatus.EXPIRADA,
            respondedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await this.outbox(tx, {
          mantenedoraId: user.mantenedoraId,
          eventType: "journey.seat_offer.expired",
          aggregateType: "JourneySeatOffer",
          aggregateId: offer.id,
          idempotencyKey: `${user.mantenedoraId}:journey.offer.expired:${offer.id}`,
          payload: { offerId: offer.id },
        });
        return { offer: expired, draft: null, expired: true };
      }
      this.rejectSensitiveContent([dto.reason]);
      if (dto.decision === "reject") {
        const rejected = await tx.journeySeatOffer.update({
          where: { id },
          data: {
            status: JourneyOfferStatus.RECUSADA,
            respondedAt: new Date(),
            decisionReason: dto.reason?.trim() || null,
            acceptedBy: null,
            version: { increment: 1 },
          },
        });
        await this.transitionIfNeeded(tx, {
          prospectId: offer.prospectId,
          toStage: JourneyStage.PERDIDO,
          actorUserId: user.sub,
          idempotencyKey: `${dto.idempotencyKey}:stage`,
          reason: dto.reason,
        });
        await this.outbox(tx, {
          mantenedoraId: user.mantenedoraId,
          eventType: "journey.seat_offer.rejected",
          aggregateType: "JourneySeatOffer",
          aggregateId: offer.id,
          idempotencyKey: `${user.mantenedoraId}:journey.offer.rejected:${dto.idempotencyKey}`,
          payload: { offerId: offer.id, prospectId: offer.prospectId },
        });
        return { offer: rejected, draft: null };
      }
      const lockedClassroom = await tx.classroom.findFirst({
        where: { id: offer.classroomId },
        select: { capacity: true },
      });
      if (!lockedClassroom)
        throw new NotFoundException("Turma da oferta não encontrada");
      const [activeEnrollmentCount, activeReservationCount] = await Promise.all(
        [
          tx.enrollment.count({
            where: {
              classroomId: offer.classroomId,
              status: EnrollmentStatus.ATIVA,
            },
          }),
          tx.journeySeatOffer.count({
            where: {
              id: { not: offer.id },
              classroomId: offer.classroomId,
              status: {
                in: [JourneyOfferStatus.OFERTADA, JourneyOfferStatus.ACEITA],
              },
              reservationExpiresAt: { gt: new Date() },
            },
          }),
        ],
      );
      const capacityIsFull =
        activeEnrollmentCount + activeReservationCount >=
        lockedClassroom.capacity;
      if (capacityIsFull && !offer.overrideReason)
        throw new ConflictException(
          "A capacidade foi ocupada antes do aceite da oferta",
        );
      const accepted = await tx.journeySeatOffer.update({
        where: { id },
        data: {
          status: JourneyOfferStatus.ACEITA,
          respondedAt: new Date(),
          acceptedBy: user.sub,
          decisionReason: dto.reason?.trim() || null,
          version: { increment: 1 },
        },
      });
      const draft = await tx.journeyEnrollmentDraft.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: offer.unitId,
          prospectId: offer.prospectId,
          offerId: offer.id,
          missingFields: [
            "dateOfBirth",
            "legalResponsibleData",
            "documentsAndConsents",
          ] as Prisma.InputJsonValue,
          createdBy: user.sub,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      await this.transitionIfNeeded(tx, {
        prospectId: offer.prospectId,
        toStage: JourneyStage.ACEITO,
        actorUserId: user.sub,
        idempotencyKey: `${dto.idempotencyKey}:stage`,
      });
      await this.outbox(tx, {
        mantenedoraId: user.mantenedoraId,
        eventType: "journey.enrollment_draft.created",
        aggregateType: "JourneyEnrollmentDraft",
        aggregateId: draft.id,
        idempotencyKey: `${user.mantenedoraId}:journey.enrollment_draft:${offer.id}`,
        payload: {
          draftId: draft.id,
          offerId: offer.id,
          prospectId: offer.prospectId,
          incomplete: true,
        },
      });
      return { offer: accepted, draft };
    });
    if ("expired" in result && result.expired)
      throw new GoneException("Oferta expirada antes da decisão");
    await this.audit.logUpdate(
      AuditLogEntity.JOURNEY_OFFER,
      id,
      user.sub,
      user.mantenedoraId,
      result.offer?.unitId,
      { status: JourneyOfferStatus.OFERTADA },
      { status: result.offer?.status, draftId: result.draft?.id ?? null },
    );
    return result;
  }

  async dashboard(query: JourneyDashboardQueryDto, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.read");
    const unitIds = await this.access.accessibleUnitIds(user, query.unitId);
    const now = new Date();
    const [stageCounts, upcomingVisits, waiting, offers, classrooms] =
      await Promise.all([
        this.prisma.journeyProspect.groupBy({
          by: ["stage"],
          where: {
            mantenedoraId: user.mantenedoraId,
            unitId: { in: unitIds },
            mergedIntoId: null,
          },
          _count: { _all: true },
        }),
        this.prisma.journeyVisit.count({
          where: {
            mantenedoraId: user.mantenedoraId,
            unitId: { in: unitIds },
            status: {
              in: [JourneyVisitStatus.AGENDADA, JourneyVisitStatus.REAGENDADA],
            },
            startsAt: { gte: now },
          },
        }),
        this.prisma.journeyWaitlistEntry.count({
          where: {
            mantenedoraId: user.mantenedoraId,
            unitId: { in: unitIds },
            status: JourneyWaitlistEntryStatus.AGUARDANDO,
          },
        }),
        this.prisma.journeySeatOffer.count({
          where: {
            mantenedoraId: user.mantenedoraId,
            unitId: { in: unitIds },
            status: JourneyOfferStatus.OFERTADA,
            reservationExpiresAt: { gt: now },
          },
        }),
        this.prisma.classroom.findMany({
          where: { unitId: { in: unitIds }, isActive: true },
          select: {
            id: true,
            unitId: true,
            name: true,
            code: true,
            capacity: true,
            _count: {
              select: {
                enrollments: { where: { status: EnrollmentStatus.ATIVA } },
              },
            },
          },
          orderBy: { name: "asc" },
        }),
      ]);
    const stages = Object.fromEntries(
      Object.values(JourneyStage).map((stage) => [stage, 0]),
    ) as Record<JourneyStage, number>;
    for (const row of stageCounts) stages[row.stage] = row._count._all;
    return {
      generatedAt: now.toISOString(),
      freshnessAt: now.toISOString(),
      period: {
        from: null,
        to: now.toISOString(),
        timezone: "UTC",
      },
      source:
        "PostgreSQL: JourneyProspect, JourneyVisit, JourneyWaitlistEntry, JourneySeatOffer, Classroom/Enrollment",
      scope: { mantenedoraId: user.mantenedoraId, unitIds },
      totals: {
        prospects: Object.values(stages).reduce((sum, value) => sum + value, 0),
        upcomingVisits,
        waiting,
        activeOffers: offers,
      },
      stages,
      capacity: classrooms.map((classroom) => ({
        classroomId: classroom.id,
        unitId: classroom.unitId,
        name: classroom.name,
        code: classroom.code,
        capacity: classroom.capacity,
        activeEnrollments: classroom._count.enrollments,
        availableBeforeJourneyReservations: Math.max(
          0,
          classroom.capacity - classroom._count.enrollments,
        ),
      })),
      error: null,
      governance: JOURNEY_GOVERNANCE,
    };
  }

  async listDuplicateReviews(user: JwtPayload) {
    await this.access.assertAccess(user, "journey.read");
    const unitIds = await this.access.accessibleUnitIds(user);
    return this.prisma.journeyDuplicateReview.findMany({
      where: {
        mantenedoraId: user.mantenedoraId,
        primary: { unitId: { in: unitIds } },
        duplicate: { unitId: { in: unitIds } },
      },
      select: {
        id: true,
        primaryProspectId: true,
        duplicateProspectId: true,
        matchReasons: true,
        status: true,
        previousStage: true,
        reviewedBy: true,
        reviewedAt: true,
        undoBy: true,
        undoAt: true,
        primary: {
          select: {
            id: true,
            unitId: true,
            responsibleName: true,
            childName: true,
            stage: true,
          },
        },
        duplicate: {
          select: {
            id: true,
            unitId: true,
            responsibleName: true,
            childName: true,
            stage: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async reviewDuplicate(
    id: string,
    dto: JourneyDuplicateReviewDto,
    user: JwtPayload,
  ) {
    await this.access.assertAccess(user, "journey.merge.review");
    const review = await this.prisma.journeyDuplicateReview.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
      include: { primary: true, duplicate: true },
    });
    if (!review)
      throw new NotFoundException(
        "Revisão de duplicidade não encontrada no escopo autorizado",
      );
    await this.access.assertUnitAccess(user, review.primary.unitId);
    await this.access.assertUnitAccess(user, review.duplicate.unitId);
    if (review.status !== JourneyDuplicateReviewStatus.PENDENTE) return review;
    if (dto.decision === "reject")
      return this.prisma.journeyDuplicateReview.update({
        where: { id },
        data: {
          status: JourneyDuplicateReviewStatus.REJEITADA,
          reviewedBy: user.sub,
          reviewedAt: new Date(),
        },
      });
    if (review.primary.id === review.duplicate.id)
      throw new BadRequestException(
        "Um interessado não pode ser duplicado de si mesmo",
      );
    const merged = await this.prisma.$transaction(async (tx) => {
      const updatedReview = await tx.journeyDuplicateReview.update({
        where: { id },
        data: {
          status: JourneyDuplicateReviewStatus.CONFIRMADA,
          reviewedBy: user.sub,
          reviewedAt: new Date(),
          previousStage: review.duplicate.stage,
        },
      });
      await tx.journeyProspect.update({
        where: { id: review.duplicate.id },
        data: {
          mergedIntoId: review.primary.id,
          stage: JourneyStage.ARQUIVADO,
          version: { increment: 1 },
        },
      });
      await this.appendStageEvent(tx, {
        mantenedoraId: user.mantenedoraId,
        unitId: review.duplicate.unitId,
        prospectId: review.duplicate.id,
        fromStage: review.duplicate.stage,
        toStage: JourneyStage.ARQUIVADO,
        actorUserId: user.sub,
        idempotencyKey: `${dto.idempotencyKey}:stage`,
        reason: "Merge de duplicidade revisado por humano",
      });
      await this.outbox(tx, {
        mantenedoraId: user.mantenedoraId,
        eventType: "journey.duplicate.merged",
        aggregateType: "JourneyDuplicateReview",
        aggregateId: id,
        idempotencyKey: `${user.mantenedoraId}:journey.merge:${dto.idempotencyKey}`,
        payload: {
          reviewId: id,
          primaryProspectId: review.primary.id,
          duplicateProspectId: review.duplicate.id,
        },
      });
      return updatedReview;
    });
    await this.audit.logUpdate(
      AuditLogEntity.JOURNEY_MERGE,
      id,
      user.sub,
      user.mantenedoraId,
      review.primary.unitId,
      { status: review.status },
      {
        status: merged.status,
        primaryProspectId: review.primary.id,
        duplicateProspectId: review.duplicate.id,
      },
    );
    return merged;
  }

  async undoDuplicate(id: string, idempotencyKey: string, user: JwtPayload) {
    await this.access.assertAccess(user, "journey.merge.review");
    const review = await this.prisma.journeyDuplicateReview.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
      include: { duplicate: true, primary: true },
    });
    if (!review)
      throw new NotFoundException(
        "Revisão de duplicidade não encontrada no escopo autorizado",
      );
    await this.access.assertUnitAccess(user, review.primary.unitId);
    await this.access.assertUnitAccess(user, review.duplicate.unitId);
    if (review.status === JourneyDuplicateReviewStatus.DESFEITA) return review;
    if (review.status !== JourneyDuplicateReviewStatus.CONFIRMADA)
      throw new ConflictException("Somente merge confirmado pode ser desfeito");
    const restored = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.journeyDuplicateReview.update({
        where: { id },
        data: {
          status: JourneyDuplicateReviewStatus.DESFEITA,
          undoBy: user.sub,
          undoAt: new Date(),
        },
      });
      await tx.journeyProspect.update({
        where: { id: review.duplicate.id },
        data: {
          mergedIntoId: null,
          stage: review.previousStage ?? JourneyStage.NOVO,
          version: { increment: 1 },
        },
      });
      await this.appendStageEvent(tx, {
        mantenedoraId: user.mantenedoraId,
        unitId: review.duplicate.unitId,
        prospectId: review.duplicate.id,
        fromStage: JourneyStage.ARQUIVADO,
        toStage: review.previousStage ?? JourneyStage.NOVO,
        actorUserId: user.sub,
        idempotencyKey: `${idempotencyKey}:stage`,
        reason: "Desfazer merge revisado por humano",
      });
      await this.outbox(tx, {
        mantenedoraId: user.mantenedoraId,
        eventType: "journey.duplicate.undo",
        aggregateType: "JourneyDuplicateReview",
        aggregateId: id,
        idempotencyKey: `${user.mantenedoraId}:journey.merge.undo:${idempotencyKey}`,
        payload: { reviewId: id, duplicateProspectId: review.duplicate.id },
      });
      return updated;
    });
    await this.audit.logUpdate(
      AuditLogEntity.JOURNEY_MERGE,
      id,
      user.sub,
      user.mantenedoraId,
      review.primary.unitId,
      { status: review.status },
      { status: restored.status, undoBy: user.sub },
    );
    return restored;
  }
}
