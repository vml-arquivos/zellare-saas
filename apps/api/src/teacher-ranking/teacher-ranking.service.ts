import { ForbiddenException, Injectable } from '@nestjs/common';
import { DiaryEventStatus, PlanningConferenciaStatus, Prisma, RoleLevel } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RankingQueryDto } from './dto/ranking.dto';

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function isoStart(value?: string) {
  if (value) return new Date(value);
  const date = new Date();
  date.setDate(date.getDate() - 30);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isoEnd(value?: string) {
  if (value) return new Date(value);
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

@Injectable()
export class TeacherRankingService {
  constructor(private readonly prisma: PrismaService) {}

  private canManageNetwork(user: JwtPayload) {
    const managementLevels: RoleLevel[] = [RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA, RoleLevel.STAFF_CENTRAL];
    return user.roles?.some((role) => managementLevels.includes(role.level)) ?? false;
  }

  private async resolveUnitId(user: JwtPayload, requested?: string) {
    const unitId = requested || user.unitId;
    if (!unitId) return undefined;
    const unit = await this.prisma.unit.findFirst({ where: { id: unitId, mantenedoraId: user.mantenedoraId }, select: { id: true } });
    if (!unit) throw new ForbiddenException('Unidade fora do escopo da mantenedora');
    if (!this.canManageNetwork(user) && user.unitId && user.unitId !== unitId) {
      throw new ForbiddenException('Usuário limitado à própria unidade');
    }
    return unit.id;
  }

  async ranking(query: RankingQueryDto, user: JwtPayload) {
    const from = isoStart(query.from);
    const to = isoEnd(query.to);
    if (from > to) throw new ForbiddenException('Período de ranking inválido');
    const unitId = await this.resolveUnitId(user, query.unitId);
    const classroomWhere: Prisma.ClassroomWhereInput = {
      unit: { mantenedoraId: user.mantenedoraId },
      ...(unitId ? { unitId } : {}),
      isActive: true,
    };
    const assignments = await this.prisma.classroomTeacher.findMany({
      where: { isActive: true, classroom: classroomWhere },
      select: {
        teacherId: true,
        classroomId: true,
        classroom: { select: { unitId: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    const teacherIds = [...new Set(assignments.map((item) => item.teacherId))];
    if (!teacherIds.length) return { from, to, formula: this.formula(), rankings: [] };

    const whereWindow = { gte: from, lte: to };
    const [plannings, conferences, diaries, observations] = await Promise.all([
      this.prisma.planning.groupBy({
        by: ['professorId'],
        where: { mantenedoraId: user.mantenedoraId, professorId: { in: teacherIds }, ...(unitId ? { unitId } : {}), startDate: { lte: to }, endDate: { gte: from } },
        _count: { _all: true },
      }),
      this.prisma.planningConferencia.groupBy({
        by: ['professorId', 'status'],
        where: { mantenedoraId: user.mantenedoraId, professorId: { in: teacherIds }, ...(unitId ? { unitId } : {}), dataConferencia: whereWindow },
        _count: { _all: true },
      }),
      this.prisma.diaryEvent.groupBy({
        by: ['createdBy', 'status'],
        where: { mantenedoraId: user.mantenedoraId, createdBy: { in: teacherIds }, ...(unitId ? { unitId } : {}), eventDate: whereWindow },
        _count: { _all: true },
      }),
      this.prisma.developmentObservation.findMany({
        where: { createdBy: { in: teacherIds }, ...(unitId ? { child: { unitId } } : {}), date: whereWindow },
        select: { createdBy: true, behaviorDescription: true, socialInteraction: true, emotionalState: true, learningProgress: true, recommendations: true },
      }),
    ]);

    const periodDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000) + 1);
    const classroomsByTeacher = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      const current = classroomsByTeacher.get(assignment.teacherId) || new Set<string>();
      current.add(assignment.classroomId);
      classroomsByTeacher.set(assignment.teacherId, current);
    }
    const planningByTeacher = new Map(plannings.map((item) => [item.professorId || '', item._count._all]));
    const conferenceByTeacher = new Map<string, { total: number; feito: number }>();
    for (const item of conferences) {
      if (!item.professorId) continue;
      const current = conferenceByTeacher.get(item.professorId) || { total: 0, feito: 0 };
      current.total += item._count._all;
      if (item.status === PlanningConferenciaStatus.FEITO) current.feito += item._count._all;
      conferenceByTeacher.set(item.professorId, current);
    }
    const diaryByTeacher = new Map<string, { total: number; published: number }>();
    for (const item of diaries) {
      if (!item.createdBy) continue;
      const current = diaryByTeacher.get(item.createdBy) || { total: 0, published: 0 };
      current.total += item._count._all;
      const publishedStatuses: DiaryEventStatus[] = [DiaryEventStatus.PUBLICADO, DiaryEventStatus.REVISADO];
      if (publishedStatuses.includes(item.status)) current.published += item._count._all;
      diaryByTeacher.set(item.createdBy, current);
    }
    const observationsByTeacher = new Map<string, { total: number; rich: number }>();
    for (const item of observations) {
      const current = observationsByTeacher.get(item.createdBy) || { total: 0, rich: 0 };
      current.total += 1;
      const richFields = [item.behaviorDescription, item.socialInteraction, item.emotionalState, item.learningProgress, item.recommendations].filter(Boolean).length;
      if (richFields >= 3) current.rich += 1;
      observationsByTeacher.set(item.createdBy, current);
    }

    const rankings = teacherIds.map((teacherId) => {
      const assignment = assignments.find((item) => item.teacherId === teacherId);
      const classroomCount = classroomsByTeacher.get(teacherId)?.size || 1;
      const planningCount = planningByTeacher.get(teacherId) || 0;
      const conference = conferenceByTeacher.get(teacherId) || { total: 0, feito: 0 };
      const diary = diaryByTeacher.get(teacherId) || { total: 0, published: 0 };
      const observation = observationsByTeacher.get(teacherId) || { total: 0, rich: 0 };
      const expectedConferences = Math.max(1, periodDays * classroomCount);
      const expectedDiaries = Math.max(1, periodDays * classroomCount);
      const completeness = clamp(
        (conference.total / expectedConferences) * 50 +
        (diary.total / expectedDiaries) * 30 +
        (observation.total / Math.max(1, periodDays)) * 20,
      );
      const quality = clamp(
        (conference.total ? conference.feito / conference.total : 0) * 50 +
        (diary.total ? diary.published / diary.total : 0) * 30 +
        (observation.total ? observation.rich / observation.total : 0) * 20,
      );
      const total = clamp(completeness * 0.6 + quality * 0.4);
      return {
        teacherId,
        teacherName: `${assignment?.teacher.firstName || ''} ${assignment?.teacher.lastName || ''}`.trim() || assignment?.teacher.email || teacherId,
        classrooms: classroomCount,
        metrics: { plannings: planningCount, conferences: conference.total, diaries: diary.total, observations: observation.total, conferencesFeitas: conference.feito, diariesPublicados: diary.published, observationsRicas: observation.rich },
        completeness,
        quality,
        total,
      };
    }).sort((a, b) => b.total - a.total).map((item, index) => ({ position: index + 1, ...item }));

    return { from, to, formula: this.formula(), rankings };
  }

  private formula() {
    return {
      completeness: '50% conferências preenchidas + 30% registros de diário + 20% observações por período',
      quality: '50% conferências feitas + 30% diários publicados/revisados + 20% observações ricas',
      total: '60% completude + 40% qualidade',
      note: 'Pontuação é informativa, auditável e não substitui avaliação pedagógica ou gestão de pessoas.',
    };
  }
}
