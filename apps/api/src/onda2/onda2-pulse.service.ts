import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Onda2PresenceEventStatus, Onda2PresenceSessionStatus, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { Onda2AccessService } from './onda2-access.service';
import { ONDA2_CAPABILITIES, ONDA2_FEATURE_FLAGS } from './onda2.constants';
import { CreatePresenceSessionDto, PulseQueryDto, RecordPresenceEventDto } from './onda2.dto';

@Injectable()
export class Onda2PulseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: Onda2AccessService,
  ) {}

  async createSession(dto: CreatePresenceSessionDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.pulseCommandCenterV1, ONDA2_CAPABILITIES.presenceRecord);
    await this.access.assertUnitAccess(user, dto.unitId);
    const sessionDate = new Date(dto.sessionDate);
    const existing = await this.prisma.operationalPresenceSession.findFirst({
      where: { mantenedoraId: user.mantenedoraId, unitId: dto.unitId, spaceId: dto.spaceId ?? null, sessionDate },
    });
    if (existing) return existing;

    return this.prisma.operationalPresenceSession.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        spaceId: dto.spaceId,
        classroomId: dto.classroomId,
        sessionDate,
        status: dto.status ?? Onda2PresenceSessionStatus.OPEN,
        createdBy: user.sub,
      },
    });
  }

  async recordEvent(dto: RecordPresenceEventDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.pulseCommandCenterV1, ONDA2_CAPABILITIES.presenceRecord);
    await this.access.assertUnitAccess(user, dto.unitId);
    const existing = await this.prisma.operationalPresenceEvent.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
    if (existing) return existing;

    if (dto.sessionId) {
      const session = await this.prisma.operationalPresenceSession.findFirst({
        where: { id: dto.sessionId, mantenedoraId: user.mantenedoraId, unitId: dto.unitId },
        select: { id: true },
      });
      if (!session) throw new NotFoundException('Sessão operacional não encontrada no escopo autorizado');
    }

    return this.prisma.operationalPresenceEvent.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId,
        sessionId: dto.sessionId,
        spaceId: dto.spaceId,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        eventType: dto.eventType,
        status: Onda2PresenceEventStatus.ACCEPTED,
        occurredAt: new Date(dto.occurredAt),
        source: dto.source ?? 'MOBILE',
        idempotencyKey: dto.idempotencyKey,
        correlationId: dto.correlationId,
        payload: dto.payload as Prisma.InputJsonValue | undefined,
        createdBy: user.sub,
      },
    });
  }

  async closeSession(id: string, user: JwtPayload) {
    await this.access.assertFlagAndCapability(user, ONDA2_FEATURE_FLAGS.pulseCommandCenterV1, ONDA2_CAPABILITIES.presenceCorrect);
    const session = await this.prisma.operationalPresenceSession.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
      select: { id: true, unitId: true, status: true },
    });
    if (!session) throw new NotFoundException('Sessão operacional não encontrada');
    await this.access.assertUnitAccess(user, session.unitId);
    if (session.status === Onda2PresenceSessionStatus.CLOSED) return session;
    return this.prisma.operationalPresenceSession.update({
      where: { id },
      data: { status: Onda2PresenceSessionStatus.CLOSED, closedAt: new Date() },
    });
  }

  async listEvents(query: PulseQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(
      user,
      ONDA2_FEATURE_FLAGS.pulseCommandCenterV1,
      query.unitId ? ONDA2_CAPABILITIES.pulseReadUnit : ONDA2_CAPABILITIES.pulseReadNetwork,
    );
    const unitId = query.unitId;
    if (unitId) await this.access.assertUnitAccess(user, unitId);
    const date = query.date ? new Date(query.date) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return this.prisma.operationalPresenceEvent.findMany({
      where: {
        mantenedoraId: user.mantenedoraId,
        unitId,
        occurredAt: { gte: start, lt: end },
      },
      orderBy: { occurredAt: 'desc' },
      take: 500,
    });
  }

  async commandCenter(query: PulseQueryDto, user: JwtPayload) {
    await this.access.assertFlagAndCapability(
      user,
      ONDA2_FEATURE_FLAGS.pulseCommandCenterV1,
      query.unitId ? ONDA2_CAPABILITIES.pulseReadUnit : ONDA2_CAPABILITIES.pulseReadNetwork,
    );
    const units = query.unitId
      ? await this.prisma.unit.findMany({ where: { id: query.unitId, mantenedoraId: user.mantenedoraId }, select: { id: true, name: true, code: true } })
      : this.access.isNetworkScoped(user)
        ? await this.prisma.unit.findMany({ where: { mantenedoraId: user.mantenedoraId, isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } })
        : user.unitId
          ? await this.prisma.unit.findMany({ where: { id: user.unitId, mantenedoraId: user.mantenedoraId }, select: { id: true, name: true, code: true } })
          : [];

    if (query.unitId && units.length === 0) throw new NotFoundException('Unidade não encontrada no escopo autorizado');
    const referenceDate = query.date ? new Date(query.date) : new Date();
    const start = new Date(referenceDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const byUnit = await Promise.all(
      units.map(async (unit) => {
        const [eventsToday, openSessions, activeBreaches, openRequests, openWorkOrders, overdueWorkOrders] = await Promise.all([
          this.prisma.operationalPresenceEvent.count({ where: { mantenedoraId: user.mantenedoraId, unitId: unit.id, occurredAt: { gte: start, lt: end }, status: Onda2PresenceEventStatus.ACCEPTED } }),
          this.prisma.operationalPresenceSession.count({ where: { mantenedoraId: user.mantenedoraId, unitId: unit.id, status: { not: Onda2PresenceSessionStatus.CLOSED } } }),
          this.prisma.ratioBreach.count({ where: { mantenedoraId: user.mantenedoraId, unitId: unit.id, status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } } }),
          this.prisma.maintenanceRequest.count({ where: { mantenedoraId: user.mantenedoraId, unitId: unit.id, status: { in: ['SUBMITTED', 'TRIAGE', 'APPROVED'] } } }),
          this.prisma.workOrder.count({ where: { mantenedoraId: user.mantenedoraId, unitId: unit.id, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS', 'REOPENED'] } } }),
          this.prisma.workOrder.count({ where: { mantenedoraId: user.mantenedoraId, unitId: unit.id, dueAt: { lt: new Date() }, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS', 'REOPENED'] } } }),
        ]);
        return { unit, eventsToday, openSessions, activeBreaches, openRequests, openWorkOrders, overdueWorkOrders };
      }),
    );

    return {
      generatedAt: new Date().toISOString(),
      scope: query.unitId ? 'UNIT' : this.access.isNetworkScoped(user) ? 'NETWORK' : 'UNIT',
      governance: { diagnosticInference: false, humanReviewRequired: true },
      units: byUnit,
      totals: byUnit.reduce(
        (acc, row) => ({
          eventsToday: acc.eventsToday + row.eventsToday,
          openSessions: acc.openSessions + row.openSessions,
          activeBreaches: acc.activeBreaches + row.activeBreaches,
          openRequests: acc.openRequests + row.openRequests,
          openWorkOrders: acc.openWorkOrders + row.openWorkOrders,
          overdueWorkOrders: acc.overdueWorkOrders + row.overdueWorkOrders,
        }),
        { eventsToday: 0, openSessions: 0, activeBreaches: 0, openRequests: 0, openWorkOrders: 0, overdueWorkOrders: 0 },
      ),
    };
  }

  validateDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data inválida');
    return date;
  }
}
