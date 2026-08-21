/**
 * alertas.controller.ts
 * Tarefa 2.4 — Expõe os alertas operacionais gerados pelo cron job via REST.
 *
 * GET /alertas
 *   - unitId (opcional): filtra por unidade
 *   - classroomId (opcional): filtra por turma
 *   - unread (opcional, boolean): se true, retorna apenas não resolvidos
 *   - limit (opcional, default 50)
 *
 * PATCH /alertas/:id/resolver
 *   - Marca um alerta como resolvido
 *
 * Acesso: PROFESSOR, UNIDADE, STAFF_CENTRAL, MANTENEDORA, DEVELOPER
 * O professor só vê alertas da sua turma (via classroomId ou turma vinculada).
 *
 * fix: usar user.sub (não user.userId), user.roles[0].level (não user.roleLevel),
 *      isActive (não active) no ClassroomTeacher, remover include.child inexistente.
 */
import {
  Controller,
  Get,
  Patch,
  ForbiddenException,
  NotFoundException,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { RoleLevel } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

@Controller('alertas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertasController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /alertas
   * Retorna alertas operacionais ativos para a unidade/turma do usuário.
   */
  @Get()
  @RequireRoles(
    RoleLevel.PROFESSOR,
    RoleLevel.UNIDADE,
    RoleLevel.STAFF_CENTRAL,
    RoleLevel.MANTENEDORA,
    RoleLevel.DEVELOPER,
  )
  async listar(
    @CurrentUser() user: JwtPayload,
    @Query('unitId') unitId?: string,
    @Query('classroomId') classroomId?: string,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
    @Query('canal') canal?: 'OPERACIONAL' | 'ACOMPANHAMENTO',
    @Query('prioridade') prioridade?: 'NORMAL' | 'URGENTE',
  ) {
    const take = Math.min(Number(limit ?? 50), 200);
    const apenasNaoResolvidos = unread !== 'false';

    const where: Record<string, any> = {
      ...(apenasNaoResolvidos ? { resolvido: false } : {}),
      // Escopo de segurança: restringir ao mantenedoraId do usuário
      mantenedoraId: user.mantenedoraId,
    };

    // Filtros opcionais
    if (unitId) where.unitId = unitId;
    if (classroomId) where.classroomId = classroomId;
    const metadataFilters = [
      canal ? { path: ['canal'], equals: canal } : null,
      prioridade ? { path: ['prioridadeOperacional'], equals: prioridade } : null,
    ].filter(Boolean);
    if (metadataFilters.length === 1) where.metadados = metadataFilters[0];
    if (metadataFilters.length > 1) where.AND = metadataFilters.map((filter) => ({ metadados: filter }));

    // Professor: restringir à turma vinculada se não informou classroomId
    // user.roles é um array; verificar se algum role tem level PROFESSOR
    const isProfessor = user.roles?.some(
      (r) => r.level === RoleLevel.PROFESSOR,
    );
    if (isProfessor && !classroomId && !unitId) {
      const vinculo = await this.prisma.classroomTeacher.findFirst({
        where: { teacherId: user.sub, isActive: true },
        select: { classroomId: true },
      });
      if (vinculo) where.classroomId = vinculo.classroomId;
    }

    const alertas = await this.prisma.alertaOperacional.findMany({
      where,
      orderBy: [
        { severidade: 'desc' },
        { criadoEm: 'desc' },
      ],
      take,
      // AlertaOperacional não tem relação direta com Child no schema —
      // childId é apenas uma string. Retornamos o childId para o frontend
      // buscar o nome se necessário.
    });

    const normalizados = alertas.map((alerta) => {
      const metadados = alerta.metadados && typeof alerta.metadados === 'object'
        ? alerta.metadados as Record<string, unknown>
        : {};
      return {
        ...alerta,
        canal: metadados.canal === 'ACOMPANHAMENTO' ? 'ACOMPANHAMENTO' : 'OPERACIONAL',
        prioridadeOperacional: metadados.prioridadeOperacional === 'URGENTE' ? 'URGENTE' : 'NORMAL',
      };
    });

    // Mantém o resumo legado e acrescenta contadores sem misturar os canais.
    const total = normalizados.length;
    const criticos = normalizados.filter(
      (a) => a.severidade === 'ALTA' || a.severidade === 'CRITICA',
    ).length;
    const atencao = normalizados.filter((a) => a.severidade === 'MEDIA').length;
    const urgentes = normalizados.filter((a) => a.prioridadeOperacional === 'URGENTE' && a.canal === 'OPERACIONAL').length;
    const acompanhamento = normalizados.filter((a) => a.canal === 'ACOMPANHAMENTO').length;

    return {
      total,
      criticos,
      atencao,
      urgentes: normalizados.filter((a) => a.prioridadeOperacional === 'URGENTE' && a.canal === 'OPERACIONAL'),
      acompanhamento: normalizados.filter((a) => a.canal === 'ACOMPANHAMENTO'),
      urgentesTotal: urgentes,
      acompanhamentoTotal: acompanhamento,
      alertas: normalizados,
    };
  }

  /**
   * PATCH /alertas/:id/resolver
   * Marca um alerta como resolvido.
   */
  @Patch(':id/resolver')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(
    RoleLevel.UNIDADE,
    RoleLevel.STAFF_CENTRAL,
    RoleLevel.MANTENEDORA,
    RoleLevel.DEVELOPER,
  )
  async resolver(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const alvo = await this.prisma.alertaOperacional.findUnique({
      where: { id },
      select: { id: true, mantenedoraId: true, unitId: true },
    });
    if (!alvo || alvo.mantenedoraId !== user.mantenedoraId) {
      throw new NotFoundException('Alerta não encontrado');
    }
    const isGlobal = user.roles?.some(
      (role) => role.level === RoleLevel.DEVELOPER || role.level === RoleLevel.MANTENEDORA || role.level === RoleLevel.STAFF_CENTRAL,
    );
    if (!isGlobal && alvo.unitId && alvo.unitId !== user.unitId) {
      throw new ForbiddenException('Sem acesso ao alerta de outra unidade');
    }
    return this.prisma.alertaOperacional.update({
      where: { id },
      data: {
        resolvido: true,
        resolvidoPorId: user.sub,
        resolvidoEm: new Date(),
      },
    });
  }
}
