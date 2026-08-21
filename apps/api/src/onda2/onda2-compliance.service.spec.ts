import { Onda2InspectionResult } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda2ComplianceService } from './onda2-compliance.service';

const actor: JwtPayload = {
  sub: 'user-1',
  email: 'user@test.local',
  mantenedoraId: 'tenant-1',
  unitId: 'unit-1',
  roles: [{ roleId: 'role-1', level: 'UNIDADE' as any, type: 'UNIDADE_DIRETOR' as any, unitScopes: [] }],
};

describe('Onda2ComplianceService', () => {
  const prisma = {
    preventiveMaintenancePlan: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    preventivePlanTask: { findUnique: jest.fn(), create: jest.fn() },
    inspection: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    nonconformity: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    complianceRequirement: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    complianceEvidence: { create: jest.fn(), findMany: jest.fn() },
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
    prisma.inspection.update.mockResolvedValue({ id: 'inspection-1', status: 'COMPLETED' });
    prisma.nonconformity.create.mockResolvedValue({ id: 'nc-1' });

    const result = await service.completeInspection('inspection-1', { result: Onda2InspectionResult.NON_COMPLIANT, note: 'Revisar fechamento da janela' }, actor);
    expect(result.governance).toEqual({ diagnosticInference: false, humanReviewRequired: true });
    expect(prisma.nonconformity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ inspectionId: 'inspection-1', description: 'Revisar fechamento da janela' }) }));
  });
});
