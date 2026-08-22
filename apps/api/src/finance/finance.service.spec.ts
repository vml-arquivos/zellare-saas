import { FinanceService } from './finance.service';
import {
  FinanceApprovalStatus,
  FinancePeriodStatus,
  FinancePayrollStatus,
  FinanceTimeEntryStatus,
  RoleLevel,
} from '@prisma/client';

function makePrisma() {
  return {
    financialPeriod: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    employeeProfile: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    unit: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    timeEntry: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    timeAdjustment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payrollRun: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payrollApproval: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

const manager = {
  sub: 'manager-1',
  email: 'manager@example.invalid',
  mantenedoraId: 'tenant-1',
  unitId: undefined,
  roles: [{ roleId: 'role-1', level: RoleLevel.MANTENEDORA, type: 'MANTENEDORA_ADMIN', unitScopes: [] }],
} as any;

const professor = {
  sub: 'teacher-1',
  email: 'teacher@example.invalid',
  mantenedoraId: 'tenant-1',
  unitId: 'unit-1',
  roles: [{ roleId: 'role-2', level: RoleLevel.PROFESSOR, type: 'PROFESSOR', unitScopes: ['unit-1'] }],
} as any;

describe('FinanceService', () => {
  it('abre ou retorna uma competência idempotente para a mantenedora', async () => {
    const prisma = makePrisma();
    prisma.financialPeriod.upsert.mockResolvedValue({
      id: 'period-1',
      mantenedoraId: 'tenant-1',
      referenceMonth: '2026-08',
      status: FinancePeriodStatus.ABERTA,
    });
    const service = new FinanceService(prisma as any);

    const period = await service.createPeriod({ referenceMonth: '2026-08' }, manager);

    expect(period.id).toBe('period-1');
    expect(prisma.financialPeriod.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          mantenedoraId_referenceMonth: {
            mantenedoraId: 'tenant-1',
            referenceMonth: '2026-08',
          },
        },
      }),
    );
  });

  it('impede transição inválida de competência', async () => {
    const prisma = makePrisma();
    prisma.financialPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      mantenedoraId: 'tenant-1',
      status: FinancePeriodStatus.ABERTA,
    });
    const service = new FinanceService(prisma as any);

    await expect(
      service.updatePeriodStatus(
        'period-1',
        { status: FinancePeriodStatus.FECHADA },
        manager,
      ),
    ).rejects.toThrow('Transição inválida');
    expect(prisma.financialPeriod.update).not.toHaveBeenCalled();
  });

  it('exige motivo para reabrir competência fechada', async () => {
    const prisma = makePrisma();
    prisma.financialPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      mantenedoraId: 'tenant-1',
      status: FinancePeriodStatus.FECHADA,
    });
    const service = new FinanceService(prisma as any);

    await expect(
      service.updatePeriodStatus(
        'period-1',
        { status: FinancePeriodStatus.REABERTA },
        manager,
      ),
    ).rejects.toThrow('Motivo obrigatório');
  });

  it('restringe listagem de ponto do professor ao funcionário vinculado ao login', async () => {
    const prisma = makePrisma();
    prisma.employeeProfile.findFirst.mockResolvedValue({
      id: 'employee-1',
      userId: 'teacher-1',
      unitId: 'unit-1',
      mantenedoraId: 'tenant-1',
      employmentStatus: 'ATIVO',
    });
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-1' });
    prisma.timeEntry.findMany.mockResolvedValue([]);
    const service = new FinanceService(prisma as any);

    await service.listTimeEntries(professor, {});

    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: 'employee-1', mantenedoraId: 'tenant-1' }),
      }),
    );
  });

  it('não permite que o solicitante aprove o próprio ajuste', async () => {
    const prisma = makePrisma();
    prisma.timeAdjustment.findFirst.mockResolvedValue({
      id: 'adjustment-1',
      requestedBy: 'manager-1',
      status: FinanceApprovalStatus.PENDENTE,
      mantenedoraId: 'tenant-1',
    });
    const service = new FinanceService(prisma as any);

    await expect(
      service.decideTimeAdjustment(
        'adjustment-1',
        { status: FinanceApprovalStatus.APROVADA },
        manager,
      ),
    ).rejects.toThrow('solicitante não pode aprovar');
  });

  it('registra o histórico ao avançar uma folha', async () => {
    const prisma = makePrisma();
    prisma.payrollRun.findFirst.mockResolvedValue({
      id: 'payroll-1',
      mantenedoraId: 'tenant-1',
      status: FinancePayrollStatus.CALCULADA,
    });
    prisma.payrollRun.update.mockResolvedValue({
      id: 'payroll-1',
      status: FinancePayrollStatus.EM_CONFERENCIA,
    });
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
    const service = new FinanceService(prisma as any);

    await service.updatePayrollStatus(
      'payroll-1',
      { status: FinancePayrollStatus.EM_CONFERENCIA, comment: 'Conferência inicial concluída.' },
      manager,
    );

    expect(prisma.payrollRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payroll-1' },
        data: expect.objectContaining({ status: FinancePayrollStatus.EM_CONFERENCIA }),
      }),
    );
    expect(prisma.payrollApproval.create).toHaveBeenCalledWith({
      data: {
        payrollRunId: 'payroll-1',
        actorId: 'manager-1',
        fromStatus: FinancePayrollStatus.CALCULADA,
        toStatus: FinancePayrollStatus.EM_CONFERENCIA,
        comment: 'Conferência inicial concluída.',
      },
    });
  });

  it('não registra histórico quando a transição da folha é inválida', async () => {
    const prisma = makePrisma();
    prisma.payrollRun.findFirst.mockResolvedValue({
      id: 'payroll-1',
      mantenedoraId: 'tenant-1',
      status: FinancePayrollStatus.RASCUNHO,
    });
    const service = new FinanceService(prisma as any);

    await expect(
      service.updatePayrollStatus(
        'payroll-1',
        { status: FinancePayrollStatus.APROVADA },
        manager,
      ),
    ).rejects.toThrow('Transição inválida');
    expect(prisma.payrollRun.update).not.toHaveBeenCalled();
    expect(prisma.payrollApproval.create).not.toHaveBeenCalled();
  });

  it('calcula minutos trabalhados no lançamento de ponto', async () => {
    const prisma = makePrisma();
    prisma.employeeProfile.findFirst.mockResolvedValue({
      id: 'employee-1',
      userId: 'teacher-1',
      unitId: 'unit-1',
      mantenedoraId: 'tenant-1',
      employmentStatus: 'ATIVO',
    });
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-1' });
    prisma.financialPeriod.upsert.mockResolvedValue({
      id: 'period-1',
      status: FinancePeriodStatus.ABERTA,
    });
    prisma.timeEntry.create.mockResolvedValue({
      id: 'time-1',
      workedMinutes: 480,
      status: FinanceTimeEntryStatus.RASCUNHO,
    });
    const service = new FinanceService(prisma as any);

    await service.createTimeEntry(
      {
        employeeId: 'employee-1',
        workDate: '2026-08-17',
        clockIn: '2026-08-17T08:00:00.000Z',
        clockOut: '2026-08-17T16:30:00.000Z',
        breakMinutes: 30,
      },
      professor,
    );

    expect(prisma.timeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workedMinutes: 480 }),
      }),
    );
  });
});


