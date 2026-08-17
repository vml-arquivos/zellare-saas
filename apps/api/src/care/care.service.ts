import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleLevel } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { canAccessUnit } from '../common/utils/can-access-unit';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CareService {
  constructor(private readonly prisma: PrismaService) {}

  async getChildOverview(childId: string, user: JwtPayload) {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      include: {
        enrollments: {
          where: { status: 'ATIVA' },
          include: {
            classroom: {
              select: { id: true, name: true, code: true, unitId: true },
            },
          },
          orderBy: { enrollmentDate: 'desc' },
        },
        dietaryRestrictions: {
          where: { isActive: true },
          orderBy: { updatedAt: 'desc' },
        },
        developmentObs: {
          orderBy: { date: 'desc' },
          take: 20,
        },
        acompanhamentosNutricionais: {
          where: { ativo: true },
          orderBy: { atualizadoEm: 'desc' },
        },
        alertasAluno: {
          where: { status: 'ATIVO' },
          orderBy: { geradoEm: 'desc' },
          take: 20,
        },
        atendimentosPais: {
          orderBy: { dataAtendimento: 'desc' },
          take: 10,
        },
        developmentReports: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!child) {
      throw new NotFoundException('Criança não encontrada.');
    }
    if (child.mantenedoraId !== user.mantenedoraId) {
      throw new ForbiddenException('Acesso negado ao escopo da mantenedora.');
    }

    const unitAllowed = await canAccessUnit(user, child.unitId, async ({ userId }) => {
      const scopes = await this.prisma.userRoleUnitScope.findMany({
        where: { userRole: { userId, isActive: true } },
        select: { unitId: true },
      });
      return scopes.map((scope) => scope.unitId);
    });
    if (!unitAllowed) {
      throw new ForbiddenException('Acesso negado ao escopo da unidade.');
    }

    const activeClassroomIds = child.enrollments.map((item) => item.classroomId);
    const privilegedLevels = new Set<RoleLevel>([
      RoleLevel.DEVELOPER,
      RoleLevel.MANTENEDORA,
      RoleLevel.STAFF_CENTRAL,
      RoleLevel.UNIDADE,
    ]);
    const isProfessorOnly = user.roles.some((role) => role.level === RoleLevel.PROFESSOR)
      && !user.roles.some((role) => privilegedLevels.has(role.level));

    if (isProfessorOnly) {
      const classroomLink = await this.prisma.classroomTeacher.findFirst({
        where: {
          teacherId: user.sub,
          isActive: true,
          classroomId: { in: activeClassroomIds },
        },
        select: { classroomId: true },
      });
      if (!classroomLink) {
        throw new ForbiddenException('Acesso permitido somente às crianças da turma vinculada.');
      }
    }

    const privileged = user.roles.some((role) => privilegedLevels.has(role.level));

    return {
      child: {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth,
        unitId: child.unitId,
        activeClassrooms: child.enrollments.map((enrollment) => enrollment.classroom),
      },
      health: {
        bloodType: child.bloodType,
        allergies: privileged ? child.allergies : Boolean(child.allergies),
        medicalConditions: privileged ? child.medicalConditions : Boolean(child.medicalConditions),
        medicationNeeds: privileged ? child.medicationNeeds : Boolean(child.medicationNeeds),
        dietaryRestrictions: child.dietaryRestrictions.map((restriction) => ({
          id: restriction.id,
          type: restriction.type,
          name: restriction.name,
          description: privileged ? restriction.description : null,
          severity: restriction.severity,
          allowedFoods: privileged ? restriction.allowedFoods : null,
          forbiddenFoods: privileged ? restriction.forbiddenFoods : null,
        })),
      },
      development: child.developmentObs.map((observation) => ({
        id: observation.id,
        category: observation.category,
        date: observation.date,
        behaviorDescription: observation.behaviorDescription,
        socialInteraction: observation.socialInteraction,
        emotionalState: observation.emotionalState,
        motorSkills: observation.motorSkills,
        cognitiveSkills: observation.cognitiveSkills,
        languageSkills: observation.languageSkills,
        learningProgress: observation.learningProgress,
        interests: observation.interests,
        challenges: observation.challenges,
        recommendations: observation.recommendations,
        nextSteps: observation.nextSteps,
        psychologicalNotes: privileged ? observation.psychologicalNotes : null,
        healthNotes: privileged ? observation.healthNotes : null,
        dietaryNotes: privileged ? observation.dietaryNotes : null,
      })),
      nutrition: child.acompanhamentosNutricionais.map((caseItem) => ({
        id: caseItem.id,
        statusCaso: caseItem.statusCaso,
        motivoAcompanhamento: caseItem.motivoAcompanhamento,
        objetivos: caseItem.objetivos,
        condutaAtual: caseItem.condutaAtual,
        restricoesOperacionais: caseItem.restricoesOperacionais,
        substituicoesSeguras: caseItem.substituicoesSeguras,
        proximaReavaliacao: caseItem.proximaReavaliacao,
        atualizadoEm: caseItem.atualizadoEm,
      })),
      alerts: child.alertasAluno.map((alert) => ({
        id: alert.id,
        tipo: alert.tipo,
        status: alert.status,
        titulo: alert.titulo,
        descricao: alert.descricao,
        geradoEm: alert.geradoEm,
        lidoEm: alert.lidoEm,
        resolvidoEm: alert.resolvidoEm,
      })),
      familyCare: child.atendimentosPais.map((meeting) => ({
        id: meeting.id,
        tipo: meeting.tipo,
        status: meeting.status,
        dataAtendimento: meeting.dataAtendimento,
        assunto: meeting.assunto,
        retornoNecessario: meeting.retornoNecessario,
        dataRetorno: meeting.dataRetorno,
        descricao: privileged ? meeting.descricao : null,
        encaminhamento: privileged ? meeting.encaminhamento : null,
      })),
      reports: child.developmentReports.map((report) => ({
        id: report.id,
        period: report.period,
        status: report.status,
        publishedAt: report.publishedAt,
        createdAt: report.createdAt,
        content: privileged ? report.content : null,
      })),
      governance: {
        generatedAt: new Date().toISOString(),
        readOnly: true,
        sensitiveFieldsMinimized: !privileged,
        humanReviewRequired: true,
      },
    };
  }
}
