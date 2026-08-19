import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceApprovalStatus,
  FinanceEmploymentStatus,
  FinancePayrollItemKind,
  FinancePayrollStatus,
  FinancePayableStatus,
  FinancePeriodStatus,
  FinancePurchaseStatus,
  FinanceStockMovementType,
  FinanceTimeEntryStatus,
  Prisma,
  RoleLevel,
} from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEmployeeDto,
  CreateFinancialPeriodDto,
  CreateGoodsReceiptDto,
  CreatePayableDto,
  CreatePayrollDto,
  CreatePurchaseQuoteDto,
  CreateStockItemDto,
  CreateStockMovementDto,
  CreateTimeAdjustmentDto,
  CreateTimeEntryDto,
  DecideTimeAdjustmentDto,
  ListFinanceQueryDto,
  ListPayableQueryDto,
  ListPayrollQueryDto,
  ListPurchaseQueryDto,
  ListStockQueryDto,
  UpdateFinancialPeriodStatusDto,
  UpdatePayableStatusDto,
  UpdatePayrollStatusDto,
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

const PAYROLL_TRANSITIONS: Record<FinancePayrollStatus, FinancePayrollStatus[]> = {
  [FinancePayrollStatus.RASCUNHO]: [FinancePayrollStatus.CALCULADA],
  [FinancePayrollStatus.CALCULADA]: [FinancePayrollStatus.EM_CONFERENCIA],
  [FinancePayrollStatus.EM_CONFERENCIA]: [
    FinancePayrollStatus.CALCULADA,
    FinancePayrollStatus.APROVADA,
  ],
  [FinancePayrollStatus.APROVADA]: [FinancePayrollStatus.FECHADA],
  [FinancePayrollStatus.FECHADA]: [FinancePayrollStatus.RETIFICADA],
  [FinancePayrollStatus.RETIFICADA]: [FinancePayrollStatus.CALCULADA],
};

