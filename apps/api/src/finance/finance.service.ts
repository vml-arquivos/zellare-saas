import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceApprovalStatus,
  FinanceEmploymentStatus,
  FinancePeriodStatus,
  FinanceTimeEntryStatus,
  Prisma,
  RoleLevel,
} from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEmployeeDto,
  CreateFinancialPeriodDto,
  CreateTimeAdjustmentDto,
  CreateTimeEntryDto,
  DecideTimeAdjustmentDto,
  ListFinanceQueryDto,
  UpdateFinancialPeriodStatusDto,
} from './dto/finance.dto';

const PERIOD_TRANSITIONS: Record<FinancePeriodStatus, FinancePeriodStatus[]> = {
  [FinancePeriodStatus.ABERTA]: [FinancePeriodStatus.EM_CONFERENCIA],
  [FinancePeriodStatus.EM_CONFERENCIA]: [
    FinancePeriodStatus.ABERTA,
    FinancePeriodStatus.APROVADA,
  ],
  [FinancePeriodStatus.APROVADA]: [FinancePeriodStatus.FECHADA],
  [FinancePeriodStatus.FECHADA]: [FinancePeriodStatus.REABERTA],
  [FinancePeriodStatus.REABERTA]: [FinancePeriodStatus.EM_CONFERENCIA],
};

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private hasLevel(user: JwtPayload, ...levels: RoleLevel[]) {
    return user.roles?.some((role) => levels.includes(role.level as RoleLevel)) ?? false;
  }

  private canManageNetwork(user: JwtPayload) {
    return this.hasLevel(user, RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA);
  }

  private canApprove(user: JwtPayload) {
    return this.hasLevel(
      user,
      RoleLevel.DEVELOPER,
      RoleLevel.MANTENEDORA,
      RoleLevel.STAFF_CENTRAL,
      RoleLevel.UNIDADE,
    );
  }

  private async resolveUnitId(user: JwtPayload, requestedUnitId?: string) {
    const unitId = requestedUnitId || user.unitId || undefined;
    if (!unitId) return undefined;

    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, mantenedoraId: user.mantenedoraId },
      select: { id: true },
    });
    if (!unit) throw new ForbiddenException('Unidade fora do escopo da mantenedora');

    if (!this.canManageNetwork(user) && user.unitId !== unitId) {
      throw new ForbiddenException('Usuário limitado à própria unidade');
    }
    return unit.id;
  }

  private async assertEmployeeScope(user: JwtPayload, employeeId: string) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id: employeeId, mantenedoraId: user.mantenedoraId },
    });
    if (!employee) throw new NotFoundException('Funcionário não encontrado no escopo');
    if (!this.canManageNetwork(user) && employee.unitId && employee.unitId !== user.unitId) {
      throw new ForbiddenException('Funcionário fora da unidade do usuário');
    }
    if (!this.canApprove(user) && employee.userId !== user.sub) {
      throw new ForbiddenException('Professor limitado ao próprio ponto');
    }
    return employee;
  }

  private async resolveCurrentEmployee(user: JwtPayload) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: {
        mantenedoraId: user.mantenedoraId,
        userId: user.sub,
        employmentStatus: { not: FinanceEmploymentStatus.ENCERRADO },
      },
    });
    return employee;
  }

  private async assertPeriodScope(user: JwtPayload, periodId: string) {
    const period = await this.prisma.financialPeriod.findFirst({
      where: { id: periodId, mantenedoraId: user.mantenedoraId },
    });
    if (!period) throw new NotFoundException('Competência financeira não encontrada');
    return period;
  }

  async listPeriods(user: JwtPayload) {
    return this.prisma.financialPeriod.findMany({
      where: { mantenedoraId: user.mantenedoraId },
      orderBy: { referenceMonth: 'desc' },
    });
  }

  async createPeriod(dto: CreateFinancialPeriodDto, user: JwtPayload) {
    if (!this.canManageNetwork(user)) {
      throw new ForbiddenException('Somente a mantenedora pode abrir competência financeira');
    }
    return this.prisma.financialPeriod.upsert({
      where: {
        mantenedoraId_referenceMonth: {
          mantenedoraId: user.mantenedoraId,
          referenceMonth: dto.referenceMonth,
        },
      },
      update: {},
      create: {
        mantenedoraId: user.mantenedoraId,
        referenceMonth: dto.referenceMonth,
        status: FinancePeriodStatus.ABERTA,
      },
    });
  }

  async updatePeriodStatus(
    periodId: string,
    dto: UpdateFinancialPeriodStatusDto,
    user: JwtPayload,
  ) {
    const current = await this.assertPeriodScope(user, periodId);
    const allowed = PERIOD_TRANSITIONS[current.status] || [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transição inválida: ${current.status} → ${dto.status}`,
      );
    }

    const closing = dto.status === FinancePeriodStatus.FECHADA;
    const reopening = dto.status === FinancePeriodStatus.REABERTA;
    if ((closing || reopening) && !this.hasLevel(user, RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA)) {
      throw new ForbiddenException('Fechamento e reabertura exigem aprovação da mantenedora');
    }
    if (reopening && !dto.reason?.trim()) {
      throw new BadRequestException('Motivo obrigatório para reabrir competência fechada');
    }

    return this.prisma.financialPeriod.update({
      where: { id: periodId },
      data: {
        status: dto.status,
        ...(closing ? { closedAt: new Date(), closedBy: user.sub } : {}),
        ...(reopening
          ? { reopenedAt: new Date(), reopenedBy: user.sub, reopenReason: dto.reason }
          : {}),
      },
    });
  }

  async listEmployees(user: JwtPayload, query: ListFinanceQueryDto) {
    const unitId = await this.resolveUnitId(user, query.unitId);
    return this.prisma.employeeProfile.findMany({
      where: {
        mantenedoraId: user.mantenedoraId,
        ...(unitId ? { unitId } : {}),
        ...(query.employeeId ? { id: query.employeeId } : {}),
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async createEmployee(dto: CreateEmployeeDto, user: JwtPayload) {
    if (!this.canApprove(user)) {
      throw new ForbiddenException('Perfil sem permissão para cadastrar funcionário');
    }
    const unitId = await this.resolveUnitId(user, dto.unitId);
    if (dto.userId) {
      const linkedUser = await this.prisma.user.findFirst({
        where: { id: dto.userId, mantenedoraId: user.mantenedoraId },
        select: { id: true },
      });
      if (!linkedUser) throw new BadRequestException('Usuário vinculado fora do escopo');
    }

    return this.prisma.employeeProfile.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId,
        userId: dto.userId,
        employeeCode: dto.employeeCode.trim(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        cpf: dto.cpf?.trim() || undefined,
        roleType: dto.roleType?.trim() || undefined,
        employmentStatus: dto.employmentStatus || FinanceEmploymentStatus.ATIVO,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        baseSalary: dto.baseSalary === undefined ? undefined : new Prisma.Decimal(dto.baseSalary),
        weeklyHours: dto.weeklyHours === undefined ? undefined : new Prisma.Decimal(dto.weeklyHours),
        costCenter: dto.costCenter?.trim() || undefined,
        bankAccountMasked: dto.bankAccountMasked?.trim() || undefined,
        createdBy: user.sub,
      },
    });
  }

  async listTimeEntries(user: JwtPayload, query: ListFinanceQueryDto) {
    const unitId = await this.resolveUnitId(user, query.unitId);
    let employeeId = query.employeeId;
    if (!this.canApprove(user)) {
      const employee = await this.resolveCurrentEmployee(user);
      if (!employee) return [];
      employeeId = employee.id;
    }
    return this.prisma.timeEntry.findMany({
      where: {
        mantenedoraId: user.mantenedoraId,
        ...(unitId ? { unitId } : {}),
        ...(query.periodId ? { periodId: query.periodId } : {}),
        ...(employeeId ? { employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createTimeEntry(dto: CreateTimeEntryDto, user: JwtPayload) {
    const employee = await this.assertEmployeeScope(user, dto.employeeId);
    const unitId = await this.resolveUnitId(user, dto.unitId || employee.unitId || undefined);
    const period = dto.periodId
      ? await this.assertPeriodScope(user, dto.periodId)
      : await this.prisma.financialPeriod.upsert({
          where: {
            mantenedoraId_referenceMonth: {
              mantenedoraId: user.mantenedoraId,
              referenceMonth: dto.workDate.slice(0, 7),
            },
          },
          update: {},
          create: {
            mantenedoraId: user.mantenedoraId,
            referenceMonth: dto.workDate.slice(0, 7),
            status: FinancePeriodStatus.ABERTA,
          },
        });

    if (period.status === FinancePeriodStatus.FECHADA) {
      throw new BadRequestException('Não é possível lançar ponto em competência fechada');
    }

    const clockIn = dto.clockIn ? new Date(dto.clockIn) : undefined;
    const clockOut = dto.clockOut ? new Date(dto.clockOut) : undefined;
    const breakMinutes = dto.breakMinutes || 0;
    let workedMinutes: number | undefined;
    if (clockIn && clockOut) {
      const total = Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000) - breakMinutes;
      if (total < 0) throw new BadRequestException('Jornada inválida');
      workedMinutes = total;
    }

    return this.prisma.timeEntry.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId,
        periodId: period.id,
        employeeId: employee.id,
        workDate: new Date(dto.workDate),
        clockIn,
        clockOut,
        breakMinutes,
        workedMinutes,
        source: dto.source?.trim() || 'MANUAL',
        notes: dto.notes?.trim() || undefined,
        status: FinanceTimeEntryStatus.RASCUNHO,
        createdBy: user.sub,
      },
    });
  }

  async submitTimeEntry(id: string, user: JwtPayload) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
    });
    if (!entry) throw new NotFoundException('Registro de ponto não encontrado');
    if (!this.canApprove(user)) {
      const employee = await this.resolveCurrentEmployee(user);
      if (!employee || entry.employeeId !== employee.id) {
        throw new ForbiddenException('Professor limitado ao próprio ponto');
      }
    } else if (entry.unitId && user.unitId && entry.unitId !== user.unitId && !this.canManageNetwork(user)) {
      throw new ForbiddenException('Registro fora da unidade do usuário');
    }
    if (entry.status !== FinanceTimeEntryStatus.RASCUNHO) {
      throw new BadRequestException('Somente ponto em rascunho pode ser enviado');
    }
    return this.prisma.timeEntry.update({
      where: { id },
      data: { status: FinanceTimeEntryStatus.ENVIADO },
    });
  }

  async createTimeAdjustment(dto: CreateTimeAdjustmentDto, user: JwtPayload) {
    const employee = await this.assertEmployeeScope(user, dto.employeeId);
    if (!dto.proposedData || typeof dto.proposedData !== 'object') {
      throw new BadRequestException('proposedData deve ser um objeto');
    }

    let previousData: Record<string, unknown> = {};
    if (dto.timeEntryId) {
      const entry = await this.prisma.timeEntry.findFirst({
        where: { id: dto.timeEntryId, mantenedoraId: user.mantenedoraId },
      });
      if (!entry) throw new NotFoundException('Ponto de referência não encontrado');
      if (entry.employeeId !== employee.id) throw new BadRequestException('Funcionário divergente');
      previousData = {
        workDate: entry.workDate.toISOString(),
        clockIn: entry.clockIn?.toISOString() ?? null,
        clockOut: entry.clockOut?.toISOString() ?? null,
        breakMinutes: entry.breakMinutes,
        workedMinutes: entry.workedMinutes,
      };
    }

    return this.prisma.timeAdjustment.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId: dto.unitId || employee.unitId || undefined,
        periodId: dto.periodId || undefined,
        employeeId: employee.id,
        timeEntryId: dto.timeEntryId,
        requestedBy: user.sub,
        previousData: previousData as Prisma.InputJsonValue,
        proposedData: dto.proposedData as Prisma.InputJsonValue,
        reason: dto.reason.trim(),
      },
    });
  }

  async decideTimeAdjustment(id: string, dto: DecideTimeAdjustmentDto, user: JwtPayload) {
    if (!this.canApprove(user)) {
      throw new ForbiddenException('Perfil sem permissão para decidir ajuste de ponto');
    }
    const adjustment = await this.prisma.timeAdjustment.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
    });
    if (!adjustment) throw new NotFoundException('Ajuste de ponto não encontrado');
    if (adjustment.requestedBy === user.sub) {
      throw new ForbiddenException('O solicitante não pode aprovar o próprio ajuste');
    }
    if (adjustment.status !== FinanceApprovalStatus.PENDENTE) {
      throw new BadRequestException('Ajuste já decidido');
    }

    return this.prisma.$transaction(async (tx) => {
      const decided = await tx.timeAdjustment.update({
        where: { id },
        data: {
          status: dto.status,
          approvedBy: user.sub,
          decidedAt: new Date(),
        },
      });

      if (dto.status === FinanceApprovalStatus.APROVADA && adjustment.timeEntryId) {
        const proposed = adjustment.proposedData as Record<string, unknown>;
        const update: Prisma.TimeEntryUpdateInput = {};
        if (typeof proposed.clockIn === 'string') update.clockIn = new Date(proposed.clockIn);
        if (typeof proposed.clockOut === 'string') update.clockOut = new Date(proposed.clockOut);
        if (typeof proposed.breakMinutes === 'number') update.breakMinutes = proposed.breakMinutes;
        if (typeof proposed.workedMinutes === 'number') update.workedMinutes = proposed.workedMinutes;
        update.status = FinanceTimeEntryStatus.APROVADO;
        await tx.timeEntry.update({ where: { id: adjustment.timeEntryId }, data: update });
      }
      return decided;
    });
  }
}
