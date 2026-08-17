import {
  FinancePayableStatus,
  FinancePayrollStatus,
  FinancePeriodStatus,
  FinancePurchaseStatus,
  RoleLevel,
  RoleType,
} from '@prisma/client';
import { FinanceService } from './finance.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

const user: JwtPayload = {
  sub: 'finance-user',
  email: 'finance@example.com',
  mantenedoraId: 'mantenedora-1',
  unitId: 'unit-1',
  roles: [{
    roleId: 'role-1',
    level: RoleLevel.MANTENEDORA,
    type: RoleType.MANTENEDORA_ADMIN,
    unitScopes: [],
  }],
};

describe('FinanceService — overview operacional', () => {
  it('consolida folha, contas, estoque, compras e ponto com dados reais do escopo', async () => {
    const prisma = {
      unit: { findFirst: jest.fn().mockResolvedValue({ id: 'unit-1' }) },
      financialPeriod: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'period-1', referenceMonth: '2026-08', status: FinancePeriodStatus.ABERTA },
        ]),
      },
      payrollRun: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'payroll-1',
          status: FinancePayrollStatus.CALCULADA,
          totalNet: 1000,
          totalGross: 1200,
          createdAt: new Date(),
        }]),
      },
      payable: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'payable-1', status: FinancePayableStatus.EM_APROVACAO, amount: 500, dueDate: new Date(Date.now() - 86_400_000) },
          { id: 'payable-2', status: FinancePayableStatus.PAGA, amount: 200, dueDate: new Date(Date.now() - 86_400_000) },
        ]),
      },
      stockItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'stock-1', name: 'Papel', unitId: 'unit-1', quantity: 2, minimumQuantity: 5 },
          { id: 'stock-2', name: 'Tinta', unitId: 'unit-1', quantity: 10, minimumQuantity: 2 },
        ]),
      },
      purchaseQuote: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'quote-1', status: FinancePurchaseStatus.ABERTA, quotedAt: new Date() },
        ]),
      },
      goodsReceipt: {
        findMany: jest.fn().mockResolvedValue([{ id: 'receipt-1' }]),
      },
      timeEntry: {
        findMany: jest.fn().mockResolvedValue([{ id: 'time-1', status: 'RASCUNHO', workDate: new Date() }]),
      },
    };
    const service = new FinanceService(prisma as any);

    const result = await service.getOverview(user);

    expect(result.scope).toEqual({ mantenedoraId: 'mantenedora-1', unitId: 'unit-1' });
    expect(result.periods.open).toBe(1);
    expect(result.payroll.latestNet).toBe(1000);
    expect(result.payables).toMatchObject({ pending: 1, overdue: 1, pendingAmount: 500, overdueAmount: 500 });
    expect(result.stock).toMatchObject({ items: 2, lowStock: 1, totalQuantity: 12 });
    expect(result.purchasing).toMatchObject({ quotes: 1, openQuotes: 1, receipts: 1 });
    expect(result.time.byStatus).toEqual({ RASCUNHO: 1 });
  });
});
