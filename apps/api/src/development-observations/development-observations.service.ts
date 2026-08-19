import { BadRequestException, Injectable, ForbiddenException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RoleLevel } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { EvidenceService } from '../evidence/evidence.service';


const UPLOADS_ROOT_DIR = path.resolve(process.env.UPLOADS_DIR ?? 'uploads');
const DEVELOPMENT_ATTACHMENT_MARKER = '[ANEXO_ATIVIDADE]';

function safeFilename(name: string): string {
  return String(name || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120) || 'arquivo';
}

function extractDevelopmentAttachment(nextSteps?: string | null): any | null {
  if (!nextSteps) return null;
  const line = nextSteps
    .split('\n')
    .find((part) => part.trim().startsWith(DEVELOPMENT_ATTACHMENT_MARKER));
  if (!line) return null;
  const rawJson = line.replace(DEVELOPMENT_ATTACHMENT_MARKER, '').trim();
  try {
    return JSON.parse(rawJson);
  } catch {
    return null;
  }
}

function removeDevelopmentAttachmentMarker(nextSteps?: string | null): string {
  if (!nextSteps) return '';
  return nextSteps
    .split('\n')
    .filter((part) => !part.trim().startsWith(DEVELOPMENT_ATTACHMENT_MARKER))
    .join('\n')
    .trim();
}

function serializeDevelopmentObservation<T extends Record<string, any>>(obs: T): T & {
  atividadeArquivoUrl?: string;
  atividadeArquivoNome?: string;
  atividadeArquivoMimeType?: string;
  atividadeArquivoSize?: number;
} {
  const attachment = extractDevelopmentAttachment(obs?.nextSteps);
  if (!attachment) return obs as any;
  return {
    ...obs,
    atividadeArquivoUrl: attachment.url,
    atividadeArquivoNome: attachment.name,
    atividadeArquivoMimeType: attachment.mimeType,
    atividadeArquivoSize: attachment.size,
  };
}