describe('FinanceService — sincronização de funcionários', () => {
  it('cria perfis financeiros idempotentes a partir de usuários ativos institucionais', async () => {
    const prisma = makePrisma() as any;
    prisma.user.findMany = jest.fn().mockResolvedValue([
      {
        id: 'teacher-1',
        firstName: 'Ana',
        lastName: 'Lima',
        cpf: null,
        unitId: 'unit-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        roles: [{ role: { type: 'PROFESSOR', level: 'PROFESSOR' } }],
      },
      {
        id: 'guardian-1',
        firstName: 'Bruna',
        lastName: 'Melo',
        cpf: null,
        unitId: 'unit-1',
        roles: [{ role: { type: 'FAMILIA_RESPONSAVEL', level: 'FAMILIA' } }],
      },
    ]);
    prisma.employeeProfile.findFirst.mockResolvedValue(null);
    prisma.employeeProfile.create.mockResolvedValue({ id: 'employee-1' });
    prisma.employeeProfile.findMany.mockResolvedValue([{ id: 'employee-1', firstName: 'Ana', lastName: 'Lima' }]);
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-1' });

    const service = new FinanceService(prisma);
    const employees = await service.listEmployees(manager, {} as any);

    expect(prisma.employeeProfile.create).toHaveBeenCalledTimes(1);
    expect(prisma.employeeProfile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'teacher-1',
        employeeCode: 'USR-teacher-1',
        roleType: 'PROFESSOR',
        employmentStatus: 'ATIVO',
      }),
    }));
    expect(employees).toEqual([{ id: 'employee-1', firstName: 'Ana', lastName: 'Lima' }]);
  });
});
