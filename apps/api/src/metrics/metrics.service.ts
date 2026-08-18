import { ForbiddenException, Injectable } from '@nestjs/common';
import { DailyMetricType, RoleLevel } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCoverage(user: JwtPayload, requestedDays?: number) {
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo de mantenedora ausente');

    const privilegedLevels: RoleLevel[] = [RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA, RoleLevel.STAFF_CENTRAL];
    const privileged = user.roles.some((role) => privilegedLevels.includes(role.level));
    const unitId = privileged ? undefined : user.unitId;
    if (!privileged && !unitId) throw new ForbiddenException('Escopo de unidade ausente');
    const days = Math.min(90, Math.max(1, Number.isFinite(requestedDays) ? Math.trunc(requestedDays as number) : 30));
    const now = new Date();
    const since = new Date(now.getTime() - (days - 1) * 86_400_000);
    const childWhere = { mantenedoraId: user.mantenedoraId, isActive: true, ...(unitId ? { unitId } : {}) };
    const classroomWhere = unitId ? { unitId } : { unit: { mantenedoraId: user.mantenedoraId } };
    const diaryWhere = { mantenedoraId: user.mantenedoraId, eventDate: { gte: since, lte: now }, ...(unitId ? { unitId } : {}) };

    const [
      units,
      classrooms,
      children,
      enrollments,
      teachers,
      diaryEvents,
      publishedDiaryEvents,
      observations,
      reports,
      childrenWithObservation,
      childrenWithFamilyLink,
      childrenWithDevelopmentConsent,
      childrenWithDietaryRestriction,
      childrenWithActiveAlert,
      activeGuardians,
      developmentConsents,
      familyMessages,
      activeAlerts,
      dailyMetrics,
    ] = await Promise.all([
      this.prisma.unit.count({ where: { mantenedoraId: user.mantenedoraId, isActive: true, ...(unitId ? { id: unitId } : {}) } }),
      this.prisma.classroom.count({ where: { ...classroomWhere, isActive: true } }),
      this.prisma.child.count({ where: childWhere }),
      this.prisma.enrollment.count({ where: { status: 'ATIVA', child: childWhere } }),
      this.prisma.classroomTeacher.count({ where: { isActive: true, classroom: classroomWhere } }),
      this.prisma.diaryEvent.count({ where: diaryWhere }),
      this.prisma.diaryEvent.count({ where: { ...diaryWhere, status: { in: ['PUBLICADO', 'REVISADO'] } } }),
      this.prisma.developmentObservation.count({ where: { child: childWhere, date: { gte: since, lte: now } } }),
      this.prisma.developmentReport.count({ where: { child: childWhere, status: 'PUBLICADO', publishedAt: { not: null, gte: since, lte: now } } }),
      this.prisma.child.count({ where: { ...childWhere, developmentObs: { some: { date: { gte: since, lte: now } } } } }),
      this.prisma.child.count({ where: { ...childWhere, guardianLinks: { some: { revokedAt: null } } } }),
      this.prisma.child.count({ where: { ...childWhere, guardianLinks: { some: { revokedAt: null, canViewDevelopment: true } } } }),
      this.prisma.child.count({ where: { ...childWhere, dietaryRestrictions: { some: { isActive: true } } } }),
      this.prisma.child.count({ where: { ...childWhere, alertasAluno: { some: { status: 'ATIVO' } } } }),
      this.prisma.childGuardian.count({ where: { child: childWhere, revokedAt: null } }),
      this.prisma.childGuardian.count({ where: { child: childWhere, revokedAt: null, canViewDevelopment: true } }),
      this.prisma.familyCommunication.count({ where: { mantenedoraId: user.mantenedoraId, createdAt: { gte: since, lte: now }, ...(unitId ? { unitId } : {}) } }),
      this.prisma.alertaAluno.count({ where: { child: childWhere, status: 'ATIVO' } }),
      this.prisma.dailyMetric.findMany({ where: { unit: { mantenedoraId: user.mantenedoraId }, ...(unitId ? { unitId } : {}), date: { gte: since, lte: now } }, orderBy: { date: 'asc' } }),
    ]);

    const percentage = (value: number, denominator: number) => denominator ? Math.round((value / denominator) * 1000) / 10 : 0;
    const daily = dailyMetrics.reduce<Record<string, { date: string; diary: number; access: number }>>((acc, item) => {
      const key = item.date.toISOString().slice(0, 10);
      acc[key] ??= { date: key, diary: 0, access: 0 };
      if (item.type === DailyMetricType.DIARY) acc[key].diary += item.count;
      if (item.type === DailyMetricType.ACCESS) acc[key].access += item.count;
      return acc;
    }, {});

    return {
      scope: unitId ? 'UNIDADE' : 'MANTENEDORA',
      unitId: unitId ?? null,
      period: { days, from: since.toISOString(), to: now.toISOString() },
      population: { units, classrooms, children, enrollments, teachers },
      activity: { diaryEvents, publishedDiaryEvents, observations, publishedReports: reports, familyMessages },
      care: { activeAlerts, childrenWithActiveAlert, childrenWithDietaryRestriction, activeGuardians, developmentConsents },
      coverage: {
        childrenWithObservation: percentage(childrenWithObservation, children),
        childrenWithFamilyLink: percentage(childrenWithFamilyLink, children),
        childrenWithDevelopmentConsent: percentage(childrenWithDevelopmentConsent, children),
        childrenWithActiveAlert: percentage(childrenWithActiveAlert, children),
      },
      daily: Object.values(daily),
      governance: { generatedAt: new Date().toISOString(), containsChildContent: false, containsPersonalData: false, readOnly: true },
    };
  }
}