function hasLevel(user: JwtPayload, ...levels: RoleLevel[]): boolean {
  return Array.isArray(user.roles) && user.roles.some((r: any) => levels.includes(r?.level));
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function diaryCategory(type: unknown): string {
  const normalized = String(type ?? '').toUpperCase();
  if (normalized.includes('DESENVOLVIMENTO')) return 'DESENVOLVIMENTO';
  if (normalized.includes('COMPORTAMENTO')) return 'COMPORTAMENTO';
  if (normalized.includes('AVALIACAO') || normalized.includes('ATIVIDADE')) return 'APRENDIZAGEM';
  if (normalized.includes('SAUDE')) return 'PSICOLOGICO';
  if (normalized.includes('REFEICAO') || normalized.includes('SONO') || normalized.includes('HIGIENE')) return 'GERAL';
  return 'GERAL';
}

function nullableText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

@Injectable()
export class DevelopmentObservationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly evidenceService?: EvidenceService,
  ) {}

  /** Retorna as turmas que o usuário pode consultar. Null significa acesso total. */
  private async accessibleClassroomIds(user: JwtPayload): Promise<string[] | null> {
    if (hasLevel(user, RoleLevel.DEVELOPER)) return null;

    const where: any = { isActive: true };
    if (hasLevel(user, RoleLevel.MANTENEDORA)) {
      where.unit = { mantenedoraId: user.mantenedoraId };
    } else if (hasLevel(user, RoleLevel.STAFF_CENTRAL)) {
      const staffRole = user.roles?.find((role: any) => role?.level === RoleLevel.STAFF_CENTRAL);
      const scopes = Array.isArray(staffRole?.unitScopes) ? staffRole.unitScopes : [];
      where.unit = { mantenedoraId: user.mantenedoraId };
      if (scopes.length > 0) where.unitId = { in: scopes };
    } else if (hasLevel(user, RoleLevel.UNIDADE)) {
      if (!user.unitId) return [];
      where.unitId = user.unitId;
    } else if (hasLevel(user, RoleLevel.PROFESSOR)) {
      const links = await this.prisma.classroomTeacher.findMany({
        where: { teacherId: user.sub, isActive: true },
        select: { classroomId: true },
      });
      return links.map((link) => link.classroomId);
    } else {
      return [];
    }

    const classrooms = await this.prisma.classroom.findMany({ where, select: { id: true } });
    return classrooms.map((classroom) => classroom.id);
  }

  /**
   * Leitura unificada: transforma eventos naturais do Diário em evidências de desenvolvimento
   * sem duplicar linhas em `development_observation`.
   */
  private async listarIntegrado(query: any, user: JwtPayload) {
    let classroomIds = await this.accessibleClassroomIds(user);
    if (Array.isArray(classroomIds) && classroomIds.length === 0) return [];

    // Quando um painel central seleciona uma unidade, restringir a leitura às
    // turmas ativas dessa unidade e à mantenedora do usuário. Para DEVELOPER,
    // accessibleClassroomIds retorna null (acesso amplo), então este recorte
    // transforma explicitamente a seleção em uma lista segura de turmas.
    if (query.unitId) {
      const scopedClassrooms = await this.prisma.classroom.findMany({
        where: {
          unitId: query.unitId,
          isActive: true,
          unit: { mantenedoraId: user.mantenedoraId },
          ...(Array.isArray(classroomIds) ? { id: { in: classroomIds } } : {}),
        },
        select: { id: true },
      });
      classroomIds = scopedClassrooms.map((classroom) => classroom.id);
    }

    if (query.classroomId && Array.isArray(classroomIds) && !classroomIds.includes(query.classroomId)) {
      return [];
    }
    if (Array.isArray(classroomIds) && classroomIds.length === 0) return [];

    const dateFilter: any = {};
    if (query.startDate) dateFilter.gte = new Date(query.startDate);
    if (query.endDate) dateFilter.lte = new Date(query.endDate);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const formalWhere: any = {
      ...(query.childId ? { childId: query.childId } : {}),
      ...(query.classroomId ? { classroomId: query.classroomId } : {}),
      ...(hasDateFilter ? { date: dateFilter } : {}),
      ...(classroomIds ? { classroomId: { in: classroomIds, ...(query.classroomId ? {} : {}) } } : {}),
      ...(hasLevel(user, RoleLevel.PROFESSOR) ? { createdBy: user.sub } : {}),
    };
    if (query.classroomId) formalWhere.classroomId = query.classroomId;

    const diaryWhere: any = {
      ...(query.childId ? { childId: query.childId } : {}),
      ...(query.classroomId ? { classroomId: query.classroomId } : {}),
      ...(hasDateFilter ? { eventDate: dateFilter } : {}),
      ...(classroomIds ? { classroomId: { in: classroomIds } } : {}),
      ...(hasLevel(user, RoleLevel.PROFESSOR) ? { createdBy: user.sub } : {}),
    };
    // Institucionalmente, somente registros publicados/revisados entram nos painéis.
    if (!hasLevel(user, RoleLevel.PROFESSOR)) {
      diaryWhere.status = { in: ['PUBLICADO', 'REVISADO', 'ARQUIVADO'] };
    }

    const [formal, diary] = await Promise.all([
      this.prisma.developmentObservation.findMany({
        where: formalWhere,
        orderBy: { date: 'desc' },
        take: 500,
        include: { child: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
      }),
      this.prisma.diaryEvent.findMany({
        where: diaryWhere,
        orderBy: { eventDate: 'desc' },
        take: 500,
        include: {
          child: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
          classroom: { select: { id: true, name: true, unit: { select: { id: true, name: true } } } },
          createdByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          curriculumEntry: { select: { campoDeExperiencia: true, objetivoBNCC: true, objetivoBNCCCode: true } },
        },
      }),
    ]);

    const formalClassroomIds = formal.map((item) => item.classroomId).filter(Boolean) as string[];
    const formalClassrooms = formalClassroomIds.length > 0
      ? await this.prisma.classroom.findMany({
          where: { id: { in: formalClassroomIds } },
          select: { id: true, name: true, unit: { select: { id: true, name: true } } },
        })
      : [];
    const classroomMap = new Map(formalClassrooms.map((item) => [item.id, item]));

    const formalItems = formal
      .filter((item) => !query.category || item.category === query.category)
      .map((item: any) => {
        const classroom = item.classroomId ? classroomMap.get(item.classroomId) ?? null : null;
        const content = firstText(
          item.behaviorDescription,
          item.learningProgress,
          item.socialInteraction,
          item.emotionalState,
          item.motorSkills,
          item.cognitiveSkills,
          item.languageSkills,
          item.recommendations,
        ) ?? '';
        return {
          ...item,
          source: 'DevelopmentObservation',
          sourceId: item.id,
          content,
          child: item.child ? { ...item.child, name: `${item.child.firstName} ${item.child.lastName}`.trim() } : item.child,
          classroom,
          unitId: classroom?.unit?.id ?? null,
          unitName: classroom?.unit?.name ?? null,
          createdByUser: null,
        };
      });

    const diaryItems = diary
      .filter((item: any) => !query.category || diaryCategory(item.type) === query.category)
      .map((item: any) => {
        const content = firstText(item.description, item.observations, item.developmentNotes, item.behaviorNotes) ?? '';
        return {
          id: `diary:${item.id}`,
          sourceId: item.id,
          source: 'DiaryEvent',
          category: item.curriculumEntry?.campoDeExperiencia ?? diaryCategory(item.type),
          date: item.eventDate,
          createdAt: item.createdAt,
          childId: item.childId,
          classroomId: item.classroomId,
          behaviorDescription: item.behaviorNotes ?? null,
          learningProgress: item.developmentNotes ?? null,
          developmentAlerts: item.type === 'COMPORTAMENTO' || item.type === 'SAUDE' ? content : null,
          recommendations: null,
          nextSteps: null,
          content,
          title: item.title,
          curriculumEntry: item.curriculumEntry ?? null,
          status: item.status,
          child: item.child ? { ...item.child, name: `${item.child.firstName} ${item.child.lastName}`.trim() } : item.child,
          classroom: item.classroom,
          unitId: item.classroom?.unit?.id ?? null,
          unitName: item.classroom?.unit?.name ?? null,
          createdByUser: item.createdByUser,
        };
      });

    const evidenceItems = this.evidenceService
      ? (await this.evidenceService.list({
          childId: query.childId,
          classroomId: query.classroomId,
          startDate: query.startDate,
          endDate: query.endDate,
          limit: '500',
        }, user))
        .filter((item: any) => !query.category || item.evidenceType === query.category || item.sourceType === query.category)
        .map((item: any) => ({
          id: `evidence:${item.id}`,
          sourceId: item.sourceId,
          source: 'ChildEvidence',
          sourceType: item.sourceType,
          evidenceType: item.evidenceType,
          sensitivity: item.sensitivity,
          visibility: item.visibility,
          reviewStatus: item.reviewStatus,
          category: item.evidenceType,
          date: item.capturedAt,
          createdAt: item.createdAt,
          childId: item.childId,
          classroomId: item.classroomId,
          behaviorDescription: item.evidenceType === 'COMPORTAMENTO' ? item.content : null,
          learningProgress: ['APRENDIZAGEM', 'DESENVOLVIMENTO', 'MIDIA_PEDAGOGICA'].includes(item.evidenceType) ? item.content : null,
          developmentAlerts: item.evidenceType === 'ALERTA_DERIVADO' ? item.content : null,
          recommendations: null,
          nextSteps: null,
          content: item.content ?? '',
          title: item.evidenceType,
          structuredData: item.structuredData,
          status: item.reviewStatus,
          child: item.child ? { ...item.child, name: `${item.child.firstName} ${item.child.lastName}`.trim() } : null,
          classroom: null,
          unitId: item.unitId,
          unitName: null,
          createdByUser: null,
        }))
      : [];

    return [...formalItems, ...diaryItems, ...evidenceItems]
      .sort((a, b) => new Date(b.date ?? b.createdAt).getTime() - new Date(a.date ?? a.createdAt).getTime())
      .slice(0, Math.min(Number(query.limit) || 200, 500));
  }

  /**
   * Professor/coordenador cria observação individual de uma criança.
   *
   * Regra de segurança desta correção:
   * - grava apenas campos existentes no model DevelopmentObservation do schema.prisma;
   * - ignora campos experimentais antigos que não existem no banco atual;
   * - não altera matriz, plano de aula, diário, RDIC ou qualquer dado histórico.
   */
  async criar(dto: any, user: JwtPayload) {
    const data = this.mapCreateData(dto, user);

    const obs = await this.prisma.developmentObservation.create({
      data,
      include: {
        child: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
      },
    });

    await this.evidenceService?.syncSafely('DEVELOPMENT_OBSERVATION', () => this.evidenceService!.syncDevelopmentObservation(obs));

    return serializeDevelopmentObservation(obs);
  }

  /** Listar observações e evidências do Diário — filtro por criança, turma, categoria e período. */
  async listar(query: any, user: JwtPayload) {
    const integrated = await this.listarIntegrado(query, user);
    return integrated.map((item) => serializeDevelopmentObservation(item));
  }

  /** Detalhe de uma observação. */
  async getById(id: string) {
    const obs = await this.prisma.developmentObservation.findUnique({
      where: { id },
      include: { child: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
    });
    if (!obs) throw new NotFoundException('Observação não encontrada');
    return serializeDevelopmentObservation(obs);
  }

  /** Atualizar observação sem aceitar campos inexistentes no Prisma. */
  async atualizar(id: string, dto: any, user: JwtPayload) {
    const obs = await this.prisma.developmentObservation.findUnique({ where: { id } });
    if (!obs) throw new NotFoundException('Observação não encontrada');

    if (hasLevel(user, RoleLevel.PROFESSOR) && obs.createdBy !== user.sub) {
      throw new ForbiddenException('Sem permissão para editar esta observação');
    }

    const data = this.mapUpdateData(dto);

    const updated = await this.prisma.developmentObservation.update({
      where: { id },
      data,
      include: { child: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
    });

    await this.evidenceService?.syncSafely('DEVELOPMENT_OBSERVATION', () => this.evidenceService!.syncDevelopmentObservation(updated));

    return serializeDevelopmentObservation(updated);
  }

  /** Deletar observação. */
  async deletar(id: string, user: JwtPayload) {
    const obs = await this.prisma.developmentObservation.findUnique({ where: { id } });
    if (!obs) throw new NotFoundException('Observação não encontrada');

    if (hasLevel(user, RoleLevel.PROFESSOR) && obs.createdBy !== user.sub) {
      throw new ForbiddenException('Sem permissão para excluir esta observação');
    }

    await this.prisma.developmentObservation.delete({ where: { id } });
    return { success: true };
  }

  /** Evolução detalhada de uma criança, incluindo evidências do Diário. */
  async evolucaoAluno(childId: string, periodoMeses = 3, user: JwtPayload) {
    const dataInicio = new Date();
    dataInicio.setMonth(dataInicio.getMonth() - periodoMeses);
    const obs = await this.listarIntegrado({ childId, startDate: dataInicio.toISOString(), limit: 500 }, user);
    const ordenadas = [...obs].sort((a, b) => new Date(a.date ?? a.createdAt).getTime() - new Date(b.date ?? b.createdAt).getTime());

    const porSemana: Record<string, { semana: string; total: number; alertas: number; categorias: Record<string, number> }> = {};
    for (const o of ordenadas) {
      const d = new Date(o.date ?? o.createdAt);
      const semana = `${d.getFullYear()}-S${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7).toString().padStart(2, '0')}`;
      if (!porSemana[semana]) porSemana[semana] = { semana, total: 0, alertas: 0, categorias: {} };
      porSemana[semana].total++;
      if (o.developmentAlerts) porSemana[semana].alertas++;
      const cat = o.category || 'GERAL';
      porSemana[semana].categorias[cat] = (porSemana[semana].categorias[cat] ?? 0) + 1;
    }

    const categorias = ordenadas.reduce((acc: Record<string, number>, o) => {
      const cat = o.category || 'GERAL';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
    const totalAlertas = ordenadas.filter((o) => Boolean(o.developmentAlerts)).length;
    const tendencia = totalAlertas > ordenadas.length * 0.3 ? 'ATENCAO'
      : totalAlertas === 0 ? 'ESTAVEL' : 'MONITORAR';

    return {
      childId,
      periodoMeses,
      totalObs: ordenadas.length,
      totalAlertas,
      tendencia,
      categorias,
      serieSemanal: Object.values(porSemana),
      ultimasObs: ordenadas.slice(-5).reverse().map((item) => serializeDevelopmentObservation(item)),
    };
  }

  /** Resumo de desenvolvimento de uma criança para coordenação/psicologia. */
  async resumoAluno(childId: string, user: JwtPayload) {
    const obs = await this.listarIntegrado({ childId, limit: 500 }, user);
    const porCategoria = obs.reduce((acc: Record<string, number>, o) => {
      const category = o.category || 'GERAL';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    const totalAlertas = obs.filter((o) => Boolean(o.developmentAlerts)).length;
    const totalRecomendacoes = obs.filter((o) => Boolean(o.recommendations)).length;
    return {
      total: obs.length,
      totalAlertas,
      totalRecomendacoes,
      porCategoria,
      ultimas: obs.slice(0, 20).map((item) => serializeDevelopmentObservation(item)),
    };
  }

  /** Resumo consolidado de uma turma, incluindo o Diário de Bordo. */
  async resumoTurma(classroomId: string, user: JwtPayload) {
    const obs = await this.listarIntegrado({ classroomId, limit: 500 }, user);
    const porCategoria = obs.reduce((acc: Record<string, number>, o) => {
      const category = o.category || 'GERAL';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    const porCrianca: Record<string, { id: string; nome: string; total: number; alertas: number; recomendacoes: number; categorias: Record<string, number> }> = {};

    for (const o of obs) {
      const cid = o.childId;
      const nome = o.child?.name ?? (`${o.child?.firstName ?? ''} ${o.child?.lastName ?? ''}`.trim() || cid);
      if (!porCrianca[cid]) porCrianca[cid] = { id: cid, nome, total: 0, alertas: 0, recomendacoes: 0, categorias: {} };
      porCrianca[cid].total++;
      if (o.developmentAlerts) porCrianca[cid].alertas++;
      if (o.recommendations) porCrianca[cid].recomendacoes++;
      const category = o.category || 'GERAL';
      porCrianca[cid].categorias[category] = (porCrianca[cid].categorias[category] || 0) + 1;
    }

    const criancas = Object.values(porCrianca).sort((a, b) => b.total - a.total);
    return {
      classroomId,
      totalObs: obs.length,
      totalAlertas: obs.filter((o) => Boolean(o.developmentAlerts)).length,
      totalRecomendacoes: obs.filter((o) => Boolean(o.recommendations)).length,
      totalCriancas: criancas.length,
      porCategoria,
      criancas,
    };
  }


  /**
   * Upload de anexo da observação usando multipart/form-data.
   * Não usa base64 em JSON e não cria/migra campos no banco.
   * O link do arquivo é gravado em nextSteps com marcador técnico seguro.
   */
  async uploadAttachment(id: string, file: Express.Multer.File, user: JwtPayload) {
    if (!file) throw new BadRequestException('Arquivo é obrigatório');

    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo não permitido. Envie imagem, PDF, DOC ou DOCX.');
    }

    const obs = await this.prisma.developmentObservation.findUnique({
      where: { id },
      include: { child: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
    });
    if (!obs) throw new NotFoundException('Observação não encontrada');

    if (hasLevel(user, RoleLevel.PROFESSOR) && obs.createdBy !== user.sub) {
      throw new ForbiddenException('Sem permissão para anexar arquivo nesta observação');
    }

    const originalName = safeFilename(file.originalname || 'anexo');
    const extension = path.extname(originalName).slice(0, 16);
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const relativeDir = path.join('development-observations', id);
    const absoluteDir = path.join(UPLOADS_ROOT_DIR, relativeDir);
    await fs.mkdir(absoluteDir, { recursive: true });
    await fs.writeFile(path.join(absoluteDir, filename), file.buffer);

    const attachment = {
      url: `/uploads/development-observations/${id}/${filename}`,
      name: originalName,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };

    const nextStepsBase = removeDevelopmentAttachmentMarker(obs.nextSteps);
    const nextSteps = `${nextStepsBase}${nextStepsBase ? '\n' : ''}${DEVELOPMENT_ATTACHMENT_MARKER} ${JSON.stringify(attachment)}`;

    const updated = await this.prisma.developmentObservation.update({
      where: { id },
      data: { nextSteps },
      include: { child: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
    });

    return serializeDevelopmentObservation(updated);
  }

  private mapCreateData(dto: any, user: JwtPayload) {
    if (!dto?.childId) throw new Error('childId é obrigatório');

    return {
      childId: dto.childId,
      classroomId: dto.classroomId ?? null,
      category: dto.category ?? 'GERAL',
      date: dto.date ? new Date(dto.date) : new Date(),
      behaviorDescription: nullableText(dto.behaviorDescription),
      socialInteraction: nullableText(dto.socialInteraction),
      emotionalState: nullableText(dto.emotionalState),
      motorSkills: nullableText(dto.motorSkills),
      cognitiveSkills: nullableText(dto.cognitiveSkills),
      languageSkills: nullableText(dto.languageSkills),
      healthNotes: nullableText(dto.healthNotes),
      dietaryNotes: nullableText(dto.dietaryNotes),
      sleepPattern: nullableText(dto.sleepPattern),
      learningProgress: nullableText(dto.learningProgress),
      planningParticipation: nullableText(dto.planningParticipation),
      interests: nullableText(dto.interests),
      challenges: nullableText(dto.challenges),
      psychologicalNotes: nullableText(dto.psychologicalNotes),
      developmentAlerts: nullableText(dto.developmentAlerts),
      recommendations: nullableText(dto.recommendations),
      nextSteps: nullableText(dto.nextSteps),
      createdBy: user.sub,
    };
  }

  private mapUpdateData(dto: any) {
    const data: any = {};
    const allowedTextFields = [
      'behaviorDescription',
      'socialInteraction',
      'emotionalState',
      'motorSkills',
      'cognitiveSkills',
      'languageSkills',
      'healthNotes',
      'dietaryNotes',
      'sleepPattern',
      'learningProgress',
      'planningParticipation',
      'interests',
      'challenges',
      'psychologicalNotes',
      'developmentAlerts',
      'recommendations',
      'nextSteps',
    ];

    if (dto.category !== undefined) data.category = dto.category ?? 'GERAL';
    if (dto.classroomId !== undefined) data.classroomId = dto.classroomId ?? null;
    if (dto.date !== undefined) data.date = dto.date ? new Date(dto.date) : new Date();

    for (const field of allowedTextFields) {
      if (dto[field] !== undefined) data[field] = nullableText(dto[field]);
    }

    return data;
  }
}
