import { BadRequestException } from '@nestjs/common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda2FacilitiesService } from './onda2-facilities.service';

const actor: JwtPayload = {
  sub: 'user-1',
  email: 'user@test.local',
  mantenedoraId: 'tenant-1',
  unitId: 'unit-1',
  roles: [{ roleId: 'role-1', level: 'UNIDADE' as any, type: 'UNIDADE_DIRETOR' as any, unitScopes: [] }],
};

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
  const access = {
    assertFlagAndCapability: jest.fn(),
    assertUnitAccess: jest.fn(),
  } as any;
  let service: Onda2FacilitiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    access.assertFlagAndCapability.mockResolvedValue(undefined);
    access.assertUnitAccess.mockResolvedValue(undefined);
    service = new Onda2FacilitiesService(prisma, access);
  });

  it('retorna a solicitação existente para a mesma chave idempotente', async () => {
    const existing = { id: 'request-1', idempotencyKey: 'mobile-key' };
    prisma.maintenanceRequest.findFirst.mockResolvedValue(existing);
    await expect(
      service.createMaintenanceRequest(
        { unitId: 'unit-1', category: 'HIGIENE', description: 'Torneira com vazamento', idempotencyKey: 'mobile-key' },
        actor,
      ),
    ).resolves.toBe(existing);
    expect(prisma.maintenanceRequest.create).not.toHaveBeenCalled();
  });

  it('rejeita transição inválida de ordem de serviço', async () => {
    prisma.workOrder.findFirst.mockResolvedValue({ id: 'wo-1', mantenedoraId: 'tenant-1', unitId: 'unit-1', status: 'OPEN' });
    prisma.workOrderStatusEvent.findFirst.mockResolvedValue(null);
    await expect(
      service.changeWorkOrderStatus('wo-1', { status: 'CLOSED' as any, idempotencyKey: 'status-1' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workOrderStatusEvent.create).not.toHaveBeenCalled();
  });
});
