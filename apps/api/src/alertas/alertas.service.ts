import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SeveridadeAlerta, TipoAlerta } from '@prisma/client';

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(private readonly prisma: PrismaService) {}

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
            metadados: { regra: 'FALTAS_CONSECUTIVAS', maxConsec, totalFaltas: ausencias.length, totalDias },
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
   * Mantido como ponto de extensão, mas sem acesso a modelos inexistentes.
   * O schema atual não possui microgestoRegistro/childProfileStats; portanto
   * esta rotina não executa gravações até existir modelo oficial ou análise via DiaryEvent.
   */
  @Cron('30 6 * * 1-5')
  async analisarMicrogestos() {
    this.logger.log('CronJob microgestos ignorado: schema atual não possui modelo microgestoRegistro.');
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
  }) {
    const regra = String(params.metadados?.regra ?? params.tipo);

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
      await this.prisma.alertaOperacional.update({
        where: { id: existente.id },
        data: {
          unitId: params.unitId,
          classroomId: params.classroomId,
          severidade: params.severidade,
          titulo: params.titulo,
          descricao: params.descricao,
          metadados: params.metadados,
        },
      });
      return;
    }

    await this.prisma.alertaOperacional.create({
      data: {
        childId: params.childId,
        classroomId: params.classroomId,
        unitId: params.unitId,
        mantenedoraId: params.mantenedoraId,
        tipo: params.tipo,
        severidade: params.severidade,
        titulo: params.titulo,
        descricao: params.descricao,
        metadados: params.metadados,
      },
    });
  }
}
