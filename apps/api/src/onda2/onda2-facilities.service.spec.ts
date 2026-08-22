import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Onda2MaintenanceRequestStatus, Onda2WorkOrderStatus, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda2FacilitiesService } from './onda2-facilities.service';

const actor: JwtPayload = {
  sub: 'user-1',
  email: 'user-1@test.local',
  mantenedoraId: 'tenant-1',
  unitId: 'unit-1',
  roles: [{ roleId: 'role-1', level: 'UNIDADE' as any, type: 'UNIDADE_DIRETOR' as any, unitScopes: [] }],
};
const uniqueViolation = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' });

describe('Onda2FacilitiesService', () => {
  const prisma = {
    maintenanceRequest: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    workOrder: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    workOrderAssignment: { updateMany: jest.fn(), create: jest.fn() },
    workOrderStatusEvent: { findFirst: jest.fn(), create: jest.fn() },
    facilitySpace: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    facilityAsset: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    fornecedor: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
    $transaction: jest.fn((operation: any) => Array.isArray(operation) ? Promise.all(operation) : operation(prisma)),
  } as any;
  const access = { assertFlagAndCapability: jest.fn(), assertUnitAccess: jest.fn() } as any;
  let service: Onda2FacilitiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    access.assertFlagAndCapability.mockResolvedValue(undefined);
    access.assertUnitAccess.mockResolvedValue(undefined);
    service = new Onda2FacilitiesService(prisma, access);
  });

  it('retorna a solicitação existente para a mesma chave idempotente e preserva a origem', async () => {
    const existing = { id: 'request-1', idempotencyKey: 'mobile-key', source: 'MOBILE', unitId: 'unit-1' };
    prisma.maintenanceRequest.findFirst.mockResolvedValue(existing);
    await expect(service.createMaintenanceRequest({ unitId: 'unit-1', category: 'HIGIENE', description: 'Torneira com vazamento', idempotencyKey: 'mobile-key', source: 'MOBILE' }, actor)).resolves.toBe(existing);
    expect(prisma.maintenanceRequest.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ mantenedoraId: 'tenant-1', unitId: 'unit-1', source: 'MOBILE', idempotencyKey: 'mobile-key' }) }));
    expect(prisma.maintenanceRequest.create).not.toHaveBeenCalled();
  });

  it('rejeita referência de espaço pertencente a outra unidade', async () => {
    prisma.facilitySpace.findFirst.mockResolvedValue(null);
    await expect(service.createMaintenanceRequest({ unitId: 'unit-1', spaceId: 'space-other-unit', category: 'SEGURANCA', description: 'Ocorrência sintética', idempotencyKey: 'req-cross-unit' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.maintenanceRequest.create).not.toHaveBeenCalled();
  });

  it('rejeita executor inativo ou fora da mantenedora/unidade', async () => {
    prisma.workOrder.findFirst.mockResolvedValue({ id: 'wo-1', mantenedoraId: 'tenant-1', unitId: 'unit-1', status: Onda2WorkOrderStatus.OPEN });
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.assignWorkOrder('wo-1', { employeeId: 'inactive-or-other-tenant' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workOrderAssignment.create).not.toHaveBeenCalled();
  });

  it('rejeita fornecedor fora da organização ao criar ativo', async () => {
    prisma.fornecedor.findFirst.mockResolvedValue(null);
    await expect(service.createAsset({ unitId: 'unit-1', code: 'ASSET-SYN-001', qrToken: 'qr-synthetic', name: 'Ativo sintético', category: 'TESTE', supplierId: 'supplier-other-tenant' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.facilityAsset.create).not.toHaveBeenCalled();
  });

  it('rejeita transição inválida de ordem de serviço', async () => {
    prisma.workOrder.findFirst.mockResolvedValue({ id: 'wo-1', mantenedoraId: 'tenant-1', unitId: 'unit-1', status: Onda2WorkOrderStatus.OPEN });
    prisma.workOrderStatusEvent.findFirst.mockResolvedValue(null);
    await expect(service.changeWorkOrderStatus('wo-1', { status: Onda2WorkOrderStatus.CLOSED, idempotencyKey: 'status-1' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workOrderStatusEvent.create).not.toHaveBeenCalled();
  });

  it('converte corrida de idempotência de solicitação em conflito sem duplicar', async () => {
    prisma.maintenanceRequest.findFirst.mockResolvedValue(null);
    let createCalls = 0;
    prisma.maintenanceRequest.create.mockImplementation(async () => {
      createCalls += 1;
      if (createCalls === 1) return { id: 'request-1', idempotencyKey: 'same-key' };
      throw uniqueViolation();
    });
    const dto = { unitId: 'unit-1', category: 'HIGIENE', description: 'Ocorrência sintética', idempotencyKey: 'same-key', source: 'MOBILE' };
    const results = await Promise.allSettled([service.createMaintenanceRequest(dto, actor), service.createMaintenanceRequest(dto, actor)]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected' && item.reason instanceof ConflictException)).toHaveLength(1);
    expect(createCalls).toBe(2);
  });

  it('faz rollback lógico do work order quando a atualização da solicitação falha na transação', async () => {
    const request = { id: 'request-1', status: Onda2MaintenanceRequestStatus.APPROVED };
    const state = { workOrders: [] as unknown[] };
    prisma.maintenanceRequest.findFirst.mockResolvedValue(request);
    prisma.facilitySpace.findFirst.mockResolvedValue({ id: 'space-1' });
    prisma.workOrder.create.mockImplementation(async ({ data }: any) => {
      const created = { id: 'wo-1', ...data };
      state.workOrders.push(created);
      return created;
    });
    prisma.maintenanceRequest.update.mockRejectedValue(new Error('falha sintética após criação da OS'));
    prisma.$transaction.mockImplementation(async (operation: any) => {
      const sizeBefore = state.workOrders.length;
      try {
        return await operation(prisma);
      } catch (error) {
        state.workOrders.splice(sizeBefore);
        throw error;
      }
    });

    await expect(service.createWorkOrder({ unitId: 'unit-1', requestId: 'request-1', spaceId: 'space-1', category: 'PREVENTIVA', description: 'OS sintética' }, actor)).rejects.toThrow('falha sintética');
    expect(state.workOrders).toHaveLength(0);
    expect(prisma.maintenanceRequest.update).toHaveBeenCalledWith({ where: { id: 'request-1' }, data: { status: Onda2MaintenanceRequestStatus.CONVERTED } });
  });
});