const PAYABLE_TRANSITIONS: Record<FinancePayableStatus, FinancePayableStatus[]> = {
  [FinancePayableStatus.RASCUNHO]: [
    FinancePayableStatus.EM_APROVACAO,
    FinancePayableStatus.CANCELADA,
  ],
  [FinancePayableStatus.EM_APROVACAO]: [
    FinancePayableStatus.APROVADA,
    FinancePayableStatus.CANCELADA,
  ],
  [FinancePayableStatus.APROVADA]: [
    FinancePayableStatus.AGENDADA,
    FinancePayableStatus.CANCELADA,
  ],
  [FinancePayableStatus.AGENDADA]: [FinancePayableStatus.PAGA, FinancePayableStatus.CANCELADA],
  [FinancePayableStatus.PAGA]: [FinancePayableStatus.CONCILIADA],
  [FinancePayableStatus.CONCILIADA]: [],
  [FinancePayableStatus.CANCELADA]: [],
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
    return this.prisma.employeeProfile.findFirst({
      where: {
        mantenedoraId: user.mantenedoraId,
        userId: user.sub,
        employmentStatus: { not: FinanceEmploymentStatus.ENCERRADO },
      },
    });
  }

  private async assertPeriodScope(user: JwtPayload, periodId: string) {
    const period = await this.prisma.financialPeriod.findFirst({
      where: { id: periodId, mantenedoraId: user.mantenedoraId },
    });
    if (!period) throw new NotFoundException('Competência financeira não encontrada');
    return period;
  }

  private async assertUnitScope(user: JwtPayload, unitId: string) {
    const resolved = await this.resolveUnitId(user, unitId);
    if (!resolved) throw new BadRequestException('Unidade é obrigatória para esta operação');
    return resolved;
  }

  async listPeriods(user: JwtPayload) {
    return this.prisma.financialPeriod.findMany({
      where: { mantenedoraId: user.mantenedoraId },
      orderBy: { referenceMonth: 'desc' },
    });
  }

  async getOverview(user: JwtPayload, requestedUnitId?: string) {
    const unitId = await this.resolveUnitId(user, requestedUnitId);
    const [periods, payrolls, payables, stockItems, purchaseQuotes, goodsReceipts, timeEntries] = await Promise.all([
      this.prisma.financialPeriod.findMany({
        where: { mantenedoraId: user.mantenedoraId },
        orderBy: { referenceMonth: 'desc' },
        take: 12,
      }),
      this.prisma.payrollRun.findMany({
        where: { mantenedoraId: user.mantenedoraId },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.payable.findMany({
        where: {
          mantenedoraId: user.mantenedoraId,
          ...(unitId ? { unitId } : {}),
        },
        orderBy: { dueDate: 'asc' },
        take: 500,
      }),
      this.prisma.stockItem.findMany({
        where: unitId ? { unitId } : { unit: { mantenedoraId: user.mantenedoraId } },
        select: { id: true, name: true, unitId: true, quantity: true, minimumQuantity: true },
      }),
      this.prisma.purchaseQuote.findMany({
        where: {
          mantenedoraId: user.mantenedoraId,
          ...(unitId ? { unitId } : {}),
        },
        orderBy: { quotedAt: 'desc' },
        take: 200,
      }),
      this.prisma.goodsReceipt.findMany({
        where: {
          mantenedoraId: user.mantenedoraId,
          ...(unitId ? { unitId } : {}),
        },
        orderBy: { receivedAt: 'desc' },
        take: 200,
      }),
      this.prisma.timeEntry.findMany({
        where: {
          mantenedoraId: user.mantenedoraId,
          ...(unitId ? { unitId } : {}),
        },
        orderBy: { workDate: 'desc' },
        take: 500,
      }),
    ]);

    const finalPayableStatuses = new Set<FinancePayableStatus>([
      FinancePayableStatus.PAGA,
      FinancePayableStatus.CONCILIADA,
      FinancePayableStatus.CANCELADA,
    ]);
    const payablePending = payables.filter(
      (payable) => !finalPayableStatuses.has(payable.status),
    );
    const now = Date.now();
    const overdue = payablePending.filter((payable) => payable.dueDate.getTime() < now);
    const lowStock = stockItems.filter((item) => item.quantity <= item.minimumQuantity);
    const amount = (value: Prisma.Decimal | number | null | undefined) => Number(value ?? 0);

    return {
      scope: { mantenedoraId: user.mantenedoraId, unitId: unitId ?? null },
      periods: {
        total: periods.length,
        open: periods.filter((period) => period.status === FinancePeriodStatus.ABERTA).length,
        inConference: periods.filter((period) => period.status === FinancePeriodStatus.EM_CONFERENCIA).length,
        approved: periods.filter((period) => period.status === FinancePeriodStatus.APROVADA).length,
        closed: periods.filter((period) => period.status === FinancePeriodStatus.FECHADA).length,
        latest: periods[0] ?? null,
      },
      payroll: {
        runs: payrolls.length,
        latestStatus: payrolls[0]?.status ?? null,
        latestNet: amount(payrolls[0]?.totalNet),
        latestGross: amount(payrolls[0]?.totalGross),
      },
      payables: {
        total: payables.length,
        pending: payablePending.length,
        overdue: overdue.length,
        pendingAmount: payablePending.reduce((total, payable) => total + amount(payable.amount), 0),
        overdueAmount: overdue.reduce((total, payable) => total + amount(payable.amount), 0),
      },
      stock: {
        items: stockItems.length,
        lowStock: lowStock.length,
        totalQuantity: stockItems.reduce((total, item) => total + item.quantity, 0),
        lowStockItems: lowStock.slice(0, 20),
      },
      purchasing: {
        quotes: purchaseQuotes.length,
        openQuotes: purchaseQuotes.filter((quote) => quote.status === FinancePurchaseStatus.ABERTA).length,
        receipts: goodsReceipts.length,
      },
      time: {
        entries: timeEntries.length,
        byStatus: timeEntries.reduce<Record<string, number>>((summary, entry) => {
          const status = String(entry.status);
          summary[status] = (summary[status] ?? 0) + 1;
          return summary;
        }, {}),
      },
      generatedAt: new Date().toISOString(),
    };
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
      throw new BadRequestException(`Transição inválida: ${current.status} → ${dto.status}`);
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

  private async ensureEmployeeProfiles(user: JwtPayload) {
    const userDelegate = (this.prisma as any).user;
    const employeeDelegate = (this.prisma as any).employeeProfile;
    if (typeof userDelegate?.findMany !== 'function') return;

    const users = await userDelegate.findMany({
      where: { mantenedoraId: user.mantenedoraId, status: 'ATIVO' },
      include: {
        roles: {
          where: { isActive: true },
          include: { role: { select: { type: true, level: true } } },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    for (const employeeUser of users) {
      const activeRoles = (employeeUser.roles ?? []).filter((assignment: any) => {
        const roleType = String(assignment.role?.type ?? '');
        const roleLevel = String(assignment.role?.level ?? assignment.scopeLevel ?? '');
        return roleType !== 'FAMILIA_RESPONSAVEL' && roleLevel !== 'FAMILIA';
      });
      if (activeRoles.length === 0) continue;

      const role = activeRoles[0]?.role;
      const roleType = String(role?.type ?? role?.level ?? 'COLABORADOR');
      const existing = typeof employeeDelegate?.findFirst === 'function'
        ? await employeeDelegate.findFirst({ where: { mantenedoraId: user.mantenedoraId, userId: employeeUser.id } })
        : null;

      if (existing) {
        const desiredUnitId = existing.unitId ?? employeeUser.unitId ?? null;
        const needsUpdate = existing.firstName !== employeeUser.firstName
          || existing.lastName !== employeeUser.lastName
          || existing.unitId !== desiredUnitId
          || existing.roleType !== roleType;
        if (needsUpdate && typeof employeeDelegate?.update === 'function') {
          await employeeDelegate.update({
            where: { id: existing.id },
            data: {
              firstName: employeeUser.firstName,
              lastName: employeeUser.lastName,
              unitId: desiredUnitId,
              roleType,
              updatedBy: user.sub,
            },
          });
        }
        continue;
      }

      await employeeDelegate.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId: employeeUser.unitId ?? null,
          userId: employeeUser.id,
          employeeCode: `USR-${employeeUser.id}`.slice(0, 50),
          firstName: employeeUser.firstName,
          lastName: employeeUser.lastName,
          cpf: employeeUser.cpf ?? undefined,
          roleType,
          employmentStatus: FinanceEmploymentStatus.ATIVO,
          hireDate: employeeUser.createdAt ?? new Date(),
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      });
    }
  }

  async listEmployees(user: JwtPayload, query: ListFinanceQueryDto) {
    await this.ensureEmployeeProfiles(user);
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
        update.approvedBy = user.sub;
        update.approvedAt = new Date();
        await tx.timeEntry.update({ where: { id: adjustment.timeEntryId }, data: update });
      }
      return decided;
    });
  }

  async listPayrolls(user: JwtPayload, query: ListPayrollQueryDto) {
    if (query.periodId) await this.assertPeriodScope(user, query.periodId);
    return this.prisma.payrollRun.findMany({
      where: {
        mantenedoraId: user.mantenedoraId,
        ...(query.periodId ? { periodId: query.periodId } : {}),
      },
      include: {
        approvalHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async calculatePayroll(dto: CreatePayrollDto, user: JwtPayload) {
    const period = await this.assertPeriodScope(user, dto.periodId);
    if (period.status === FinancePeriodStatus.FECHADA) {
      throw new BadRequestException('Competência fechada não pode ser recalculada');
    }
    const employees = await this.prisma.employeeProfile.findMany({
      where: { mantenedoraId: user.mantenedoraId, employmentStatus: FinanceEmploymentStatus.ATIVO },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    const existing = await this.prisma.payrollRun.findUnique({ where: { periodId: dto.periodId } });
    const recalculableStatuses: FinancePayrollStatus[] = [
      FinancePayrollStatus.RASCUNHO,
      FinancePayrollStatus.CALCULADA,
      FinancePayrollStatus.RETIFICADA,
    ];
    if (existing && !recalculableStatuses.includes(existing.status)) {
      throw new BadRequestException('Folha já está em conferência, aprovada ou fechada');
    }

    return this.prisma.$transaction(async (tx) => {
      const run = existing
        ? await tx.payrollRun.update({
            where: { id: existing.id },
            data: { status: FinancePayrollStatus.CALCULADA, computedAt: new Date(), createdBy: existing.createdBy },
          })
        : await tx.payrollRun.create({
            data: {
              mantenedoraId: user.mantenedoraId,
              periodId: dto.periodId,
              status: FinancePayrollStatus.CALCULADA,
              createdBy: user.sub,
              computedAt: new Date(),
            },
          });

      if (existing && existing.status !== FinancePayrollStatus.CALCULADA) {
        await tx.payrollApproval.create({
          data: {
            payrollRunId: run.id,
            actorId: user.sub,
            fromStatus: existing.status,
            toStatus: FinancePayrollStatus.CALCULADA,
            comment: 'Folha recalculada após retificação ou ajuste operacional.',
          },
        });
      }

      const oldEmployees = await tx.payrollEmployee.findMany({
        where: { payrollRunId: run.id },
        select: { id: true },
      });
      if (oldEmployees.length) {
        await tx.payrollItem.deleteMany({
          where: { payrollEmployeeId: { in: oldEmployees.map((item) => item.id) } },
        });
        await tx.payrollEmployee.deleteMany({ where: { payrollRunId: run.id } });
      }

      let totalGross = new Prisma.Decimal(0);
      let totalDeductions = new Prisma.Decimal(0);
      let totalNet = new Prisma.Decimal(0);
      let totalCharges = new Prisma.Decimal(0);
      const snapshot: Array<Record<string, unknown>> = [];

      for (const employee of employees) {
        const gross = employee.baseSalary ?? new Prisma.Decimal(0);
        const deductions = new Prisma.Decimal(0);
        const net = gross.minus(deductions);
        const employerCharges = new Prisma.Decimal(0);
        const payrollEmployee = await tx.payrollEmployee.create({
          data: {
            payrollRunId: run.id,
            employeeId: employee.id,
            gross,
            deductions,
            net,
            employerCharges,
            snapshot: {
              employeeCode: employee.employeeCode,
              name: `${employee.firstName} ${employee.lastName}`,
              baseSalary: gross.toNumber(),
              referenceMonth: period.referenceMonth,
            } as Prisma.InputJsonValue,
          },
        });
        if (!gross.isZero()) {
          await tx.payrollItem.create({
            data: {
              payrollEmployeeId: payrollEmployee.id,
              kind: FinancePayrollItemKind.PROVENTO,
              code: 'SALARIO_BASE',
              description: 'Salário base',
              amount: gross,
              reference: period.referenceMonth,
            },
          });
        }
        totalGross = totalGross.plus(gross);
        totalDeductions = totalDeductions.plus(deductions);
        totalNet = totalNet.plus(net);
        totalCharges = totalCharges.plus(employerCharges);
        snapshot.push({ employeeId: employee.id, gross: gross.toNumber(), net: net.toNumber() });
      }

      return tx.payrollRun.update({
        where: { id: run.id },
        data: {
          totalGross,
          totalDeductions,
          totalNet,
          totalCharges,
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      });
    });
  }

  async updatePayrollStatus(id: string, dto: UpdatePayrollStatusDto, user: JwtPayload) {
    const payroll = await this.prisma.payrollRun.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
    });
    if (!payroll) throw new NotFoundException('Folha não encontrada');
    const allowed = PAYROLL_TRANSITIONS[payroll.status] || [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Transição inválida: ${payroll.status} → ${dto.status}`);
    }
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payrollRun.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === FinancePayrollStatus.APROVADA ? { approvedBy: user.sub, approvedAt: now } : {}),
          ...(dto.status === FinancePayrollStatus.FECHADA ? { closedBy: user.sub, closedAt: now } : {}),
        },
      });
      await tx.payrollApproval.create({
        data: {
          payrollRunId: id,
          actorId: user.sub,
          fromStatus: payroll.status,
          toStatus: dto.status,
          comment: dto.comment?.trim() || undefined,
        },
      });
      return updated;
    });
  }

  async listPayables(user: JwtPayload, query: ListPayableQueryDto) {
    const unitId = await this.resolveUnitId(user, query.unitId);
    return this.prisma.payable.findMany({
      where: {
        mantenedoraId: user.mantenedoraId,
        ...(unitId ? { unitId } : {}),
        ...(query.periodId ? { periodId: query.periodId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createPayable(dto: CreatePayableDto, user: JwtPayload) {
    const unitId = dto.unitId ? await this.resolveUnitId(user, dto.unitId) : undefined;
    if (dto.periodId) await this.assertPeriodScope(user, dto.periodId);
    return this.prisma.payable.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId,
        periodId: dto.periodId,
        supplierId: dto.supplierId,
        beneficiary: dto.beneficiary.trim(),
        description: dto.description.trim(),
        category: dto.category.trim(),
        sourceType: dto.sourceType.trim(),
        sourceId: dto.sourceId,
        dueDate: new Date(dto.dueDate),
        amount: new Prisma.Decimal(dto.amount),
        documentRef: dto.documentRef?.trim() || undefined,
        createdBy: user.sub,
      },
    });
  }

  async updatePayableStatus(id: string, dto: UpdatePayableStatusDto, user: JwtPayload) {
    const payable = await this.prisma.payable.findFirst({
      where: { id, mantenedoraId: user.mantenedoraId },
    });
    if (!payable) throw new NotFoundException('Conta a pagar não encontrada');
    const allowed = PAYABLE_TRANSITIONS[payable.status] || [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Transição inválida: ${payable.status} → ${dto.status}`);
    }
    if (dto.status === FinancePayableStatus.PAGA && !dto.paymentRef?.trim()) {
      throw new BadRequestException('paymentRef é obrigatório para marcar uma conta como paga');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payable.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === FinancePayableStatus.APROVADA
            ? { approvedBy: user.sub, approvedAt: new Date() }
            : {}),
          ...(dto.status === FinancePayableStatus.PAGA
            ? { paidBy: user.sub, paidAt: new Date(), paymentRef: dto.paymentRef?.trim() }
            : {}),
        },
      });
      if (dto.status === FinancePayableStatus.EM_APROVACAO || dto.status === FinancePayableStatus.APROVADA) {
        await tx.payableApproval.create({
          data: {
            payableId: id,
            actorId: user.sub,
            status: dto.status === FinancePayableStatus.APROVADA
              ? FinanceApprovalStatus.APROVADA
              : FinanceApprovalStatus.PENDENTE,
            comment: dto.comment?.trim() || undefined,
          },
        });
      }
      return updated;
    });
  }

  async listStockItems(user: JwtPayload, query: ListStockQueryDto) {
    const unitId = await this.resolveUnitId(user, query.unitId);
    return this.prisma.stockItem.findMany({
      where: {
        ...(unitId ? { unitId } : { unit: { mantenedoraId: user.mantenedoraId } }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async createStockItem(dto: CreateStockItemDto, user: JwtPayload) {
    const unitId = await this.assertUnitScope(user, dto.unitId);
    return this.prisma.stockItem.create({
      data: {
        unitId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim() || undefined,
        minimumQuantity: dto.minimumQuantity ?? 0,
        location: dto.location?.trim() || undefined,
      },
    });
  }

  async listStockMovements(user: JwtPayload, query: ListStockQueryDto) {
    const unitId = await this.resolveUnitId(user, query.unitId);
    return this.prisma.stockMovement.findMany({
      where: { mantenedoraId: user.mantenedoraId, ...(unitId ? { unitId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  async createStockMovement(dto: CreateStockMovementDto, user: JwtPayload) {
    const unitId = await this.assertUnitScope(user, dto.unitId);
    const item = await this.prisma.stockItem.findFirst({ where: { id: dto.stockItemId, unitId } });
    if (!item) throw new NotFoundException('Item de estoque não encontrado na unidade');
    if (dto.movementType === FinanceStockMovementType.TRANSFERENCIA) {
      throw new BadRequestException('Transferência exige endpoint de transferência entre unidades');
    }
    const delta = dto.movementType === FinanceStockMovementType.SAIDA ? -dto.quantity : dto.quantity;
    const nextQuantity = item.quantity + delta;
    if (nextQuantity < 0) throw new BadRequestException('Estoque insuficiente para esta saída');
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId,
          stockItemId: item.id,
          movementType: dto.movementType,
          quantity: dto.quantity,
          unitCost: dto.unitCost === undefined ? undefined : new Prisma.Decimal(dto.unitCost),
          sourceType: dto.sourceType.trim(),
          sourceId: dto.sourceId,
          reason: dto.reason?.trim() || undefined,
          createdBy: user.sub,
        },
      });
      await tx.stockItem.update({ where: { id: item.id }, data: { quantity: nextQuantity } });
      return movement;
    });
  }

  async listPurchaseQuotes(user: JwtPayload, query: ListPurchaseQueryDto) {
    const unitId = await this.resolveUnitId(user, query.unitId);
    return this.prisma.purchaseQuote.findMany({
      where: {
        mantenedoraId: user.mantenedoraId,
        ...(unitId ? { unitId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { quotedAt: 'desc' },
    });
  }

  async createPurchaseQuote(dto: CreatePurchaseQuoteDto, user: JwtPayload) {
    const unitId = await this.assertUnitScope(user, dto.unitId);
    return this.prisma.purchaseQuote.create({
      data: {
        mantenedoraId: user.mantenedoraId,
        unitId,
        purchaseId: dto.purchaseId,
        supplierId: dto.supplierId,
        status: dto.status,
        totalAmount: new Prisma.Decimal(dto.totalAmount),
        documentRef: dto.documentRef?.trim() || undefined,
        notes: dto.notes?.trim() || undefined,
        createdBy: user.sub,
      },
    });
  }

  async listGoodsReceipts(user: JwtPayload, query: ListStockQueryDto) {
    const unitId = await this.resolveUnitId(user, query.unitId);
    return this.prisma.goodsReceipt.findMany({
      where: { mantenedoraId: user.mantenedoraId, ...(unitId ? { unitId } : {}) },
      orderBy: { receivedAt: 'desc' },
    });
  }

  async createGoodsReceipt(dto: CreateGoodsReceiptDto, user: JwtPayload) {
    const unitId = await this.assertUnitScope(user, dto.unitId);
    if (!dto.items.length) throw new BadRequestException('Recebimento precisa conter itens');
    const purchase = await this.prisma.pedidoCompra.findFirst({
      where: { id: dto.purchaseId, mantenedoraId: user.mantenedoraId, unitId },
      select: { id: true },
    });
    if (!purchase) throw new NotFoundException('Pedido de compra não encontrado na unidade');

    const status = dto.status || FinancePurchaseStatus.RECEBIDA;
    if (status === FinancePurchaseStatus.CANCELADA) {
      throw new BadRequestException('Recebimento cancelado não pode movimentar estoque');
    }

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          mantenedoraId: user.mantenedoraId,
          unitId,
          purchaseId: purchase.id,
          status,
          receivedBy: user.sub,
          items: dto.items as unknown as Prisma.InputJsonValue,
          documentRef: dto.documentRef?.trim() || undefined,
          notes: dto.notes?.trim() || undefined,
        },
      });

      if (status !== FinancePurchaseStatus.RECEBIDA) return receipt;
      for (const itemDto of dto.items) {
        const stockItem = await tx.stockItem.findFirst({
          where: { id: itemDto.stockItemId, unitId },
        });
        if (!stockItem) throw new NotFoundException('Item de estoque do recebimento não encontrado');
        await tx.stockItem.update({
          where: { id: stockItem.id },
          data: { quantity: { increment: itemDto.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            mantenedoraId: user.mantenedoraId,
            unitId,
            stockItemId: stockItem.id,
            movementType: FinanceStockMovementType.ENTRADA,
            quantity: itemDto.quantity,
            unitCost: itemDto.unitCost === undefined ? undefined : new Prisma.Decimal(itemDto.unitCost),
            sourceType: 'GOODS_RECEIPT',
            sourceId: receipt.id,
            reason: 'Entrada de mercadoria recebida',
            createdBy: user.sub,
          },
        });
      }
      return receipt;
    });
  }
}
