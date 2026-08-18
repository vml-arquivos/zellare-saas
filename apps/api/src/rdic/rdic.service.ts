import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiaryEventStatus } from '@prisma/client';
import { MICROGESTO_CATALOGO } from '../common/constants/microgestos.constants';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * Fluxo de aprovação do RDIC (P0):
 *
 *  PROFESSOR          → cria/edita em RASCUNHO ou DEVOLVIDO
 *                     → envia para revisão (→ EM_REVISAO)
 *
 *  COORD. UNIDADE     → lê, edita (RASCUNHO ou EM_REVISAO), salva
 *  (UNIDADE)          → aprova (→ APROVADO)
 *                     → devolve com comentário obrigatório (→ DEVOLVIDO)
 *
 *  STAFF_CENTRAL      → somente leitura (apenas APROVADO/PUBLICADO)
 *                     → 403 para editar/aprovar/devolver
 *
 *  MANTENEDORA/DEV    → leitura completa (sem ações de aprovação)
 */
@Injectable()
export class RdicService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Criar RDIC (professor) ───────────────────────────────────────────────
  async criar(dto: any, user: JwtPayload) {
    if (!user?.mantenedoraId || !user?.unitId) {
      throw new ForbiddenException('Escopo inválido');
    }
    const { childId, classroomId, periodo, anoLetivo, rascunhoJson } = dto;
    if (!childId || !classroomId || !periodo || !anoLetivo) {
      throw new BadRequestException('childId, classroomId, periodo e anoLetivo são obrigatórios');
    }

    // Verificar se a turma pertence à unidade do professor
    const classroom = await this.prisma.classroom.findFirst({
      where: { id: classroomId, unitId: user.unitId },
    });
    if (!classroom) throw new NotFoundException('Turma não encontrada ou fora do escopo');

    // Buscar ou criar template padrão para a mantenedora
    let template = await this.prisma.rDIXTemplate.findFirst({
      where: { mantenedoraId: user.mantenedoraId, ativo: true },
    });
    if (!template) {
      template = await this.prisma.rDIXTemplate.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          segmento: 'EDUCACAO_INFANTIL',
          titulo: 'RDIC — Relatório de Desenvolvimento Individual da Criança',
          estruturaJson: {},
          criadoPorId: user.sub,
        },
      });
    }

    // Verificar se já existe instância para este período
    const existente = await this.prisma.rDIXInstancia.findFirst({
      where: { childId, classroomId, periodo, anoLetivo },
    });
    if (existente) {
      throw new BadRequestException(
        `Já existe um RDIC para esta criança no período ${periodo}/${anoLetivo}. Use o endpoint de atualização.`,
      );
    }

    const periodoEnumMap: Record<string, string> = {
      'PRIMEIRO_TRIMESTRE': 'PRIMEIRO_TRIMESTRE',
      'SEGUNDO_TRIMESTRE':  'SEGUNDO_TRIMESTRE',
      'TERCEIRO_TRIMESTRE': 'TERCEIRO_TRIMESTRE',
      'PRIMEIRO_BIMESTRE':  'PRIMEIRO_BIMESTRE',
      'SEGUNDO_BIMESTRE':   'SEGUNDO_BIMESTRE',
      'TERCEIRO_BIMESTRE':  'TERCEIRO_BIMESTRE',
      'QUARTO_BIMESTRE':    'QUARTO_BIMESTRE',
    };
    const periodoEnumResolvido = dto.periodoEnum
      ? (periodoEnumMap[dto.periodoEnum] ?? null)
      : null;

    return this.prisma.rDIXInstancia.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId:        user.unitId,
        templateId:    template.id,
        childId,
        classroomId,
        periodo,
        periodoEnum:   periodoEnumResolvido as any ?? undefined,
        anoLetivo:     Number(anoLetivo),
        status:        'RASCUNHO',
        rascunhoJson:  rascunhoJson ?? {},
        criadoPorId:   user.sub,
      },
      include: { child: { select: { firstName: true, lastName: true } } },
    });
  }

  // ─── Atualizar rascunho ───────────────────────────────────────────────────
  async atualizar(id: string, dto: any, user: JwtPayload) {
    const level = user.roles?.find(r =>
      ['DEVELOPER','MANTENEDORA','STAFF_CENTRAL','UNIDADE','PROFESSOR']
      .includes(r.level)
    )?.level ?? user.roles[0]?.level;

    // STAFF_CENTRAL: nunca pode editar
    if (level === 'STAFF_CENTRAL') {
      throw new ForbiddenException('Central pedagógica não pode editar RDICs.');
    }

    const instancia = await this._buscarEValidar(id, user);

    // Professor só pode editar RASCUNHO ou DEVOLVIDO (e apenas o próprio)
    if (level === 'PROFESSOR') {
      if (!['RASCUNHO', 'DEVOLVIDO'].includes(instancia.status)) {
        throw new ForbiddenException(
          'Você só pode editar o RDIC enquanto estiver em RASCUNHO ou DEVOLVIDO.',
        );
      }
      if (instancia.criadoPorId !== user.sub) {
        throw new ForbiddenException('Você só pode editar seus próprios RDICs.');
      }
    }

    // Coordenadora pedagógica pode editar RASCUNHO ou EM_REVISAO
    if (level === 'UNIDADE') {
      if (!['RASCUNHO', 'EM_REVISAO', 'DEVOLVIDO'].includes(instancia.status)) {
        throw new ForbiddenException('RDIC já aprovado ou publicado. Não é possível editar.');
      }
    }

    return this.prisma.rDIXInstancia.update({
      where: { id },
      data: { rascunhoJson: dto.rascunhoJson ?? instancia.rascunhoJson },
      include: { child: { select: { firstName: true, lastName: true } } },
    });
  }

  // ─── Enviar para revisão (professor → EM_REVISAO) ─────────────────────────
  async enviarParaRevisao(id: string, user: JwtPayload) {
    const instancia = await this._buscarEValidar(id, user);
    if (!['RASCUNHO', 'DEVOLVIDO'].includes(instancia.status)) {
      throw new BadRequestException('Apenas RDICs em RASCUNHO ou DEVOLVIDO podem ser enviados para revisão.');
    }
    if (instancia.criadoPorId !== user.sub) {
      throw new ForbiddenException('Apenas o professor que criou o RDIC pode enviá-lo para revisão.');
    }
    return this.prisma.rDIXInstancia.update({
      where: { id },
      data: {
        status: 'EM_REVISAO',
        submittedAt: new Date(),
      },
    });
  }

  // ─── Aprovar (coord. unidade → APROVADO) ─────────────────────────────────
  async aprovar(id: string, user: JwtPayload) {
    if (!user.roles?.some(r => r.level === 'UNIDADE')) {
      throw new ForbiddenException('Apenas a coordenação pedagógica da unidade pode aprovar o RDIC.');
    }
    const instancia = await this._buscarEValidar(id, user);
    if (!['EM_REVISAO', 'RASCUNHO'].includes(instancia.status)) {
      throw new BadRequestException('Apenas RDICs em EM_REVISAO ou RASCUNHO podem ser aprovados.');
    }
    return this.prisma.rDIXInstancia.update({
      where: { id },
      data: {
        status: 'APROVADO',
        conteudoFinal: instancia.conteudoFinal ?? instancia.rascunhoJson ?? undefined,
        revisadoPorId: user.sub,
        reviewedAt: new Date(),
      },
      include: { child: { select: { firstName: true, lastName: true } } },
    });
  }

  // ─── Devolver ao professor (coord. unidade → DEVOLVIDO) ───────────────────
  async devolver(id: string, dto: { comment: string }, user: JwtPayload) {
    if (!user.roles?.some(r => r.level === 'UNIDADE')) {
      throw new ForbiddenException('Apenas a coordenação pedagógica pode devolver o RDIC.');
    }
    if (!dto.comment || dto.comment.trim().length < 5) {
      throw new BadRequestException('O comentário de devolução é obrigatório (mínimo 5 caracteres).');
    }
    const instancia = await this._buscarEValidar(id, user);
    if (instancia.status !== 'EM_REVISAO') {
      throw new BadRequestException('Apenas RDICs em EM_REVISAO podem ser devolvidos.');
    }
    return this.prisma.rDIXInstancia.update({
      where: { id },
      data: {
        status: 'DEVOLVIDO',
        reviewComment: dto.comment,
        revisadoPorId: user.sub,
        reviewedAt: new Date(),
      },
    });
  }

  // ─── Finalizar/Aprovar legado (coord. pedagógica unidade → FINALIZADO) ────
  // Mantido para compatibilidade; novos clientes devem usar /aprovar
  async finalizar(id: string, dto: any, user: JwtPayload) {
    if (!user.roles?.some(r => r.level === 'UNIDADE')) {
      throw new ForbiddenException('Apenas a coordenação pedagógica da unidade pode finalizar o RDIC.');
    }
    const instancia = await this._buscarEValidar(id, user);
    if (!['EM_REVISAO', 'RASCUNHO'].includes(instancia.status)) {
      throw new BadRequestException('RDIC já finalizado ou publicado.');
    }
    return this.prisma.rDIXInstancia.update({
      where: { id },
      data: {
        status: 'FINALIZADO',
        conteudoFinal: dto.conteudoFinal ?? instancia.rascunhoJson,
        revisadoPorId: user.sub,
        finalizadoEm: new Date(),
        reviewedAt: new Date(),
      },
      include: { child: { select: { firstName: true, lastName: true } } },
    });
  }

  // ─── Publicar (coord. pedagógica unidade → PUBLICADO) ────────────────────
  async publicar(id: string, user: JwtPayload) {
    if (!user.roles?.some(r => r.level === 'UNIDADE')) {
      throw new ForbiddenException('Apenas a coordenação pedagógica da unidade pode publicar o RDIC.');
    }
    const instancia = await this._buscarEValidar(id, user);
    if (!['FINALIZADO', 'APROVADO'].includes(instancia.status)) {
      throw new BadRequestException('Apenas RDICs FINALIZADOS ou APROVADOS podem ser publicados.');
    }
    return this.prisma.rDIXInstancia.update({
      where: { id },
      data: {
        status: 'PUBLICADO',
        publicadoEm: new Date(),
      },
    });
  }

  // ─── Status de completude da turma por bimestre ───────────────────────────
  // GET /rdic/turma/status?classroomId&periodo&anoLetivo
  async turmaStatus(query: any, user: JwtPayload) {
    const level = user.roles?.find(r =>
      ['DEVELOPER','MANTENEDORA','STAFF_CENTRAL','UNIDADE','PROFESSOR']
      .includes(r.level)
    )?.level ?? user.roles[0]?.level;
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');

    const { classroomId, periodo, anoLetivo } = query;
    if (!classroomId || !periodo || !anoLetivo) {
      throw new BadRequestException('classroomId, periodo e anoLetivo são obrigatórios');
    }

    // Verificar escopo
    const classroom = await this.prisma.classroom.findFirst({
      where: {
        id: classroomId,
        unit: { mantenedoraId: user.mantenedoraId },
        ...(level === 'PROFESSOR' || level === 'UNIDADE' ? { unitId: user.unitId! } : {}),
      },
    });
    if (!classroom) throw new NotFoundException('Turma não encontrada ou fora do escopo');

    // Buscar crianças com matrícula ativa na turma
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classroomId, status: 'ATIVA' },
      include: { child: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Buscar RDICs existentes para essa turma/período/ano
    const rdics = await this.prisma.rDIXInstancia.findMany({
      where: {
        classroomId,
        periodo,
        anoLetivo: Number(anoLetivo),
        mantenedoraId: user.mantenedoraId,
      },
      select: {
        id: true,
        childId: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
      },
    });

    const rdicByChild = new Map(rdics.map(r => [r.childId, r]));
    const totalCriancas = enrollments.length;
    const criancas = enrollments.map(({ child }) => ({
      childId: child.id,
      nome: `${child.firstName} ${child.lastName}`,
      rdic: rdicByChild.get(child.id) ?? null,
      status: rdicByChild.get(child.id)?.status ?? 'PENDENTE',
    }));

    const contagem = {
      total: totalCriancas,
      pendente: criancas.filter(c => c.status === 'PENDENTE').length,
      rascunho: criancas.filter(c => c.status === 'RASCUNHO').length,
      emRevisao: criancas.filter(c => c.status === 'EM_REVISAO').length,
      devolvido: criancas.filter(c => c.status === 'DEVOLVIDO').length,
      aprovado: criancas.filter(c => c.status === 'APROVADO').length,
      finalizado: criancas.filter(c => ['FINALIZADO', 'PUBLICADO'].includes(c.status)).length,
    };

    return {
      classroomId,
      classroomName: classroom.name,
      periodo,
      anoLetivo: Number(anoLetivo),
      completude: totalCriancas > 0
        ? Math.round(((contagem.aprovado + contagem.finalizado) / totalCriancas) * 100)
        : 0,
      contagem,
      criancas,
    };
  }

  // ─── Resumo express da turma por marcações reais ───────────────────────────
  async turmaResumoExpress(query: any, user: JwtPayload) {
    const level = user.roles?.find(r =>
      ['DEVELOPER', 'MANTENEDORA', 'STAFF_CENTRAL', 'UNIDADE', 'PROFESSOR']
        .includes(r.level)
    )?.level ?? user.roles[0]?.level;
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');

    const classroomId = query?.classroomId;
    if (!classroomId) throw new BadRequestException('classroomId é obrigatório');

    const classroom = await this.prisma.classroom.findFirst({
      where: {
        id: classroomId,
        unit: { mantenedoraId: user.mantenedoraId },
        ...(level === 'PROFESSOR' || level === 'UNIDADE' ? { unitId: user.unitId! } : {}),
      },
      select: { id: true, name: true, unitId: true },
    });
    if (!classroom) throw new NotFoundException('Turma não encontrada ou fora do escopo');
    if (level === 'PROFESSOR') {
      const vínculo = await this.prisma.classroomTeacher.findFirst({
        where: { teacherId: user.sub, classroomId, isActive: true },
        select: { classroomId: true },
      });
      if (!vínculo) throw new ForbiddenException('Você não está vinculado a esta turma.');
    }

    const endDate = query?.endDate ? new Date(query.endDate) : new Date();
    const startDate = query?.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw new BadRequestException('Período inválido para o resumo da turma');
    }
    if (endDate.getTime() - startDate.getTime() > 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('O período máximo do resumo é de 366 dias');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classroomId, status: 'ATIVA' },
      select: { child: { select: { id: true, firstName: true, lastName: true } } },
    });
    const children = enrollments.map(({ child }) => ({
      childId: child.id,
      nome: `${child.firstName} ${child.lastName}`.trim(),
    }));
    const childIds = children.map((child) => child.childId);
    if (childIds.length === 0) {
      return {
        classroom: { id: classroom.id, name: classroom.name },
        periodo: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        totalCriancas: 0,
        cobertura: { comRegistros: 0, semRegistros: 0, percentual: 0 },
        totalDiarios: 0,
        totalObservacoes: 0,
        totalMicrogestos: 0,
        totalPontosAtencao: 0,
        criancas: [],
      };
    }

    const [events, observations] = await Promise.all([
      this.prisma.diaryEvent.findMany({
        where: {
          classroomId,
          childId: { in: childIds },
          mantenedoraId: user.mantenedoraId,
          eventDate: { gte: startDate, lte: endDate },
          status: { in: [DiaryEventStatus.PUBLICADO, DiaryEventStatus.REVISADO, DiaryEventStatus.ARQUIVADO] },
        },
        select: { childId: true, eventDate: true, aiContext: true },
      }),
      this.prisma.developmentObservation.findMany({
        where: { classroomId, childId: { in: childIds }, date: { gte: startDate, lte: endDate } },
        select: { childId: true, developmentAlerts: true },
      }),
    ]);

    type Row = {
      childId: string;
      nome: string;
      diarios: number;
      observacoes: number;
      microgestos: number;
      dias: Set<string>;
      porNivel: Record<string, number>;
      atencao: number;
    };
    const rows = new Map<string, Row>(children.map((child) => [child.childId, {
      ...child,
      diarios: 0,
      observacoes: 0,
      microgestos: 0,
      dias: new Set<string>(),
      porNivel: {},
      atencao: 0,
    }]));

    for (const event of events) {
      const row = rows.get(event.childId);
      if (!row) continue;
      row.diarios += 1;
      row.dias.add(new Date(event.eventDate).toISOString().slice(0, 10));
      const context = event.aiContext && typeof event.aiContext === 'object' ? event.aiContext as Record<string, unknown> : {};
      const microgestos = Array.isArray(context.microgestos) ? context.microgestos : [];
      for (const raw of microgestos) {
        if (!raw || typeof raw !== 'object') continue;
        const nivel = String((raw as Record<string, unknown>).nivel ?? '').trim();
        if (!nivel) continue;
        row.microgestos += 1;
        row.porNivel[nivel] = (row.porNivel[nivel] ?? 0) + 1;
        if (nivel === 'REQUER_ATENCAO') row.atencao += 1;
      }
    }
    for (const observation of observations) {
      const row = rows.get(observation.childId);
      if (!row) continue;
      row.observacoes += 1;
      if (observation.developmentAlerts) row.atencao += 1;
    }

    const criancas = Array.from(rows.values()).map((row) => {
      const totalRegistros = row.diarios + row.observacoes;
      const tendencia = totalRegistros === 0
        ? 'SEM_DADOS'
        : row.atencao > 0
          ? 'ATENCAO'
          : (row.porNivel.ALCANCADO ?? 0) + (row.porNivel.CONSOLIDADO ?? 0) >= Math.max(1, row.microgestos / 2)
            ? 'FAVORAVEL'
            : 'EM_DESENVOLVIMENTO';
      return {
        childId: row.childId,
        nome: row.nome,
        diarios: row.diarios,
        observacoes: row.observacoes,
        microgestos: row.microgestos,
        diasComRegistro: row.dias.size,
        porNivel: row.porNivel,
        pontosAtencao: row.atencao,
        tendencia,
      };
    }).sort((a, b) => b.microgestos - a.microgestos || a.nome.localeCompare(b.nome));

    const comRegistros = criancas.filter((child) => child.diarios + child.observacoes > 0).length;
    return {
      classroom: { id: classroom.id, name: classroom.name },
      periodo: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      totalCriancas: criancas.length,
      cobertura: {
        comRegistros,
        semRegistros: criancas.length - comRegistros,
        percentual: Math.round((comRegistros / criancas.length) * 100),
      },
      totalDiarios: events.length,
      totalObservacoes: observations.length,
      totalMicrogestos: criancas.reduce((sum, child) => sum + child.microgestos, 0),
      totalPontosAtencao: criancas.reduce((sum, child) => sum + child.pontosAtencao, 0),
      criancas,
    };
  }

  // ─── Consolidado da turma (dados para relatório) ──────────────────────────
  // GET /rdic/turma/consolidado?classroomId&periodo&anoLetivo
  async turmaConsolidado(query: any, user: JwtPayload) {
    const level = user.roles?.find(r =>
      ['DEVELOPER','MANTENEDORA','STAFF_CENTRAL','UNIDADE','PROFESSOR']
      .includes(r.level)
    )?.level ?? user.roles[0]?.level;
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');

    const { classroomId, periodo, anoLetivo } = query;
    if (!classroomId || !periodo || !anoLetivo) {
      throw new BadRequestException('classroomId, periodo e anoLetivo são obrigatórios');
    }

    // STAFF_CENTRAL só vê APROVADO/PUBLICADO
    const statusFilter: any =
      level === 'STAFF_CENTRAL'
        ? { status: { in: ['APROVADO', 'PUBLICADO', 'FINALIZADO'] as any } }
        : {};

    const rdics = await this.prisma.rDIXInstancia.findMany({
      where: {
        classroomId,
        periodo,
        anoLetivo: Number(anoLetivo),
        mantenedoraId: user.mantenedoraId,
        ...statusFilter,
      },
      include: {
        child: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });

    return {
      classroomId,
      periodo,
      anoLetivo: Number(anoLetivo),
      total: rdics.length,
      rdics: rdics.map(r => ({
        id: r.id,
        childId: r.childId,
        childNome: `${r.child.firstName} ${r.child.lastName}`,
        status: r.status,
        submittedAt: r.submittedAt,
        reviewedAt: r.reviewedAt,
        reviewComment: r.reviewComment,
        conteudo: r.conteudoFinal ?? r.rascunhoJson,
      })),
    };
  }

  // ─── Listar RDICs com controle de acesso por role ─────────────────────────
  async listar(query: any, user: JwtPayload) {
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');
    const level = user.roles?.find(r =>
      ['DEVELOPER','MANTENEDORA','STAFF_CENTRAL','UNIDADE','PROFESSOR']
      .includes(r.level)
    )?.level ?? user.roles[0]?.level;
    const where: any = { mantenedoraId: user.mantenedoraId };

    // PROFESSOR: vê apenas os RDICs que ele criou (qualquer status)
    if (level === 'PROFESSOR') {
      where.criadoPorId = user.sub;
      where.unitId = user.unitId;
    }
    // UNIDADE (coord. pedagógica): vê todos da sua unidade
    else if (level === 'UNIDADE') {
      where.unitId = user.unitId;
      // Exige pelo menos um filtro granular para evitar carga de toda a unidade
      if (!query.classroomId && !query.childId) {
        throw new BadRequestException(
          'Para a coordenação de unidade, é obrigatório filtrar por classroomId ou childId.',
        );
      }
    }
    // STAFF_CENTRAL: somente APROVADO/PUBLICADO/FINALIZADO
    else if (level === 'STAFF_CENTRAL') {
      where.status = { in: ['APROVADO', 'PUBLICADO', 'FINALIZADO'] as any };
    }
    // MANTENEDORA / DEVELOPER: vê tudo (sem filtro adicional)

    // Filtros opcionais da query
    if (query.classroomId) where.classroomId = query.classroomId;
    if (query.childId) where.childId = query.childId;
    if (query.status) where.status = query.status;
    if (query.periodo) where.periodo = query.periodo;
    if (query.anoLetivo) where.anoLetivo = Number(query.anoLetivo);
    if (query.unitId && (level === 'MANTENEDORA' || level === 'DEVELOPER' || level === 'STAFF_CENTRAL')) {
      where.unitId = query.unitId;
    }

    return this.prisma.rDIXInstancia.findMany({
      where,
      include: {
        child: { select: { firstName: true, lastName: true, dateOfBirth: true } },
      },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
  }

  // ─── Detalhe de um RDIC ───────────────────────────────────────────────────
  async getById(id: string, user: JwtPayload) {
    const instancia = await this._buscarEValidar(id, user);
    const level = user.roles?.find(r =>
      ['DEVELOPER','MANTENEDORA','STAFF_CENTRAL','UNIDADE','PROFESSOR']
      .includes(r.level)
    )?.level ?? user.roles[0]?.level;
    // STAFF_CENTRAL só pode ler APROVADO/PUBLICADO/FINALIZADO
    if (level === 'STAFF_CENTRAL' && !['APROVADO', 'PUBLICADO', 'FINALIZADO'].includes(instancia.status)) {
      throw new ForbiddenException(
        'Este RDIC ainda não foi aprovado pela coordenação pedagógica da unidade.',
      );
    }

    return instancia;
  }

  // ─── Central da Criança ─────────────────────────────────────────────────
  /**
   * Diagnóstico operacional rápido para o professor/coordenação.
   * Usa somente eventos publicados/revisados do diário e observações reais,
   * sem inferência clínica e sem criar uma segunda fonte de dados.
   */
  async resumoExpress(childId: string, query: any, user: JwtPayload) {
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');

    const child = await this.prisma.child.findFirst({
      where: { id: childId, mantenedoraId: user.mantenedoraId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        enrollments: {
          where: { status: 'ATIVA' },
          select: { classroom: { select: { id: true, name: true, unitId: true } } },
          take: 1,
        },
      },
    });
    if (!child) throw new NotFoundException('Criança não encontrada ou fora do escopo');

    const level = user.roles?.[0]?.level;
    const classroom = child.enrollments?.[0]?.classroom;
    if (level === 'UNIDADE' && user.unitId && classroom && classroom.unitId !== user.unitId) {
      throw new ForbiddenException('Criança fora da unidade autorizada');
    }
    if (level === 'PROFESSOR') {
      if (!classroom) throw new ForbiddenException('Criança sem turma ativa');
      const vínculo = await this.prisma.classroomTeacher.findFirst({
        where: { teacherId: user.sub, classroomId: classroom.id, isActive: true },
        select: { classroomId: true },
      });
      if (!vínculo) throw new ForbiddenException('Você não está vinculado à turma desta criança.');
    }

    const endDate = query?.endDate ? new Date(query.endDate) : new Date();
    const startDate = query?.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw new BadRequestException('Período inválido para o diagnóstico express');
    }
    const maxEnd = new Date(startDate.getTime() + 366 * 24 * 60 * 60 * 1000);
    if (endDate > maxEnd) throw new BadRequestException('O período máximo do diagnóstico é de 366 dias');

    const [diaryEvents, observations] = await Promise.all([
      this.prisma.diaryEvent.findMany({
        where: {
          childId,
          mantenedoraId: user.mantenedoraId,
          eventDate: { gte: startDate, lte: endDate },
          status: { in: [DiaryEventStatus.PUBLICADO, DiaryEventStatus.REVISADO, DiaryEventStatus.ARQUIVADO] },
        },
        select: { eventDate: true, aiContext: true },
        orderBy: { eventDate: 'asc' },
      }),
      this.prisma.developmentObservation.findMany({
        where: { childId, date: { gte: startDate, lte: endDate } },
        select: { date: true, category: true, developmentAlerts: true, recommendations: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    const porNivel: Record<string, number> = {};
    const porCategoria: Record<string, number> = {};
    const habilidades = new Map<string, { microgestoId: string; label: string; categoria: string; nivel: string; ocorrencias: number }>();
    const dias = new Set<string>();
    let totalMicrogestos = 0;

    for (const event of diaryEvents) {
      dias.add(new Date(event.eventDate).toISOString().slice(0, 10));
      const context = event.aiContext && typeof event.aiContext === 'object' ? event.aiContext as Record<string, unknown> : {};
      const microgestos = Array.isArray(context.microgestos) ? context.microgestos : [];
      for (const raw of microgestos) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;
        const microgestoId = String(item.microgestoId ?? item.id ?? '').trim();
        const nivel = String(item.nivel ?? '').trim();
        if (!microgestoId || !nivel) continue;
        const catalog = MICROGESTO_CATALOGO.find((entry) => entry.id === microgestoId);
        const categoria = String(item.categoria ?? catalog?.categoria ?? 'OUTRO');
        const label = String(item.label ?? catalog?.label ?? microgestoId);
        const key = `${microgestoId}:${nivel}`;
        const current = habilidades.get(key);
        habilidades.set(key, {
          microgestoId,
          label,
          categoria,
          nivel,
          ocorrencias: (current?.ocorrencias ?? 0) + 1,
        });
        porNivel[nivel] = (porNivel[nivel] ?? 0) + 1;
        porCategoria[categoria] = (porCategoria[categoria] ?? 0) + 1;
        totalMicrogestos += 1;
      }
    }

    const observacoesComAlerta = observations.filter((item) => Boolean(item.developmentAlerts)).length;
    const totalAtencao = porNivel.REQUER_ATENCAO ?? 0;
    const tendencia = totalMicrogestos === 0 && observations.length === 0
      ? 'SEM_DADOS'
      : totalAtencao > 0 || observacoesComAlerta > 0
        ? 'ATENCAO'
        : (porNivel.ALCANCADO ?? 0) + (porNivel.CONSOLIDADO ?? 0) >= Math.max(1, totalMicrogestos / 2)
          ? 'FAVORAVEL'
          : 'EM_DESENVOLVIMENTO';

    const pontosAtencao = Array.from(habilidades.values())
      .filter((item) => item.nivel === 'REQUER_ATENCAO')
      .sort((a, b) => b.ocorrencias - a.ocorrencias)
      .slice(0, 5)
      .map((item) => `${item.label} (${item.ocorrencias} registro${item.ocorrencias === 1 ? '' : 's'})`);
    if (observacoesComAlerta > 0) pontosAtencao.push(`${observacoesComAlerta} observação(ões) com alerta de desenvolvimento`);

    const proximosPassos = pontosAtencao.length > 0
      ? pontosAtencao.slice(0, 3).map((item) => `Acompanhar ${item.toLowerCase()} nas próximas vivências e registrar a resposta da criança.`)
      : totalMicrogestos > 0
        ? ['Continuar a coleta estruturada nas vivências do cotidiano e comparar a evolução no próximo período.']
        : ['Registrar pelo menos uma observação estruturada para iniciar a série de evolução.'];

    return {
      child: { id: child.id, firstName: child.firstName, lastName: child.lastName },
      classroom: classroom ?? null,
      periodo: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      fontes: {
        diariosPublicados: diaryEvents.length,
        observacoesDesenvolvimento: observations.length,
        diasComRegistro: dias.size,
        microgestos: totalMicrogestos,
      },
      porNivel,
      porCategoria,
      habilidades: Array.from(habilidades.values()).sort((a, b) => b.ocorrencias - a.ocorrencias),
      tendencia,
      pontosAtencao,
      proximosPassos,
    };
  }

  async centralDaCrianca(childId: string, user: JwtPayload) {
    if (!user?.mantenedoraId) throw new ForbiddenException('Escopo inválido');
    const level = user.roles?.[0]?.level;

    // 1. Dados da criança com restrições alimentares
    const child = await this.prisma.child.findFirst({
      where: { id: childId, mantenedoraId: user.mantenedoraId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        photoUrl: true,
        allergies: true,
        medicalConditions: true,
        medicationNeeds: true,
        enrollments: {
          where: { status: 'ATIVA' },
          select: {
            classroom: { select: { id: true, name: true } },

          },
          take: 1,
        },
        dietaryRestrictions: {
          where: { isActive: true },
          select: {
            id: true,
            type: true,
            name: true,
            severity: true,
            forbiddenFoods: true,
          },
        },
      },
    });

    if (!child) {
      throw new NotFoundException('Criança não encontrada ou fora do escopo');
    }

    // 2. PROFESSOR: verificar vínculo com a turma da criança
    if (level === 'PROFESSOR') {
      const enrollment = child.enrollments?.[0];
      if (!enrollment) {
        throw new ForbiddenException('Criança sem turma activa');
      }
      const ct = await this.prisma.classroomTeacher.findFirst({
        where: {
          teacherId: user.sub,
          classroomId: enrollment.classroom.id,
          isActive: true,
        },
      });
      if (!ct) {
        throw new ForbiddenException(
          'Você não está vinculado à turma desta criança.',
        );
      }
    }

    // 3. Acompanhamento nutricional — query separada e defensiva
    let acompanhamentoNutricional: any = null;
    try {
      acompanhamentoNutricional = await (this.prisma as any)
        .acompanhamentoNutricional.findUnique({
          where: { childId },
          select: {
            statusCaso: true,
            orientacoesProfCozinha: true,
            restricoesOperacionais: true,
            substituicoesSeguras: true,
            proximaReavaliacao: true,
          },
        });
    } catch {
      // Silencioso — acompanhamento é opcional, nunca deve quebrar o endpoint
    }

    // 4. Todos os RDICs da criança (mais recente primeiro)
    const rdics = await this.prisma.rDIXInstancia.findMany({
      where: { childId, mantenedoraId: user.mantenedoraId },
      select: {
        id: true,
        periodo: true,
        periodoEnum: true,
        anoLetivo: true,
        status: true,
        rascunhoJson: true,
        reviewComment: true,
        submittedAt: true,
        reviewedAt: true,
        finalizadoEm: true,
        publicadoEm: true,
        criadoEm: true,
        atualizadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
    });

    // 5. Contar eventos do diário nos últimos 90 dias
    let totalDiario90dias = 0;
    try {
      const noventa = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      totalDiario90dias = await this.prisma.diaryEvent.count({
        where: {
          childId,
          mantenedoraId: user.mantenedoraId,
          createdAt: { gte: noventa },
        },
      });
    } catch {
      // Silencioso — contagem é informativa, não deve quebrar o endpoint
    }

    return {
      child: {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth
          ? (child.dateOfBirth as Date).toISOString()
          : null,
        gender: child.gender ? String(child.gender) : null,
        photoUrl: child.photoUrl ?? null,
        allergies: child.allergies ?? null,
        medicalConditions: child.medicalConditions ?? null,
        medicationNeeds: child.medicationNeeds ?? null,
        turma: child.enrollments?.[0]?.classroom ?? null,
        restricoesAlimentares: child.dietaryRestrictions ?? [],
        acompanhamentoNutricional,
      },
      rdics,
      rdicAtual: rdics[0] ?? null,
      totalDiario90dias,
    };
  }

  // ─── Helper interno ───────────────────────────────────────────────────────
  private async _buscarEValidar(id: string, user: JwtPayload) {
    const instancia = await this.prisma.rDIXInstancia.findUnique({
      where: { id },
      include: { child: { select: { firstName: true, lastName: true } } },
    });
    if (!instancia) throw new NotFoundException('RDIC não encontrado');
    if (instancia.mantenedoraId !== user.mantenedoraId) {
      throw new ForbiddenException('Fora do escopo');
    }
    return instancia;
  }
}
