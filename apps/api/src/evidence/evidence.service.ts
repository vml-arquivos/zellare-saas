import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EvidenceReviewStatus, EvidenceSensitivity, EvidenceVisibility, Prisma, RoleLevel } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

export type EvidenceSourceInput = {
  sourceType: string;
  sourceId: string;
  childId: string;
  mantenedoraId?: string;
  unitId?: string;
  classroomId?: string | null;
  evidenceType: string;
  capturedAt?: Date | string | null;
  capturedBy?: string | null;
  content?: string | null;
  structuredData?: unknown;
  tags?: unknown;
  sensitivity?: EvidenceSensitivity;
  visibility?: EvidenceVisibility;
  sourceVersion?: number | null;
};

const PRIVILEGED_LEVELS = new Set<RoleLevel>([
  RoleLevel.DEVELOPER,
  RoleLevel.MANTENEDORA,
  RoleLevel.STAFF_CENTRAL,
  RoleLevel.UNIDADE,
]);

function text(...values: unknown[]): string | null {
  const parts = values
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => String(value).trim());
  return parts.length > 0 ? parts.join('\n\n') : null;
}

function safeJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function validDate(value?: Date | string | null): Date {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  private defaultSensitivity(sourceType: string, evidenceType: string): EvidenceSensitivity {
    const key = `${sourceType}:${evidenceType}`.toUpperCase();
    if (key.includes('PSICO') || key.includes('PSYCH')) return EvidenceSensitivity.PSICOLOGICA;
    if (key.includes('SAUDE') || key.includes('HEALTH') || key.includes('NUTRITION') || key.includes('RESTRICTION')) {
      return EvidenceSensitivity.SAUDE;
    }
    if (key.includes('FAMILIA') || key.includes('FAMILY')) return EvidenceSensitivity.FAMILIAR;
    return EvidenceSensitivity.ORDINARIA;
  }

  private defaultVisibility(sourceType: string, evidenceType: string): EvidenceVisibility {
    const key = `${sourceType}:${evidenceType}`.toUpperCase();
    if (key.includes('ATENDIMENTO') || key.includes('FAMILIA') || key.includes('FAMILY')) {
      return EvidenceVisibility.FAMILIA_AUTORIZADA;
    }
    if (key.includes('SAUDE') || key.includes('HEALTH') || key.includes('NUTRITION') || key.includes('ALERTA')) {
      return EvidenceVisibility.GESTAO;
    }
    if (key.includes('PROFILE') || key.includes('CHILD_PROFILE') || key.includes('RDIX')) {
      return EvidenceVisibility.RESTRITA;
    }
    return EvidenceVisibility.PEDAGOGICA;
  }

  private async childContext(childId: string, input: EvidenceSourceInput) {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: {
        id: true,
        mantenedoraId: true,
        unitId: true,
        enrollments: {
          where: { status: 'ATIVA' },
          select: { classroomId: true },
          orderBy: { enrollmentDate: 'desc' },
        },
      },
    });
    if (!child) return null;

    const mantenedoraId = input.mantenedoraId ?? child.mantenedoraId;
    if (mantenedoraId !== child.mantenedoraId) {
      throw new ForbiddenException('A evidência não pertence à mantenedora da criança.');
    }

    return {
      mantenedoraId,
      unitId: input.unitId ?? child.unitId,
      classroomId: input.classroomId ?? child.enrollments[0]?.classroomId ?? null,
    };
  }

  async upsert(input: EvidenceSourceInput) {
    if (!input.sourceType || !input.sourceId || !input.childId || !input.evidenceType) {
      throw new BadRequestException('sourceType, sourceId, childId e evidenceType são obrigatórios.');
    }

    const context = await this.childContext(input.childId, input);
    if (!context) return null;

    const sensitivity = input.sensitivity ?? this.defaultSensitivity(input.sourceType, input.evidenceType);
    const visibility = input.visibility ?? this.defaultVisibility(input.sourceType, input.evidenceType);
    const data = {
      mantenedoraId: context.mantenedoraId,
      unitId: context.unitId,
      classroomId: context.classroomId,
      childId: input.childId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceVersion: input.sourceVersion ?? undefined,
      evidenceType: input.evidenceType,
      capturedAt: validDate(input.capturedAt),
      capturedBy: input.capturedBy ?? undefined,
      content: input.content?.trim() || null,
      structuredData: safeJson(input.structuredData),
      tags: safeJson(input.tags),
      sensitivity,
      visibility,
      isActive: true,
    };

    return this.prisma.childEvidence.upsert({
      where: {
        sourceType_sourceId_childId: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          childId: input.childId,
        },
      },
      create: data,
      update: data,
    });
  }

  async syncSafely(label: string, task: () => Promise<unknown>) {
    try {
      return await task();
    } catch (error) {
      console.warn(`[evidence] falha ao sincronizar ${label}`, error);
      return null;
    }
  }

  async syncChildProfile(child: any) {
    if (!child?.id) return null;
    return this.upsert({
      sourceType: 'CHILD_PROFILE',
      sourceId: child.id,
      childId: child.id,
      mantenedoraId: child.mantenedoraId,
      unitId: child.unitId,
      evidenceType: 'CADASTRO_SAUDE_ADMINISTRATIVO',
      capturedAt: child.updatedAt ?? child.createdAt,
      capturedBy: child.updatedBy ?? child.createdBy,
      content: text(
        child.allergies,
        child.medicalConditions,
        child.medicationNeeds,
        child.descricaoLaudo,
        child.fichaAdministrativa ? 'Ficha administrativa atualizada.' : null,
      ),
      structuredData: {
        gender: child.gender,
        bloodType: child.bloodType,
        usoImagem: child.usoImagem,
        laudado: child.laudado,
        tipoLaudo: child.tipoLaudo,
        cid: child.cid,
        hasAdministrativeFile: Boolean(child.fichaAdministrativa),
      },
      sensitivity: EvidenceSensitivity.SAUDE,
      visibility: EvidenceVisibility.RESTRITA,
    });
  }

  async syncDiaryEvent(event: any) {
    const type = String(event.type ?? 'OUTRO');
    const evidenceType = type === 'ATIVIDADE_PEDAGOGICA' ? 'APRENDIZAGEM' : type;
    const sensitivity = type === 'SAUDE'
      ? EvidenceSensitivity.SAUDE
      : type === 'FAMILIA' ? EvidenceSensitivity.FAMILIAR : undefined;
    const visibility = type === 'SAUDE'
      ? EvidenceVisibility.GESTAO
      : type === 'FAMILIA' ? EvidenceVisibility.FAMILIA_AUTORIZADA : undefined;

    return this.upsert({
      sourceType: 'DIARY_EVENT',
      sourceId: event.id,
      childId: event.childId,
      mantenedoraId: event.mantenedoraId,
      unitId: event.unitId,
      classroomId: event.classroomId,
      evidenceType,
      capturedAt: event.eventDate,
      capturedBy: event.createdBy,
      content: text(event.title, event.description, event.observations, event.developmentNotes, event.behaviorNotes),
      structuredData: {
        status: event.status,
        type,
        planningId: event.planningId,
        curriculumEntryId: event.curriculumEntryId,
        medicaoAlimentar: event.medicaoAlimentar,
        sonoMinutos: event.sonoMinutos,
        trocaFraldaStatus: event.trocaFraldaStatus,
        aiContext: event.aiContext,
        mediaUrls: event.mediaUrls,
      },
      tags: event.tags,
      sensitivity,
      visibility,
    });
  }

  async syncDevelopmentObservation(observation: any) {
    return this.upsert({
      sourceType: 'DEVELOPMENT_OBSERVATION',
      sourceId: observation.id,
      childId: observation.childId,
      classroomId: observation.classroomId,
      evidenceType: observation.category || 'DESENVOLVIMENTO',
      capturedAt: observation.date,
      capturedBy: observation.createdBy,
      content: text(
        observation.behaviorDescription,
        observation.socialInteraction,
        observation.emotionalState,
        observation.motorSkills,
        observation.cognitiveSkills,
        observation.languageSkills,
        observation.healthNotes,
        observation.dietaryNotes,
        observation.sleepPattern,
        observation.learningProgress,
        observation.interests,
        observation.challenges,
        observation.psychologicalNotes,
        observation.developmentAlerts,
        observation.recommendations,
        observation.nextSteps,
      ),
      structuredData: {
        category: observation.category,
        indicadores: observation.indicadores,
        tags: observation.tags,
        domains: {
          behavior: observation.behaviorDescription,
          social: observation.socialInteraction,
          emotional: observation.emotionalState,
          motor: observation.motorSkills,
          cognitive: observation.cognitiveSkills,
          language: observation.languageSkills,
          health: observation.healthNotes,
          nutrition: observation.dietaryNotes,
          sleep: observation.sleepPattern,
          learning: observation.learningProgress,
        },
      },
      tags: observation.tags,
      sensitivity: observation.psychologicalNotes ? EvidenceSensitivity.PSICOLOGICA : undefined,
      visibility: observation.psychologicalNotes ? EvidenceVisibility.GESTAO : undefined,
    });
  }

  async syncAttendance(attendance: any) {
    return this.upsert({
      sourceType: 'ATTENDANCE',
      sourceId: attendance.id,
      childId: attendance.childId,
      mantenedoraId: attendance.mantenedoraId,
      unitId: attendance.unitId,
      classroomId: attendance.classroomId,
      evidenceType: attendance.status === 'PRESENTE' ? 'PRESENCA' : 'FREQUENCIA',
      capturedAt: attendance.date,
      capturedBy: attendance.recordedBy,
      content: text(`Status: ${attendance.status}`, attendance.justification),
      structuredData: { status: attendance.status, justification: attendance.justification },
    });
  }

  async syncStudentPostPerformance(performance: any) {
    const post = await this.prisma.classroomPost.findUnique({
      where: { id: performance.postId },
      select: { mantenedoraId: true, unitId: true, classroomId: true, title: true, dueDate: true },
    });
    if (!post) return null;
    return this.upsert({
      sourceType: 'STUDENT_POST_PERFORMANCE',
      sourceId: performance.id,
      childId: performance.childId,
      mantenedoraId: post.mantenedoraId,
      unitId: post.unitId,
      classroomId: post.classroomId,
      evidenceType: 'APRENDIZAGEM',
      capturedAt: performance.updatedAt ?? performance.createdAt ?? post.dueDate,
      capturedBy: performance.createdBy,
      content: text(post.title, performance.performance, performance.notes),
      structuredData: { postId: performance.postId, performance: performance.performance, notes: performance.notes },
    });
  }

  async syncAtendimentoPais(record: any) {
    return this.upsert({
      sourceType: 'ATENDIMENTO_PAIS',
      sourceId: record.id,
      childId: record.childId,
      mantenedoraId: record.mantenedoraId,
      unitId: record.unitId,
      evidenceType: 'FAMILIA',
      capturedAt: record.dataAtendimento ?? record.criadoEm,
      capturedBy: record.atendidoPorId,
      content: text(record.assunto, record.descricao, record.encaminhamento),
      structuredData: {
        tipo: record.tipo,
        status: record.status,
        retornoNecessario: record.retornoNecessario,
        dataRetorno: record.dataRetorno,
        responsavelRelacao: record.responsavelRelacao,
      },
      sensitivity: EvidenceSensitivity.FAMILIAR,
      visibility: EvidenceVisibility.FAMILIA_AUTORIZADA,
    });
  }

  async syncFamilyCommunication(record: any) {
    return this.upsert({
      sourceType: 'FAMILY_COMMUNICATION',
      sourceId: record.id,
      childId: record.childId,
      mantenedoraId: record.mantenedoraId,
      unitId: record.unitId,
      evidenceType: 'FAMILIA',
      capturedAt: record.createdAt,
      capturedBy: record.senderUserId,
      content: text(record.subject, record.body),
      structuredData: { status: record.status, recipientUserId: record.recipientUserId, readAt: record.readAt },
      sensitivity: EvidenceSensitivity.FAMILIAR,
      visibility: EvidenceVisibility.FAMILIA_AUTORIZADA,
    });
  }

  async syncNutrition(record: any) {
    return this.upsert({
      sourceType: 'NUTRITIONAL_FOLLOW_UP',
      sourceId: record.id,
      childId: record.childId,
      mantenedoraId: record.mantenedoraId,
      unitId: record.unitId,
      evidenceType: 'ALIMENTACAO_SAUDE',
      capturedAt: record.atualizadoEm ?? record.criadoEm,
      capturedBy: record.criadoPorId,
      content: text(record.motivoAcompanhamento, record.objetivos, record.condutaAtual, record.restricoesOperacionais, record.substituicoesSeguras),
      structuredData: {
        statusCaso: record.statusCaso,
        ativo: record.ativo,
        orientacoesProfCozinha: record.orientacoesProfCozinha,
        proximaReavaliacao: record.proximaReavaliacao,
      },
      sensitivity: EvidenceSensitivity.SAUDE,
      visibility: EvidenceVisibility.GESTAO,
    });
  }

  async syncDietaryRestriction(record: any) {
    const child = await this.prisma.child.findUnique({ where: { id: record.childId }, select: { mantenedoraId: true, unitId: true } });
    if (!child) return null;
    return this.upsert({
      sourceType: 'DIETARY_RESTRICTION',
      sourceId: record.id,
      childId: record.childId,
      mantenedoraId: child.mantenedoraId,
      unitId: child.unitId,
      evidenceType: 'ALIMENTACAO_SAUDE',
      capturedAt: record.updatedAt ?? record.createdAt,
      capturedBy: record.createdBy,
      content: text(record.name, record.description, record.forbiddenFoods, record.allowedFoods),
      structuredData: { type: record.type, severity: record.severity, isActive: record.isActive },
      sensitivity: EvidenceSensitivity.SAUDE,
      visibility: EvidenceVisibility.GESTAO,
    });
  }

  async syncDevelopmentReport(record: any) {
    return this.upsert({
      sourceType: 'DEVELOPMENT_REPORT',
      sourceId: record.id,
      childId: record.childId,
      mantenedoraId: undefined,
      unitId: record.unitId,
      classroomId: record.classroomId,
      evidenceType: 'RELATORIO_DESENVOLVIMENTO',
      capturedAt: record.updatedAt ?? record.createdAt,
      capturedBy: record.authorId,
      content: record.content,
      structuredData: { period: record.period, status: record.status, publishedAt: record.publishedAt },
      sensitivity: EvidenceSensitivity.SENSIVEL,
      visibility: EvidenceVisibility.RESTRITA,
    });
  }

  async syncRdxInstance(record: any) {
    const document = record.conteudoFinal ?? record.rascunhoJson;
    return this.upsert({
      sourceType: 'RDIX_INSTANCE',
      sourceId: record.id,
      childId: record.childId,
      mantenedoraId: record.mantenedoraId,
      unitId: record.unitId,
      classroomId: record.classroomId,
      evidenceType: 'DOCUMENTO_OFICIAL',
      capturedAt: record.atualizadoEm ?? record.criadoEm,
      capturedBy: record.revisadoPorId ?? record.criadoPorId,
      content: document ? JSON.stringify(document) : null,
      structuredData: {
        periodo: record.periodo,
        periodoEnum: record.periodoEnum,
        anoLetivo: record.anoLetivo,
        status: record.status,
        submittedAt: record.submittedAt,
        reviewedAt: record.reviewedAt,
      },
      sensitivity: EvidenceSensitivity.SENSIVEL,
      visibility: EvidenceVisibility.RESTRITA,
    });
  }

  async syncPhotoReport(report: any, photos: any[] = []) {
    const linkedPhotos = photos.flatMap((photo, index) => {
      const childIds = Array.isArray(photo?.criancas)
        ? photo.criancas
        : Array.isArray(photo?.childIds) ? photo.childIds : [];
      return childIds.map((childId: string) => ({ photo, index, childId }));
    });

    let count = 0;
    for (const item of linkedPhotos) {
      const result = await this.upsert({
        sourceType: 'MEDIA',
        sourceId: `${report.id}:${item.photo?.id ?? item.index}:${item.childId}`,
        childId: item.childId,
        mantenedoraId: report.mantenedoraId,
        unitId: report.unitId,
        classroomId: report.classroomId,
        evidenceType: 'MIDIA_PEDAGOGICA',
        capturedAt: report.dataAtividade,
        capturedBy: report.criadoPorId,
        content: text(report.titulo, report.activityDescription, item.photo?.legenda, item.photo?.descricao),
        structuredData: {
          url: item.photo?.url,
          campoExperiencia: item.photo?.campoExperiencia,
          relatorioFotoId: report.id,
          publicado: report.publicado,
        },
        visibility: EvidenceVisibility.PEDAGOGICA,
      });
      if (result) count++;
    }
    return { count };
  }

  async syncOperationalAlert(record: any) {
    if (!record?.childId) return null;
    return this.upsert({
      sourceType: 'ALERTA_OPERACIONAL',
      sourceId: record.id,
      childId: record.childId,
      mantenedoraId: record.mantenedoraId,
      unitId: record.unitId,
      classroomId: record.classroomId,
      evidenceType: 'ALERTA_DERIVADO',
      capturedAt: record.criadoEm,
      capturedBy: record.resolvidoPorId,
      content: text(record.titulo, record.descricao),
      structuredData: { tipo: record.tipo, severidade: record.severidade, resolvido: record.resolvido, metadados: record.metadados, resolvidoEm: record.resolvidoEm },
      sensitivity: EvidenceSensitivity.SENSIVEL,
      visibility: EvidenceVisibility.GESTAO,
    });
  }

  async syncAlert(record: any) {
    if (!record.childId) return null;
    return this.upsert({
      sourceType: 'ALERTA_ALUNO',
      sourceId: record.id,
      childId: record.childId,
      mantenedoraId: record.mantenedoraId,
      unitId: record.unitId,
      classroomId: record.classroomId,
      evidenceType: 'ALERTA_DERIVADO',
      capturedAt: record.geradoEm,
      capturedBy: record.resolvidoPor,
      content: text(record.titulo, record.descricao),
      structuredData: { tipo: record.tipo, status: record.status, dados: record.dados, resolvidoEm: record.resolvidoEm },
      sensitivity: EvidenceSensitivity.SENSIVEL,
      visibility: EvidenceVisibility.GESTAO,
    });
  }

  private async scopeWhere(user: JwtPayload): Promise<any> {
    const levels = new Set((user.roles ?? []).map((role: any) => role.level));
    const where: any = { mantenedoraId: user.mantenedoraId, isActive: true };

    if (levels.has(RoleLevel.DEVELOPER) || levels.has(RoleLevel.MANTENEDORA)) {
      return where;
    }

    if (levels.has(RoleLevel.STAFF_CENTRAL)) {
      const staffRole: any = user.roles.find((role: any) => role.level === RoleLevel.STAFF_CENTRAL);
      const scopes = Array.isArray(staffRole?.unitScopes) ? staffRole.unitScopes : [];
      if (scopes.length > 0) where.unitId = { in: scopes };
      return where;
    }

    if (levels.has(RoleLevel.UNIDADE)) {
      where.unitId = user.unitId ?? '__none__';
      return where;
    }

    if (levels.has(RoleLevel.PROFESSOR)) {
      const links = await this.prisma.classroomTeacher.findMany({
        where: { teacherId: user.sub, isActive: true },
        select: { classroomId: true },
      });
      const classroomIds = links.map((link) => link.classroomId);
      where.classroomId = classroomIds.length > 0 ? { in: classroomIds } : '__none__';
      where.OR = [{ visibility: { in: [EvidenceVisibility.PEDAGOGICA, EvidenceVisibility.INTERNA] } }];
      where.sensitivity = { in: [EvidenceSensitivity.ORDINARIA, EvidenceSensitivity.SENSIVEL] };
      return where;
    }

    if (levels.has((RoleLevel as any).FAMILIA)) {
      where.visibility = EvidenceVisibility.FAMILIA_AUTORIZADA;
      where.child = { guardianLinks: { some: { userId: user.sub, revokedAt: null, canViewTimeline: true } } };
      return where;
    }

    where.unitId = '__none__';
    return where;
  }

  async list(query: { childId?: string; classroomId?: string; unitId?: string; sourceType?: string; evidenceType?: string; startDate?: string; endDate?: string; limit?: string; skip?: string }, user: JwtPayload) {
    const where = await this.scopeWhere(user);
    if (query.childId) where.childId = query.childId;
    if (query.classroomId) where.classroomId = query.classroomId;
    const canChooseUnit = user.roles?.some((role: any) => PRIVILEGED_LEVELS.has(role.level));
    if (query.unitId && canChooseUnit) where.unitId = query.unitId;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.evidenceType) where.evidenceType = query.evidenceType;
    if (query.startDate || query.endDate) {
      where.capturedAt = {
        ...(query.startDate ? { gte: validDate(query.startDate) } : {}),
        ...(query.endDate ? { lte: validDate(query.endDate) } : {}),
      };
    }

    const take = Math.min(Math.max(Number(query.limit) || 200, 1), 1000);
    const skip = Math.max(Number(query.skip) || 0, 0);
    return this.prisma.childEvidence.findMany({
      where,
      orderBy: { capturedAt: 'desc' },
      take,
      skip,
      include: { child: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
    });
  }

  async summary(childId: string, user: JwtPayload) {
    const evidence = await this.list({ childId, limit: '1000' }, user);
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const bySensitivity: Record<string, number> = {};
    for (const item of evidence) {
      byType[item.evidenceType] = (byType[item.evidenceType] ?? 0) + 1;
      bySource[item.sourceType] = (bySource[item.sourceType] ?? 0) + 1;
      bySensitivity[item.sensitivity] = (bySensitivity[item.sensitivity] ?? 0) + 1;
    }
    return {
      childId,
      total: evidence.length,
      byType,
      bySource,
      bySensitivity,
      lastCapturedAt: evidence[0]?.capturedAt ?? null,
      timeline: evidence.slice(0, 30),
      governance: {
        generatedAt: new Date().toISOString(),
        evidenceOnly: true,
        humanReviewRequired: true,
        sourceTraceability: true,
      },
    };
  }

  async crossAnalysis(childId: string, query: { startDate?: string; endDate?: string }, user: JwtPayload) {
    const endDate = validDate(query.endDate);
    const startDate = query.startDate ? validDate(query.startDate) : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (startDate > endDate) throw new BadRequestException('Período de análise inválido.');

    const evidence = await this.list({
      childId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: '1000',
    }, user);

    const byWeek: Record<string, { total: number; byType: Record<string, number>; bySource: Record<string, number> }> = {};
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const attendance = { total: 0, presentes: 0, ausentes: 0, justificados: 0, atrasos: 0 };
    const alertas = { total: 0, altas: 0, criticas: 0 };
    const dates = new Set<string>();

    for (const item of evidence) {
      const captured = new Date(item.capturedAt);
      const day = captured.toISOString().slice(0, 10);
      dates.add(day);
      const week = `${captured.getUTCFullYear()}-W${String(Math.ceil((captured.getUTCDate() + new Date(Date.UTC(captured.getUTCFullYear(), captured.getUTCMonth(), 1)).getUTCDay()) / 7)).padStart(2, '0')}`;
      byWeek[week] ??= { total: 0, byType: {}, bySource: {} };
      byWeek[week].total++;
      byWeek[week].byType[item.evidenceType] = (byWeek[week].byType[item.evidenceType] ?? 0) + 1;
      byWeek[week].bySource[item.sourceType] = (byWeek[week].bySource[item.sourceType] ?? 0) + 1;
      byType[item.evidenceType] = (byType[item.evidenceType] ?? 0) + 1;
      bySource[item.sourceType] = (bySource[item.sourceType] ?? 0) + 1;

      if (item.sourceType === 'ATTENDANCE') {
        attendance.total++;
        const status = String((item.structuredData as any)?.status ?? '');
        if (status === 'PRESENTE') attendance.presentes++;
        if (status === 'AUSENTE') attendance.ausentes++;
        if (status === 'JUSTIFICADO') attendance.justificados++;
        if (status === 'ATRASO') attendance.atrasos++;
      }
      if (item.evidenceType === 'ALERTA_DERIVADO') {
        alertas.total++;
        const severity = String((item.structuredData as any)?.severidade ?? '').toUpperCase();
        if (severity === 'ALTA') alertas.altas++;
        if (severity === 'CRITICA') alertas.criticas++;
      }
    }

    return {
      childId,
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      totalEvidence: evidence.length,
      daysWithEvidence: dates.size,
      byType,
      bySource,
      byWeek,
      attendance: {
        ...attendance,
        rate: attendance.total > 0 ? Math.round((attendance.presentes / attendance.total) * 100) : null,
      },
      alerts: alertas,
      latest: evidence.slice(0, 20),
      governance: {
        generatedAt: new Date().toISOString(),
        method: 'descriptive-cross-source-v1',
        diagnosticInference: false,
        humanReviewRequired: true,
      },
    };
  }

  async review(id: string, status: EvidenceReviewStatus, note: string | undefined, user: JwtPayload) {
    const level = user.roles?.find((role: any) => PRIVILEGED_LEVELS.has(role.level))?.level;
    if (!level) throw new ForbiddenException('Somente perfis de gestão podem revisar evidências.');
    const current = await this.prisma.childEvidence.findUnique({ where: { id } });
    if (!current || current.mantenedoraId !== user.mantenedoraId) throw new NotFoundException('Evidência não encontrada.');
    return this.prisma.childEvidence.update({
      where: { id },
      data: { reviewStatus: status, reviewNote: note?.trim() || null, reviewedBy: user.sub, reviewedAt: new Date() },
    });
  }

  async backfill() {
    const counts: Record<string, number> = {};
    const syncBatch = async (source: string, rows: any[], sync: (row: any) => Promise<unknown>) => {
      let count = 0;
      for (const row of rows) {
        const result = await sync(row);
        if (result) count++;
      }
      counts[source] = count;
    };

    await syncBatch('CHILD_PROFILE', await this.prisma.child.findMany({}), (row) => this.syncChildProfile(row));
    await syncBatch('DIARY_EVENT', await this.prisma.diaryEvent.findMany({}), (row) => this.syncDiaryEvent(row));
    await syncBatch('DEVELOPMENT_OBSERVATION', await this.prisma.developmentObservation.findMany({}), (row) => this.syncDevelopmentObservation(row));
    await syncBatch('ATTENDANCE', await this.prisma.attendance.findMany({}), (row) => this.syncAttendance(row));
    await syncBatch('STUDENT_POST_PERFORMANCE', await this.prisma.studentPostPerformance.findMany({}), (row) => this.syncStudentPostPerformance(row));
    await syncBatch('ATENDIMENTO_PAIS', await this.prisma.atendimentoPais.findMany({}), (row) => this.syncAtendimentoPais(row));
    await syncBatch('FAMILY_COMMUNICATION', await this.prisma.familyCommunication.findMany({}), (row) => this.syncFamilyCommunication(row));
    await syncBatch('DIETARY_RESTRICTION', await this.prisma.dietaryRestriction.findMany({}), (row) => this.syncDietaryRestriction(row));
    await syncBatch('NUTRITIONAL_FOLLOW_UP', await this.prisma.acompanhamentoNutricional.findMany({}), (row) => this.syncNutrition(row));
    await syncBatch('RDIX_INSTANCE', await this.prisma.rDIXInstancia.findMany({}), (row) => this.syncRdxInstance(row));
    await syncBatch('DEVELOPMENT_REPORT', await this.prisma.developmentReport.findMany({}), (row) => this.syncDevelopmentReport(row));
    await syncBatch('ALERTA_ALUNO', await this.prisma.alertaAluno.findMany({}), (row) => this.syncAlert(row));

    return { success: true, counts, generatedAt: new Date().toISOString() };
  }
}
