import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceService } from '../evidence/evidence.service';
import { SeveridadeAlerta, TipoAlerta } from '@prisma/client';

export type AlertaCanal = 'OPERACIONAL' | 'ACOMPANHAMENTO';
export type PrioridadeOperacional = 'NORMAL' | 'URGENTE';

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly evidenceService?: EvidenceService,
  ) {}

  /**
   * Roda todo dia às 6h de segunda a sexta — analisa faltas dos últimos 30 dias
   * e gera alertas operacionais por criança.
   *
   * Correção aplicada:
   * - usa modelos existentes no schema.prisma: Attendance e AlertaOperacional;
   * - não usa alertaAluno nem childProfileStats, que não existem no schema atual;
   * - não altera matriz, plano de aula, diário, RDIC ou dados históricos.
   */
  @Cron('0 6 * * 1-5')
  async analisarFaltas() {
    this.logger.log('CronJob: analisando faltas para alertas operacionais...');

    try {
      const matriculas = await this.prisma.enrollment.findMany({
        where: { status: 'ATIVA' },
        include: {
          child: { select: { id: true, firstName: true, lastName: true } },
          classroom: { select: { id: true, unitId: true, unit: { select: { mantenedoraId: true } } } },
        },
      });

      const hoje = new Date();
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(hoje.getDate() - 30);

      for (const matricula of matriculas) {
        const childId = matricula.childId;
        const classroomId = matricula.classroomId;
        const unitId = matricula.classroom.unitId;
        const mantenedoraId = matricula.classroom.unit.mantenedoraId;

        const registros = await this.prisma.attendance.findMany({
          where: {
            childId,
            classroomId,
            date: { gte: trintaDiasAtras, lte: hoje },
          },
          orderBy: { date: 'desc' },
        });

        if (registros.length === 0) continue;

        const ausencias = registros.filter((r) => r.status === 'AUSENTE');
        const presentes = registros.filter((r) => r.status === 'PRESENTE');
        const totalDias = registros.length;
        const taxaFalta = totalDias > 0 ? ausencias.length / totalDias : 0;

        let consecutivas = 0;
        let maxConsec = 0;
        for (const r of registros) {
          if (r.status === 'AUSENTE') {
            consecutivas++;
            if (consecutivas > maxConsec) maxConsec = consecutivas;
          } else {
            consecutivas = 0;
          }
        }

        if (maxConsec >= 3) {
          await this.upsertAlertaOperacional({
            childId,
            classroomId,
            unitId,
            mantenedoraId,
            tipo: TipoAlerta.FALTA_CONSECUTIVA,
            severidade: maxConsec >= 5 ? SeveridadeAlerta.ALTA : SeveridadeAlerta.MEDIA,
            titulo: `${matricula.child.firstName} — ${maxConsec} faltas consecutivas`,
            descricao: `A criança ${matricula.child.firstName} ${matricula.child.lastName} acumulou ${maxConsec} faltas consecutivas. Verificar com a família.`,
            metadados: { regra: 'FALTAS_CONSECUTIVAS', canal: 'OPERACIONAL', prioridadeOperacional: maxConsec >= 5 ? 'URGENTE' : 'NORMAL', maxConsec, totalFaltas: ausencias.length, totalDias },
          });
        }

        if (taxaFalta >= 0.25 && ausencias.length >= 5) {
          await this.upsertAlertaOperacional({
            childId,
            classroomId,
            unitId,
            mantenedoraId,
            tipo: TipoAlerta.OUTRO,
            severidade: taxaFalta >= 0.4 ? SeveridadeAlerta.ALTA : SeveridadeAlerta.MEDIA,
            titulo: `${matricula.child.firstName} — ${Math.round(taxaFalta * 100)}% de ausências`,
            descricao: `${ausencias.length} faltas nos últimos 30 dias (${Math.round(taxaFalta * 100)}%). Risco de evasão.`,
            metadados: {
              regra: 'FALTAS_FREQUENTES',
              canal: 'OPERACIONAL',
              prioridadeOperacional: taxaFalta >= 0.4 ? 'URGENTE' : 'NORMAL',
              taxaFalta,
              ausencias: ausencias.length,
              presentes: presentes.length,
              totalDias,
              ultimaPresenca: presentes[0]?.date ?? null,
            },
          });
        }
      }

      this.logger.log('CronJob faltas concluído.');
    } catch (err) {
      this.logger.error('Erro no CronJob de faltas:', err as any);
    }
  }

  /**
   * No fim do dia, verifica cobertura mínima do diário por turma ativa.
   * A regra é determinística, escopada por unidade e idempotente: ela cria ou
   * atualiza uma pendência operacional, mas nunca altera eventos pedagógicos.
   * A decisão sobre o encaminhamento permanece humana no painel de cuidado.
   */
  @Cron('0 18 * * 1-5')
  async analisarCoberturaDiario() {
    this.logger.log('CronJob: analisando cobertura diária do diário...');

    try {
      const hoje = new Date();
      const inicio = new Date(hoje);
      inicio.setHours(0, 0, 0, 0);
      const fim = new Date(hoje);
      fim.setHours(23, 59, 59, 999);

      const turmas = await this.prisma.classroom.findMany({
        where: {
          isActive: true,
          enrollments: { some: { status: 'ATIVA' } },
        },
        select: {
          id: true,
          name: true,
          unitId: true,
          unit: { select: { mantenedoraId: true } },
          _count: { select: { enrollments: true } },
        },
      });

      for (const turma of turmas) {
        const eventos = await this.prisma.diaryEvent.count({
          where: {
            classroomId: turma.id,
            eventDate: { gte: inicio, lte: fim },
          },
        });

        if (eventos > 0) continue;

        await this.upsertAlertaOperacional({
          childId: '',
          classroomId: turma.id,
          unitId: turma.unitId,
          mantenedoraId: turma.unit.mantenedoraId,
          tipo: TipoAlerta.AUSENCIA_REGISTRO_DIARIO,
          severidade: SeveridadeAlerta.MEDIA,
          titulo: `${turma.name} — diário sem registro hoje`,
          descricao: 'A turma não possui evento de diário registrado na data corrente. Conferir se houve atividade, sincronização offline ou necessidade de registro retroativo.',
          metadados: {
            regra: 'COBERTURA_DIARIO_TURMA',
            canal: 'OPERACIONAL',
            prioridadeOperacional: 'NORMAL',
            data: inicio.toISOString().slice(0, 10),
            alunosAtivos: turma._count.enrollments,
            eventosEncontrados: eventos,
          },
        });
      }

      this.logger.log('CronJob cobertura diária concluído.');
    } catch (err) {
      this.logger.error('Erro no CronJob de cobertura diária:', err as any);
    }
  }

  /**
   * Analisa a coleta estruturada real gravada em DiaryEvent.aiContext.
   * A rotina cria somente sinais de acompanhamento; nunca infere diagnóstico.
   * É idempotente por criança/domínio/regra e mantém a resolução humana no painel.
   */
  @Cron('30 6 * * 1-5')
  async analisarMicrogestos() {
    this.logger.log('CronJob desenvolvimento: analisando observações estruturadas...');

    try {
      const fim = new Date();
      fim.setHours(23, 59, 59, 999);
      const inicio = new Date(fim);
      inicio.setDate(inicio.getDate() - 13);
      inicio.setHours(0, 0, 0, 0);

      const eventos = await this.prisma.diaryEvent.findMany({
        where: {
          eventDate: { gte: inicio, lte: fim },
          aiContext: {
            path: ['structuredObservation', 'source'],
            equals: 'daily-collection',
          },
        },
        select: {
          id: true,
          childId: true,
          classroomId: true,
          eventDate: true,
          aiContext: true,
          child: { select: { id: true, firstName: true, lastName: true } },
          classroom: {
            select: {
              id: true,
              name: true,
              unitId: true,
              unit: { select: { mantenedoraId: true } },
            },
          },
        },
        orderBy: { eventDate: 'desc' },
        take: 10000,
      });

      const grupos = new Map<string, {
        childId: string;
        childName: string;
        classroomId: string;
        classroomName: string;
        unitId: string;
        mantenedoraId: string;
        domain: string;
        negativeCount: number;
        teacherConcerns: number;
        highIntensityCount: number;
        contexts: Set<string>;
        indicators: Set<string>;
        lastObservedAt: Date;
      }>();

      for (const evento of eventos) {
        const context = evento.aiContext && typeof evento.aiContext === 'object'
          ? evento.aiContext as Record<string, any>
          : null;
        const observation = context?.structuredObservation as Record<string, any> | undefined;
        if (!observation || observation.source !== 'daily-collection') continue;
        if (observation.opportunity === 'NAO_HOUVE_OPORTUNIDADE') continue;

        const level = String(observation.level ?? '');
        const teacherConcern = observation.teacherConcern === true;
        const intensity = Number(observation.abc?.intensity ?? 0);
        const negative = level === 'REQUER_ATENCAO' || teacherConcern || intensity >= 4;
        if (!negative) continue;

        const childId = evento.childId ?? '';
        const classroomId = evento.classroomId ?? '';
        const domain = String(observation.domain ?? 'GERAL');
        const key = `${childId}|${classroomId}|${domain}`;
        const current = grupos.get(key) ?? {
          childId,
          childName: evento.child ? `${evento.child.firstName} ${evento.child.lastName}`.trim() : childId,
          classroomId,
          classroomName: evento.classroom?.name ?? classroomId,
          unitId: evento.classroom?.unitId ?? '',
          mantenedoraId: evento.classroom?.unit?.mantenedoraId ?? '',
          domain,
          negativeCount: 0,
          teacherConcerns: 0,
          highIntensityCount: 0,
          contexts: new Set<string>(),
          indicators: new Set<string>(),
          lastObservedAt: new Date(evento.eventDate),
        };

        current.negativeCount += 1;
        if (teacherConcern) current.teacherConcerns += 1;
        if (intensity >= 4) current.highIntensityCount += 1;
        if (observation.context) current.contexts.add(String(observation.context));
        if (observation.indicatorId) current.indicators.add(String(observation.indicatorId));
        if (new Date(evento.eventDate) > current.lastObservedAt) current.lastObservedAt = new Date(evento.eventDate);
        grupos.set(key, current);
      }

      for (const grupo of grupos.values()) {
        const pattern = grupo.negativeCount >= 3;
        const concernSignal = grupo.teacherConcerns > 0;
        if (!pattern && !concernSignal) continue;

        const severidade = grupo.highIntensityCount >= 2 || grupo.negativeCount >= 5
          ? SeveridadeAlerta.ALTA
          : pattern
            ? SeveridadeAlerta.MEDIA
            : SeveridadeAlerta.BAIXA;
        const regra = `DESENVOLVIMENTO_ESTRUTURADO_${grupo.domain}`;

        await this.upsertAlertaOperacional({
          childId: grupo.childId,
          classroomId: grupo.classroomId,
          unitId: grupo.unitId,
          mantenedoraId: grupo.mantenedoraId,
          tipo: TipoAlerta.OUTRO,
          severidade,
          titulo: `${grupo.childName} — padrão de acompanhamento em ${grupo.domain}`,
          descricao: `Foram registradas ${grupo.negativeCount} observações de acompanhamento em ${grupo.contexts.size || 1} contexto(s) nos últimos 14 dias. Revisar as evidências, os suportes oferecidos e a necessidade de acompanhamento. Este sinal não é diagnóstico.`,
          metadados: {
            regra,
            canal: 'ACOMPANHAMENTO',
            prioridadeOperacional: 'NORMAL',
            origem: 'coleta-estruturada',
            janelaDias: 14,
            observacoesAtencao: grupo.negativeCount,
            preocupacoesProfessor: grupo.teacherConcerns,
            observacoesAltaIntensidade: grupo.highIntensityCount,
            contextos: Array.from(grupo.contexts),
            indicadores: Array.from(grupo.indicators),
            ultimaObservacao: grupo.lastObservedAt.toISOString(),
            acaoSugerida: pattern ? 'REVISAO_COORDENACAO' : 'NOVA_OBSERVACAO',
          },
        });
      }

      this.logger.log(`CronJob desenvolvimento concluído: ${grupos.size} grupo(s) com sinais avaliados.`);
    } catch (err) {
      this.logger.error('Erro no CronJob de desenvolvimento:', err as any);
    }
  }

  private async upsertAlertaOperacional(params: {
    childId: string;
    classroomId: string;
    unitId: string;
    mantenedoraId: string;
    tipo: TipoAlerta;
    severidade: SeveridadeAlerta;
    titulo: string;
    descricao: string;
    metadados: Record<string, any>;
    canal?: AlertaCanal;
    prioridadeOperacional?: PrioridadeOperacional;
  }) {
    const regra = String(params.metadados?.regra ?? params.tipo);
    const canal: AlertaCanal = params.canal ?? params.metadados?.canal ?? 'OPERACIONAL';
    const prioridadeOperacional: PrioridadeOperacional = params.prioridadeOperacional ?? params.metadados?.prioridadeOperacional ?? 'NORMAL';
    const metadados = { ...params.metadados, canal, prioridadeOperacional };

    const existente = await this.prisma.alertaOperacional.findFirst({
      where: {
        childId: params.childId,
        tipo: params.tipo,
        resolvido: false,
        metadados: {
          path: ['regra'],
          equals: regra,
        },
      },
    });

    if (existente) {
      const updated = await this.prisma.alertaOperacional.update({
        where: { id: existente.id },
        data: {
          unitId: params.unitId,
          classroomId: params.classroomId,
          severidade: params.severidade,
          titulo: params.titulo,
          descricao: params.descricao,
          metadados,
        },
      });
      await this.evidenceService?.syncSafely('ALERTA_OPERACIONAL', () => this.evidenceService!.syncOperationalAlert(updated));
      return updated;
    }

    const created = await this.prisma.alertaOperacional.create({
      data: {
        childId: params.childId,
        classroomId: params.classroomId,
        unitId: params.unitId,
        mantenedoraId: params.mantenedoraId,
        tipo: params.tipo,
        severidade: params.severidade,
        titulo: params.titulo,
        descricao: params.descricao,
        metadados,
      },
    });
    await this.evidenceService?.syncSafely('ALERTA_OPERACIONAL', () => this.evidenceService!.syncOperationalAlert(created));
    return created;
  }
}
