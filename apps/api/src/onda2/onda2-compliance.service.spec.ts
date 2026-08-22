import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Onda2ApprovalStatus, Onda2InspectionResult } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda2ComplianceService } from './onda2-compliance.service';

const actor: JwtPayload = {
  sub: 'user-1',
  email: 'user-1@test.local',
  mantenedoraId: 'tenant-1',
  unitId: 'unit-1',
  roles: [{ roleId: 'role-1', level: 'UNIDADE' as any, type: 'UNIDADE_DIRETOR' as any, unitScopes: [] }],
};

describe('Onda2ComplianceService', () => {
  const prisma = {
    preventiveMaintenancePlan: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    preventivePlanTask: { findFirst: jest.fn(), create: jest.fn() },
    workOrder: { create: jest.fn() },
    checklistTemplate: { findFirst: jest.fn() },
    checklistTemplateVersion: { findFirst: jest.fn() },
    checklistExecution: { findFirst: jest.fn() },
    checklistItemResult: { count: jest.fn() },
    inspection: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    nonconformity: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    complianceRequirement: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    complianceEvidence: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    correctiveAction: { findFirst: jest.fn() },
    $transaction: jest.fn((operation: any) => Array.isArray(operation) ? Promise.all(operation) : operation(prisma)),
  } as any;
  const access = { assertFlagAndCapability: jest.fn(), assertUnitAccess: jest.fn() } as any;
  let service: Onda2ComplianceService;

  beforeEach(() => {
    jest.clearAllMocks();
    access.assertFlagAndCapability.mockResolvedValue(undefined);
    access.assertUnitAccess.mockResolvedValue(undefined);
    service = new Onda2ComplianceService(prisma, access);
  });

  it('conclui inspeção e cria não conformidade revisável', async () => {
    prisma.inspection.findFirst.mockResolvedValue({ id: 'inspection-1', unitId: 'unit-1', mantenedoraId: 'tenant-1' });
    prisma.checklistExecution.findFirst.mockResolvedValue({ id: 'exec-1' });
    prisma.checklistItemResult.count.mockResolvedValue(3);
    prisma.inspection.update.mockResolvedValue({ id: 'inspection-1', status: 'COMPLETED' });
    prisma.nonconformity.create.mockResolvedValue({ id: 'nc-1' });

    const result = await service.completeInspection('inspection-1', { executionId: 'exec-1', result: Onda2InspectionResult.NON_COMPLIANT, note: 'Revisar item sintético' }, actor);
    expect(result.governance).toEqual({ diagnosticInference: false, humanReviewRequired: true });
    expect(prisma.nonconformity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ inspectionId: 'inspection-1', description: 'Revisar item sintético' }) }));
  });

  it('exige execução e pelo menos um item preenchido para concluir inspeção', async () => {
    prisma.inspection.findFirst.mockResolvedValue({ id: 'inspection-1', unitId: 'unit-1', mantenedoraId: 'tenant-1' });
    prisma.checklistExecution.findFirst.mockResolvedValue(null);
    await expect(service.completeInspection('inspection-1', { result: Onda2InspectionResult.COMPLIANT } as any, actor)).rejects.toBeInstanceOf(BadRequestException);

    prisma.checklistExecution.findFirst.mockResolvedValue({ id: 'exec-1' });
    prisma.checklistItemResult.count.mockResolvedValue(0);
    await expect(service.completeInspection('inspection-1', { executionId: 'exec-1', result: Onda2InspectionResult.COMPLIANT } as any, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.inspection.update).not.toHaveBeenCalled();
  });

  it('rejeita template de inspeção pertencente a outra unidade', async () => {
    prisma.checklistTemplate.findFirst.mockResolvedValue(null);
    await expect(service.createInspection({ unitId: 'unit-1', templateId: 'template-other-unit' } as any, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.inspection.create).not.toHaveBeenCalled();
  });

  it('faz rollback lógico da conclusão quando a criação da não conformidade falha', async () => {
    prisma.inspection.findFirst.mockResolvedValue({ id: 'inspection-1', unitId: 'unit-1', mantenedoraId: 'tenant-1' });
    prisma.checklistExecution.findFirst.mockResolvedValue({ id: 'exec-1' });
    prisma.checklistItemResult.count.mockResolvedValue(1);
    const state = { status: 'SCHEDULED' };
    prisma.inspection.update.mockImplementation(async () => { state.status = 'COMPLETED'; return { id: 'inspection-1', status: state.status }; });
    prisma.nonconformity.create.mockRejectedValue(new Error('falha sintética ao criar NC'));
    prisma.$transaction.mockImplementation(async (operation: any) => {
      const previousStatus = state.status;
      try { return await operation(prisma); } catch (error) { state.status = previousStatus; throw error; }
    });

    await expect(service.completeInspection('inspection-1', { executionId: 'exec-1', result: Onda2InspectionResult.NON_COMPLIANT }, actor)).rejects.toThrow('falha sintética');
    expect(state.status).toBe('SCHEDULED');
  });

  it('faz rollback lógico da task preventiva quando a task falha após criar a OS', async () => {
    prisma.preventiveMaintenancePlan.findFirst.mockResolvedValue({ id: 'plan-1', unitId: 'unit-1', name: 'Plano sintético', nextDueAt: new Date('2026-08-21T00:00:00.000Z'), intervalDays: 30 });
    prisma.preventivePlanTask.findFirst.mockResolvedValue(null);
    const state = { workOrders: [] as unknown[] };
    prisma.workOrder.create.mockImplementation(async ({ data }: any) => { const order = { id: 'wo-1', ...data }; state.workOrders.push(order); return order; });
    prisma.preventivePlanTask.create.mockRejectedValue(new Error('falha sintética ao criar task'));
    prisma.$transaction.mockImplementation(async (operation: any) => {
      const countBefore = state.workOrders.length;
      try { return await operation(prisma); } catch (error) { state.workOrders.splice(countBefore); throw error; }
    });

    await expect(service.generatePreventiveTask('plan-1', actor)).rejects.toThrow('falha sintética');
    expect(state.workOrders).toHaveLength(0);
    expect(prisma.preventiveMaintenancePlan.update).not.toHaveBeenCalled();
  });

  it('exige ação corretiva concluída ou evidência aprovada para verificar NC', async () => {
    prisma.nonconformity.findFirst.mockResolvedValue({ id: 'nc-1', unitId: 'unit-1', inspectionId: 'inspection-1' });
    prisma.correctiveAction.findFirst.mockResolvedValue(null);
    prisma.complianceEvidence.findFirst.mockResolvedValue(null);
    await expect(service.verifyNonconformity('nc-1', {} as any, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.nonconformity.update).not.toHaveBeenCalled();
  });
});
